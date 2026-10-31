"""Live scoring with the trained KEV-prioritization signal, at any available snapshot.

Scores CVEs using exactly the features the model was trained on (`ml.data.history_features`
and the same static columns). The score ranks CVEs by resemblance to ones CISA later adds to
KEV; it is not the probability that an asset is attacked. ``priority_percentile`` places a
score within a reference sample of all not-yet-listed CVEs at the snapshot.

Running at a past snapshot ("time travel") uses only information available then; the later
KEV additions are available separately as ground-truth outcomes for a backtest.
"""

import json
import threading
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from ml.data import (
    CACHE,
    EPSS_FEATURES,
    HISTORY_COLUMNS,
    _epss_files,
    _read_epss,
    history_context,
    history_features,
    load_affected,
    load_kev,
    load_nvd,
)
from ml.features import TEXT_PATTERNS, count_on_or_before, to_epoch_day
from ml.matching import AffectedIndex

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
MODEL_VERSION = "kev-signal-v1"
MODEL_FILE = ARTIFACTS / f"{MODEL_VERSION}_xgboost_with_epss.ubj"
CARD_FILE = ARTIFACTS / f"{MODEL_VERSION}_model_card.json"
MIN_AGE_DAYS = 30
OUTCOME_HORIZON_DAYS = 180
REFERENCE_SAMPLE = 20000
# Snapshot periods, mirroring the purged splits used in ml.train.
TRAIN_END = date(2023, 7, 1)
VAL_START, VAL_END = date(2024, 1, 1), date(2024, 7, 1)
TEST_START = date(2025, 1, 1)
EPOCH = date(1970, 1, 1)

FEATURE_LABELS = {
    "epss_percentile": "EPSS percentile",
    "cvss_score": "CVSS base score",
    "cvss_av": "Attack vector (network = high)",
    "cvss_ac": "Attack complexity (low = high)",
    "cvss_pr": "Privileges required (none = high)",
    "cvss_c": "Confidentiality impact",
    "cvss_i": "Integrity impact",
    "cvss_a": "Availability impact",
    "age_days": "Days since publication",
    "n_cwe": "Number of weakness types",
    "vendor_kev_pre": "Vendor's KEV entries so far",
    "vendor_cve_pre": "Vendor's CVE volume so far",
    "vendor_kev_rate": "Vendor KEV rate",
    "vendor_kev_90d": "Vendor KEV entries, last 90 days",
    "product_kev_pre": "Product's KEV entries so far",
    "cwe_kev_pre": "Weakness type's KEV entries so far",
    "cwe_kev_90d": "Weakness type's KEV entries, last 90 days",
    "txt_length": "Description length",
}
for _name in TEXT_PATTERNS:
    FEATURE_LABELS.setdefault(_name, "Description mentions " + _name[4:].replace("_", " "))


class ReferenceUnavailable(RuntimeError):
    """The local reference data or trained model is missing; run the fetch and train steps."""


def split_label(as_of: date) -> str:
    if as_of <= TRAIN_END:
        return "training period (in-sample: the model saw this period)"
    if as_of < VAL_START:
        return "purged gap between training and validation"
    if as_of <= VAL_END:
        return "validation period (used to tune the model)"
    if as_of < TEST_START:
        return "purged gap before the held-out test"
    return "held-out test period (never used to train or tune)"


def is_held_out(as_of: date) -> bool:
    return as_of >= TEST_START


@dataclass
class Shared:
    kev: pd.DataFrame
    kev_released: date
    nvd: pd.DataFrame
    ctx: dict
    model: xgb.XGBClassifier
    positions: dict[str, int]
    matcher: AffectedIndex
    epss_files: dict[date, Path]


@dataclass
class ProductCandidates:
    """CVEs that apply to an assumed (vendor, product family, version) at the snapshot."""

    unlisted: np.ndarray
    listed: np.ndarray
    applicability: dict[str, str]
    product_known: bool
    product_positions: np.ndarray
    confirmed_total: int
    unknown_total: int
    excluded_total: int


