"""Build the point-in-time CVE table used to train and evaluate the KEV-prioritization signal.

One row per CVE. ``t0`` is the first month start at least 30 days after publication; every
feature is computed from information available at t0. The label is whether the CVE is added to
CISA KEV in (t0, t0 + horizon]. CVEs already in KEV at t0 are excluded. Non-KEV CVEs are
*unlabeled*, not confirmed unexploited (positive-unlabeled setting).
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
    label_in_window,
    normalize_name,
    prediction_date,
    text_flags,
    to_epoch_day,
)

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "reference" / "cache"
MIN_PUBLISHED_YEAR = 2018
_CWE = re.compile(r"^CWE-\d+$")

HISTORY_COLUMNS = [
    "vendor_kev_pre",
    "vendor_cve_pre",
    "vendor_kev_rate",
    "product_kev_pre",
    "cwe_kev_pre",
]
EPSS_COLUMNS = ["epss_percentile"]
TEXT_COLUMNS = [*TEXT_PATTERNS, "txt_length"]
BASE_FEATURES = [*CVSS_COLUMNS, *TEXT_COLUMNS, "n_cwe", *HISTORY_COLUMNS]
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


def build_table(
    horizon_days: int = 180, lag_days: int = 30, *, use_cache: bool = True
) -> tuple[pd.DataFrame, dict]:
    derived = CACHE / "derived"
    cache_path = derived / f"table_h{horizon_days}_lag{lag_days}.parquet"
    meta_path = derived / f"table_h{horizon_days}_lag{lag_days}.json"
    if use_cache and cache_path.exists() and meta_path.exists():
        return pd.read_parquet(cache_path), json.loads(meta_path.read_text())

    kev, released = load_kev()
    nvd = load_nvd()
    cutoff = released - timedelta(days=horizon_days)

    nvd_index = nvd.set_index("cve_id")
    kev_added = {r.cve_id: to_epoch_day(r.added) for r in kev.itertuples()}
    vendor_kev: dict[str, list[int]] = defaultdict(list)
    product_kev: dict[tuple[str, str], list[int]] = defaultdict(list)
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
                product_kev[(vendor, product)].append(day)
        for cwe in cwes:
            cwe_kev[cwe].append(day)
    vendor_cve: dict[str, list[int]] = defaultdict(list)
    for r in nvd[["vendor", "published"]].itertuples():
        if _s(r.vendor):
            vendor_cve[r.vendor].append(to_epoch_day(r.published))
    vendor_kev_days, cwe_kev_days = _sorted_days(vendor_kev), _sorted_days(cwe_kev)
    product_kev_days = _sorted_days({"|".join(k): v for k, v in product_kev.items()})
    vendor_cve_days = _sorted_days(vendor_cve)

    rows = []
    stats = {"considered": 0, "dropped_already_in_kev": 0, "dropped_after_cutoff": 0}
    for record in nvd.to_dict("records"):
        if record["published"].year < MIN_PUBLISHED_YEAR:
            continue
        stats["considered"] += 1
        t0 = prediction_date(record["published"], lag_days)
        if t0 > cutoff:
            stats["dropped_after_cutoff"] += 1
            continue
        t0_day = to_epoch_day(t0)
        added = kev_added.get(record["cve_id"])
        if added is not None and added <= t0_day:
            stats["dropped_already_in_kev"] += 1
            continue
        vendor, product = _s(record["vendor"]), _s(record["product"])
        v_kev = count_on_or_before(vendor_kev_days.get(vendor), t0_day) if vendor else 0
        v_cve = count_on_or_before(vendor_cve_days.get(vendor), t0_day) if vendor else 0
        p_kev = (
            count_on_or_before(product_kev_days.get(f"{vendor}|{product}"), t0_day)
            if vendor and product
            else 0
        )
        c_kev = max(
            (count_on_or_before(cwe_kev_days.get(c), t0_day) for c in record["cwes"]), default=0
        )
        row = {k: v for k, v in record.items() if k not in {"vendor", "product", "cwes"}}
        row.update(
            t0=t0,
            n_cwe=len(record["cwes"]),
            vendor_kev_pre=v_kev,
            vendor_cve_pre=v_cve,
            vendor_kev_rate=v_kev / (v_cve + 20),
            product_kev_pre=p_kev,
            cwe_kev_pre=c_kev,
            y=label_in_window(added, t0_day, horizon_days),
            kev_added=None if added is None else date(1970, 1, 1) + timedelta(days=added),
        )
        rows.append(row)
    table = pd.DataFrame(rows)

    epss_dir = CACHE / "epss"
    files = _epss_files(epss_dir)
    table["epss"] = np.nan
    table["epss_percentile"] = np.nan
    for t0, index in table.groupby("t0").groups.items():
        match = next((files[d] for d in sorted(files) if t0 <= d <= t0 + timedelta(days=4)), None)
        if match is None:
            continue
        scores = _read_epss(match)
        joined = scores.reindex(table.loc[index, "cve_id"])
        table.loc[index, "epss"] = joined["epss"].to_numpy()
        table.loc[index, "epss_percentile"] = joined["epss_percentile"].to_numpy()

    meta = {
        "horizon_days": horizon_days,
        "lag_days": lag_days,
        "kev_released": released.isoformat(),
        "label_cutoff_t0": cutoff.isoformat(),
        "min_published_year": MIN_PUBLISHED_YEAR,
        "rows": len(table),
        "positives": int(table["y"].sum()),
        **stats,
    }
    derived.mkdir(parents=True, exist_ok=True)
    table.to_parquet(cache_path, index=False)
    meta_path.write_text(json.dumps(meta, indent=2))
    return table, meta
