"""Build the point-in-time monthly panel used to train and evaluate the KEV-prioritization signal.

At each monthly snapshot ``s`` every CVE that is at least ``min_age`` days old and not yet in
CISA KEV is a candidate. Features use only information available at ``s``. The label is whether
the CVE is added to KEV in (s, s + horizon]. Non-KEV CVEs are *unlabeled*, not confirmed
unexploited (positive-unlabeled setting). Snapshots start after KEV launched (Nov 2021), because
its initial bulk listing is a catalog artifact, not a time of recognised exploitation.
Negatives are subsampled and carry a weight of 1/rate so population metrics stay unbiased.
"""

import gzip
import json
import lzma
import re
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from ml.features import (
    CVSS_COLUMNS,
    TEXT_PATTERNS,
    count_on_or_before,
    cvss_features,
    normalize_name,
    text_flags,
    to_epoch_day,
)

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "reference" / "cache"
FIRST_SNAPSHOT = date(2021, 12, 1)
_CWE = re.compile(r"^CWE-\d+$")

HISTORY_COLUMNS = [
    "vendor_kev_pre",
    "vendor_cve_pre",
    "vendor_kev_rate",
    "vendor_kev_90d",
    "product_kev_pre",
    "cwe_kev_pre",
    "cwe_kev_90d",
]
EPSS_COLUMNS = ["epss_percentile"]
TEXT_COLUMNS = [*TEXT_PATTERNS, "txt_length"]
# CVSS fields that only exist for some NVD scoring eras (v2 has no UI/scope, v4 has no scope):
# their presence or absence mostly encodes publication date, not risk.
ERA_PROXY_COLUMNS = ["cvss_version", "cvss_ui", "cvss_scope"]
BASE_FEATURES = [
    *[c for c in CVSS_COLUMNS if c not in ERA_PROXY_COLUMNS],
    *TEXT_COLUMNS,
    "n_cwe",
    "age_days",
    *HISTORY_COLUMNS,
]
EPSS_FEATURES = [*BASE_FEATURES, *EPSS_COLUMNS]


def load_kev(path: Path | None = None) -> tuple[pd.DataFrame, date]:
    path = path or CACHE / "kev" / "known_exploited_vulnerabilities.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = [
        {
            "cve_id": v["cveID"],
            "kev_vendor": v.get("vendorProject"),
            "kev_product": v.get("product"),
            "added": date.fromisoformat(v["dateAdded"]),
            "kev_cwes": [c for c in (v.get("cwes") or []) if _CWE.match(c)],
        }
        for v in payload["vulnerabilities"]
    ]
    released = date.fromisoformat(payload["dateReleased"][:10])
    return pd.DataFrame(rows), released


def _parse_item(item: dict) -> dict | None:
    description = next(
        (d["value"] for d in item.get("descriptions", []) if d.get("lang") == "en"), ""
    )
    if item.get("vulnStatus") == "Rejected" or description.startswith("** REJECT"):
        return None
    vendor = product = None
    for block in item.get("affected") or []:
        for entry in block.get("affectedData") or []:
            vendor = normalize_name(entry.get("vendor"))
            if vendor:
                product = normalize_name(entry.get("product"))
                break
        if vendor:
            break
    cwes = sorted(
        {
            d["value"]
            for w in item.get("weaknesses") or []
            for d in w.get("description") or []
            if _CWE.match(d.get("value", ""))
        }
    )
    # Deliberately not read: references, cisaExploit*, ssvc metrics, cveTags (see features.py).
    metrics = {k: v for k, v in (item.get("metrics") or {}).items() if k.startswith("cvssMetric")}
    return {
        "cve_id": item["id"],
        "published": date.fromisoformat(item["published"][:10]),
        "vendor": vendor,
        "product": product,
        "cwes": cwes,
        **cvss_features(metrics),
        **text_flags(description),
    }


def _s(value) -> str | None:
    """pandas may hold a missing string as NaN, which is truthy; normalise to None."""
    return value if isinstance(value, str) and value else None


def load_nvd(directory: Path | None = None, *, use_cache: bool = True) -> pd.DataFrame:
    directory = directory or CACHE / "nvd"
    parsed_path = CACHE / "derived" / "nvd_parsed.parquet"
    if use_cache and directory == CACHE / "nvd" and parsed_path.exists():
        return pd.read_parquet(parsed_path)
    rows = []
    for path in sorted(directory.glob("CVE-*.json.xz")):
        with lzma.open(path, "rt", encoding="utf-8") as handle:
            for item in json.load(handle)["cve_items"]:
                parsed = _parse_item(item)
                if parsed:
                    rows.append(parsed)
    frame = pd.DataFrame(rows)
    if directory == CACHE / "nvd":
        parsed_path.parent.mkdir(parents=True, exist_ok=True)
        frame.to_parquet(parsed_path, index=False)
    return frame