@dataclass
class Reference:
    as_of: date
    shared: Shared
    epss: pd.DataFrame
    reference_scores: np.ndarray

    @property
    def kev_released(self) -> date:
        return self.shared.kev_released

    @property
    def ctx(self) -> dict:
        return self.shared.ctx

    @property
    def model(self) -> xgb.XGBClassifier:
        return self.shared.model

    @property
    def positions(self) -> dict[str, int]:
        return self.shared.positions

    @property
    def s_day(self) -> int:
        return to_epoch_day(self.as_of)

    @property
    def outcome_window_closed(self) -> bool:
        return self.s_day + OUTCOME_HORIZON_DAYS <= to_epoch_day(self.kev_released)

    def frame(self, positions: np.ndarray) -> pd.DataFrame:
        ctx = self.ctx
        frame = ctx["static"].iloc[positions].reset_index(drop=True).copy()
        frame["age_days"] = self.s_day - ctx["published"][positions]
        frame["n_cwe"] = [len(ctx["cwe_lists"][i]) for i in positions]
        history = np.array(
            [
                history_features(
                    self.s_day,
                    ctx["vendors"][i],
                    ctx["products"][i],
                    ctx["cwe_lists"][i],
                    ctx["tables"],
                )
                for i in positions
            ],
            dtype=float,
        ).reshape(len(positions), len(HISTORY_COLUMNS))
        frame[HISTORY_COLUMNS] = history
        joined = self.epss.reindex(frame["cve_id"])
        frame["epss"] = joined["epss"].to_numpy()
        frame["epss_percentile"] = joined["epss_percentile"].to_numpy()
        return frame

    def score_positions(self, positions: np.ndarray) -> pd.DataFrame:
        frame = self.frame(positions)
        if frame.empty:
            frame["ml_score"] = []
            frame["priority_percentile"] = []
            return frame
        frame["ml_score"] = self.model.predict_proba(frame[EPSS_FEATURES])[:, 1]
        frame["priority_percentile"] = np.searchsorted(
            self.reference_scores, frame["ml_score"].to_numpy(), side="right"
        ) / len(self.reference_scores)
        return frame

    def drivers(self, frame: pd.DataFrame, top: int = 3) -> list[list[dict]]:
        """Largest signed feature contributions (exact TreeSHAP from XGBoost) per row."""
        if frame.empty:
            return []
        contributions = self.model.get_booster().predict(
            xgb.DMatrix(frame[EPSS_FEATURES]), pred_contribs=True
        )
        out = []
        for row, values in zip(
            frame[EPSS_FEATURES].itertuples(index=False), contributions, strict=True
        ):
            order = np.argsort(-np.abs(values[:-1]))[:top]
            out.append(
                [
                    {
                        "feature": EPSS_FEATURES[i],
                        "label": FEATURE_LABELS.get(EPSS_FEATURES[i], EPSS_FEATURES[i]),
                        "value": None if pd.isna(row[i]) else float(row[i]),
                        "contribution": round(float(values[i]), 4),
                    }
                    for i in order
                ]
            )
        return out

    def match_product(
        self, vendor: str, product_contains: list[str], version: str
    ) -> ProductCandidates:
        """Version-aware candidates: CVEs whose NVD affected ranges include the version."""
        match = self.shared.matcher.match(vendor, product_contains, version)
        published = self.ctx["published"]
        added = self.ctx["added"]
        applicability: dict[str, str] = {}
        unlisted, listed = [], []
        for cve in sorted(match.confirmed | match.unknown):
            position = self.positions.get(cve)
            if position is None or published[position] > self.s_day:
                continue
            tier = "version_confirmed" if cve in match.confirmed else "version_unknown"
            if added[position] <= self.s_day:
                listed.append(position)
                applicability[cve] = tier
            elif published[position] <= self.s_day - MIN_AGE_DAYS:
                unlisted.append(position)
                applicability[cve] = tier
        product_positions = np.array(
            [
                p
                for c in match.product_cves
                if (p := self.positions.get(c)) is not None and published[p] <= self.s_day
            ],
            dtype=int,
        )
        return ProductCandidates(
            unlisted=np.array(unlisted, dtype=int),
            listed=np.array(listed, dtype=int),
            applicability=applicability,
            product_known=match.product_known,
            product_positions=product_positions,
            confirmed_total=len(match.confirmed),
            unknown_total=len(match.unknown),
            excluded_total=len(match.excluded),
        )

    def outcomes(self, positions: np.ndarray) -> list[tuple[str, date | None]]:
        """What actually happened to each not-yet-listed CVE after the snapshot."""
        out: list[tuple[str, date | None]] = []
        for day in self.ctx["added"][positions]:
            if self.s_day < day <= self.s_day + OUTCOME_HORIZON_DAYS:
                out.append(("added_to_kev", EPOCH + timedelta(days=int(day))))
            elif self.outcome_window_closed:
                out.append(("not_added_in_window", None))
            else:
                out.append(("window_open", None))
        return out

    def history(
        self, vendor: str, product_contains: list[str], product_positions: np.ndarray
    ) -> dict:
        """Real vulnerability history of an assumed product family up to the snapshot."""
        tables = self.ctx["tables"]
        s_day = self.s_day
        published = self.ctx["published"][product_positions]
        added = self.ctx["added"][product_positions]
        listed_mask = added <= s_day
        years: dict[int, list[int]] = {}
        for pub in published:
            years.setdefault((EPOCH + timedelta(days=int(pub))).year, [0, 0])[0] += 1
        for day in added[listed_mask]:
            years.setdefault((EPOCH + timedelta(days=int(day))).year, [0, 0])[1] += 1
        last_year = (EPOCH + timedelta(days=s_day)).year
        by_year = [
            {
                "year": y,
                "cves_published": years.get(y, [0, 0])[0],
                "kev_added": years.get(y, [0, 0])[1],
            }
            for y in range(last_year - 5, last_year + 1)
        ]
        vendor_kev = tables["vendor_kev"].get(vendor)
        product_keys = [
            k
            for k in tables["product_kev"]
            if k.startswith(f"{vendor}|")
            and any(needle in k.split("|", 1)[1] for needle in product_contains)
        ]
        listed_days = added[listed_mask]
        return {
            "by_year": by_year,
            "product_cves_total": int(len(product_positions)),
            "product_kev_listed": int(listed_mask.sum()),
            "vendor_kev_total": count_on_or_before(vendor_kev, s_day),
            "vendor_kev_last_90d": count_on_or_before(vendor_kev, s_day)
            - count_on_or_before(vendor_kev, s_day - 90),
            "vendor_cve_total": count_on_or_before(tables["vendor_cve"].get(vendor), s_day),
            "product_kev_total": sum(
                count_on_or_before(tables["product_kev"][k], s_day) for k in product_keys
            ),
            "first_kev_added": EPOCH + timedelta(days=int(listed_days.min()))
            if len(listed_days)
            else None,
            "last_kev_added": EPOCH + timedelta(days=int(listed_days.max()))
            if len(listed_days)
            else None,
        }


_LOCK = threading.RLock()
_SHARED: Shared | None = None
_REFERENCES: dict[date, Reference] = {}


def status() -> dict:
    missing = []
    if not (CACHE / "kev" / "known_exploited_vulnerabilities.json").exists():
        missing.append("CISA KEV file (run python -m ml.fetch_reference)")
    has_nvd = (CACHE / "derived" / "nvd_parsed.parquet").exists() or list(
        (CACHE / "nvd").glob("CVE-*.json.xz")
    )
    if not has_nvd:
        missing.append("NVD yearly files (run python -m ml.fetch_reference)")
    if not list((CACHE / "epss").glob("epss_scores-*.csv.gz")):
        missing.append("EPSS snapshots (run python -m ml.fetch_reference)")
    if not MODEL_FILE.exists():
        missing.append("trained model (run python -m ml.train)")
    return {"ready": not missing, "missing": missing}


def available_snapshots() -> list[date]:
    return sorted(_epss_files(CACHE / "epss"))


def _shared() -> Shared:
    global _SHARED
    with _LOCK:
        if _SHARED is None:
            state = status()
            if not state["ready"]:
                raise ReferenceUnavailable("; ".join(state["missing"]))
            kev, released = load_kev()
            nvd = load_nvd().reset_index(drop=True)
            model = xgb.XGBClassifier()
            model.load_model(MODEL_FILE)
            _SHARED = Shared(
                kev=kev,
                kev_released=released,
                nvd=nvd,
                ctx=history_context(kev, nvd),
                model=model,
                positions={cve: i for i, cve in enumerate(nvd["cve_id"])},
                matcher=AffectedIndex(load_affected()),
                epss_files=_epss_files(CACHE / "epss"),
            )
        return _SHARED