def _epss_files(directory: Path) -> dict[date, Path]:
    files = {}
    for path in directory.glob("epss_scores-*.csv.gz"):
        files[date.fromisoformat(path.name[len("epss_scores-") : -len(".csv.gz")])] = path
    return files


def _read_epss(path: Path) -> pd.DataFrame:
    """Scores for one snapshot. The within-file rank percentile is computed here, because the
    earliest EPSS versions published no percentile and raw scales differ between versions."""
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        skip = 1 if handle.readline().startswith("#") else 0
    frame = pd.read_csv(path, skiprows=skip, compression="gzip", usecols=["cve", "epss"])
    frame["epss_percentile"] = frame["epss"].rank(pct=True)
    return frame.rename(columns={"cve": "cve_id"}).set_index("cve_id")[["epss", "epss_percentile"]]


def _sorted_days(mapping: dict[str, list[int]]) -> dict[str, np.ndarray]:
    return {key: np.array(sorted(days), dtype=np.int64) for key, days in mapping.items()}


def snapshot_candidates(
    published_days: np.ndarray,
    added_days: np.ndarray,
    snapshot_day: int,
    horizon_days: int,
    min_age_days: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Indices of (positive, negative) candidates at one snapshot.

    ``added_days`` holds the KEV dateAdded as an epoch day, or a huge value if never listed.
    A CVE already listed at the snapshot is not a candidate.
    """
    candidate = (published_days <= snapshot_day - min_age_days) & (added_days > snapshot_day)
    positive = candidate & (added_days <= snapshot_day + horizon_days)
    return np.flatnonzero(positive), np.flatnonzero(candidate & ~positive)


def _snapshots(first: date, last: date) -> list[date]:
    days, year, month = [], first.year, first.month
    while date(year, month, 1) <= last:
        days.append(date(year, month, 1))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return days


def history_features(
    snapshot_day: int,
    vendor: str | None,
    product: str | None,
    cwes: list[str],
    tables: dict[str, dict[str, np.ndarray]],
) -> tuple[float, ...]:
    """KEV/vendor history counts using only dates <= the snapshot."""
    v_kev, v_cve = tables["vendor_kev"].get(vendor), tables["vendor_cve"].get(vendor)
    v_now = count_on_or_before(v_kev, snapshot_day) if vendor else 0
    v_cves = count_on_or_before(v_cve, snapshot_day) if vendor else 0
    v_recent = v_now - count_on_or_before(v_kev, snapshot_day - 90) if vendor else 0
    p_now = (
        count_on_or_before(tables["product_kev"].get(f"{vendor}|{product}"), snapshot_day)
        if vendor and product
        else 0
    )
    cwe_now = cwe_recent = 0
    for cwe in cwes:
        days = tables["cwe_kev"].get(cwe)
        now = count_on_or_before(days, snapshot_day)
        cwe_now = max(cwe_now, now)
        cwe_recent = max(cwe_recent, now - count_on_or_before(days, snapshot_day - 90))
    return (v_now, v_cves, v_now / (v_cves + 20), v_recent, p_now, cwe_now, cwe_recent)


def history_context(kev: pd.DataFrame, nvd: pd.DataFrame) -> dict:
    """Lookup tables and aligned arrays shared by panel building and live scoring.

    Everything is indexed by position in ``nvd`` (which must have a clean RangeIndex)."""
    nvd_index = nvd.set_index("cve_id")
    kev_added = {r.cve_id: to_epoch_day(r.added) for r in kev.itertuples()}
    vendor_kev: dict[str, list[int]] = defaultdict(list)
    product_kev: dict[str, list[int]] = defaultdict(list)
    cwe_kev: dict[str, list[int]] = defaultdict(list)
    for r in kev.itertuples():
        day = to_epoch_day(r.added)
        if r.cve_id in nvd_index.index:
            record = nvd_index.loc[r.cve_id]
            vendor, product, cwes = _s(record["vendor"]), _s(record["product"]), record["cwes"]
        else:
            vendor, product, cwes = normalize_name(r.kev_vendor), None, r.kev_cwes
        if vendor:
            vendor_kev[vendor].append(day)
            if product:
                product_kev[f"{vendor}|{product}"].append(day)
        for cwe in cwes:
            cwe_kev[cwe].append(day)
    vendor_cve: dict[str, list[int]] = defaultdict(list)
    for r in nvd[["vendor", "published"]].itertuples():
        if _s(r.vendor):
            vendor_cve[r.vendor].append(to_epoch_day(r.published))
    never = np.iinfo(np.int64).max // 4
    return {
        "kev_added": kev_added,
        "tables": {
            "vendor_kev": _sorted_days(vendor_kev),
            "product_kev": _sorted_days(product_kev),
            "cwe_kev": _sorted_days(cwe_kev),
            "vendor_cve": _sorted_days(vendor_cve),
        },
        "published": np.array([to_epoch_day(d) for d in nvd["published"]], dtype=np.int64),
        "added": np.array([kev_added.get(c, never) for c in nvd["cve_id"]], dtype=np.int64),
        "vendors": [_s(v) for v in nvd["vendor"]],
        "products": [_s(p) for p in nvd["product"]],
        "cwe_lists": nvd["cwes"].tolist(),
        "static": nvd.drop(columns=["vendor", "product", "cwes"]),
    }


def build_panel(
    horizon_days: int = 180,
    min_age_days: int = 30,
    negative_rate: float = 0.03,
    seed: int = 0,
    *,
    use_cache: bool = True,
) -> tuple[pd.DataFrame, dict]:
    derived = CACHE / "derived"
    stem = f"panel_h{horizon_days}_age{min_age_days}_r{negative_rate}_s{seed}"
    cache_path, meta_path = derived / f"{stem}.parquet", derived / f"{stem}.json"
    if use_cache and cache_path.exists() and meta_path.exists():
        return pd.read_parquet(cache_path), json.loads(meta_path.read_text())

    kev, released = load_kev()
    nvd = load_nvd().reset_index(drop=True)
    cutoff = released - timedelta(days=horizon_days)
    ctx = history_context(kev, nvd)
    tables, published, added = ctx["tables"], ctx["published"], ctx["added"]
    vendors, products, cwe_lists, static = (
        ctx["vendors"],
        ctx["products"],
        ctx["cwe_lists"],
        ctx["static"],
    )

    rng = np.random.default_rng(seed)
    epss_files = _epss_files(CACHE / "epss")
    frames = []
    for snapshot in _snapshots(FIRST_SNAPSHOT, cutoff):
        s_day = to_epoch_day(snapshot)
        positive, negative = snapshot_candidates(
            published, added, s_day, horizon_days, min_age_days
        )
        keep_negative = negative[rng.random(len(negative)) < negative_rate]
        index = np.concatenate([positive, keep_negative])
        history = [
            history_features(s_day, vendors[i], products[i], cwe_lists[i], tables) for i in index
        ]
        frame = static.iloc[index].reset_index(drop=True)
        frame["snapshot"] = snapshot
        frame["age_days"] = s_day - published[index]
        frame["n_cwe"] = [len(cwe_lists[i]) for i in index]
        frame[HISTORY_COLUMNS] = np.array(history, dtype=float).reshape(len(index), -1)
        frame["y"] = np.r_[np.ones(len(positive), int), np.zeros(len(keep_negative), int)]
        frame["weight"] = np.r_[
            np.ones(len(positive)), np.full(len(keep_negative), 1 / negative_rate)
        ]
        match = next(
            (
                epss_files[d]
                for d in sorted(epss_files)
                if snapshot <= d <= snapshot + timedelta(days=4)
            ),
            None,
        )
        if match is not None:
            joined = _read_epss(match).reindex(frame["cve_id"])
            frame["epss"] = joined["epss"].to_numpy()
            frame["epss_percentile"] = joined["epss_percentile"].to_numpy()
        else:
            frame["epss"] = frame["epss_percentile"] = np.nan
        frames.append(frame)
    panel = pd.concat(frames, ignore_index=True)
    meta = {
        "horizon_days": horizon_days,
        "min_age_days": min_age_days,
        "negative_rate": negative_rate,
        "seed": seed,
        "kev_released": released.isoformat(),
        "first_snapshot": FIRST_SNAPSHOT.isoformat(),
        "last_snapshot": max(panel["snapshot"]).isoformat(),
        "rows": len(panel),
        "positive_rows": int(panel["y"].sum()),
        "distinct_positive_cves": int(panel.loc[panel["y"] == 1, "cve_id"].nunique()),
    }
    derived.mkdir(parents=True, exist_ok=True)
    panel.to_parquet(cache_path, index=False)
    meta_path.write_text(json.dumps(meta, indent=2))
    return panel, meta