def load_reference(as_of: date | None = None) -> Reference:
    with _LOCK:
        shared = _shared()
        as_of = as_of or max(shared.epss_files)
        if as_of not in shared.epss_files:
            raise ValueError(f"No EPSS snapshot for {as_of}; choose one of the available dates")
        if as_of in _REFERENCES:
            return _REFERENCES[as_of]
        reference = Reference(
            as_of=as_of,
            shared=shared,
            epss=_read_epss(shared.epss_files[as_of]),
            reference_scores=np.array([]),
        )
        # Reference distribution: every CVE old enough and not yet KEV-listed at the snapshot.
        ctx = shared.ctx
        eligible = np.flatnonzero(
            (ctx["published"] <= reference.s_day - MIN_AGE_DAYS) & (ctx["added"] > reference.s_day)
        )
        rng = np.random.default_rng(0)
        sample = rng.choice(eligible, size=min(REFERENCE_SAMPLE, len(eligible)), replace=False)
        frame = reference.frame(sample)
        reference.reference_scores = np.sort(shared.model.predict_proba(frame[EPSS_FEATURES])[:, 1])
        _REFERENCES[as_of] = reference
        return reference


def score_cve(cve_id: str, as_of: date | None = None) -> dict | None:
    """Score one CVE at the snapshot, or report that it is already KEV-listed."""
    ref = load_reference(as_of)
    position = ref.positions.get(cve_id)
    if position is None:
        return None
    added = int(ref.ctx["added"][position])
    published_day = int(ref.ctx["published"][position])
    base = {
        "cve_id": cve_id,
        "published": EPOCH + timedelta(days=published_day),
        "as_of": ref.as_of,
        "model_version": MODEL_VERSION,
    }
    if published_day > ref.s_day - MIN_AGE_DAYS and added > ref.s_day:
        return {**base, "status": "too_recent"}
    if added <= ref.s_day:
        return {**base, "status": "already_in_kev", "kev_added": EPOCH + timedelta(days=added)}
    frame = ref.score_positions(np.array([position]))
    row = frame.iloc[0]
    return {
        **base,
        "status": "scored",
        "ml_score": float(row["ml_score"]),
        "priority_percentile": float(row["priority_percentile"]),
        "epss_percentile": None
        if pd.isna(row["epss_percentile"])
        else float(row["epss_percentile"]),
        "cvss_score": None if pd.isna(row["cvss_score"]) else float(row["cvss_score"]),
        "drivers": ref.drivers(frame, top=5)[0],
    }


def model_card() -> dict:
    return json.loads(CARD_FILE.read_text(encoding="utf-8"))
