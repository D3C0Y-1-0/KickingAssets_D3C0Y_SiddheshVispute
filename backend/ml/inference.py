"""Live scoring with the trained KEV-prioritization signal.

Scores CVEs at the latest EPSS snapshot using exactly the features the model was trained on
(`ml.data.history_features` and the same static columns). The score ranks CVEs by resemblance
to ones CISA later adds to KEV; it is not the probability that an asset is attacked.
``priority_percentile`` places a score within a reference sample of all not-yet-listed CVEs at
the snapshot, which is how the rest of the system consumes it.
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
    load_kev,
    load_nvd,
)
from ml.features import TEXT_PATTERNS, to_epoch_day

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
MODEL_VERSION = "kev-signal-v1"
MODEL_FILE = ARTIFACTS / f"{MODEL_VERSION}_xgboost_with_epss.ubj"
CARD_FILE = ARTIFACTS / f"{MODEL_VERSION}_model_card.json"
MIN_AGE_DAYS = 30
REFERENCE_SAMPLE = 20000

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


@dataclass
class Reference:
    as_of: date
    kev_released: date
    kev: pd.DataFrame
    nvd: pd.DataFrame
    ctx: dict
    epss: pd.DataFrame
    model: xgb.XGBClassifier
    reference_scores: np.ndarray
    positions: dict[str, int]
    vendor_positions: dict[str, np.ndarray]

    @property
    def s_day(self) -> int:
        return to_epoch_day(self.as_of)

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

    def candidates(
        self,
        vendors: list[str],
        product_contains: list[str],
        product_excludes: list[str],
        window_days: int,
    ) -> tuple[np.ndarray, np.ndarray]:
        """Positions of (not yet listed, already KEV-listed) CVEs for a vendor family that were
        published between ``window_days`` and ``MIN_AGE_DAYS`` before the snapshot."""
        parts = [self.vendor_positions[v] for v in vendors if v in self.vendor_positions]
        if not parts:
            return np.array([], dtype=int), np.array([], dtype=int)
        positions = np.concatenate(parts)
        published = self.ctx["published"][positions]
        keep = (published >= self.s_day - window_days) & (published <= self.s_day - MIN_AGE_DAYS)
        products = self.ctx["products"]
        if product_contains:
            keep &= np.array([_has(products[i], product_contains) for i in positions])
        if product_excludes:
            keep &= ~np.array([_has(products[i], product_excludes) for i in positions])
        positions = positions[keep]
        listed = self.ctx["added"][positions] <= self.s_day
        return positions[~listed], positions[listed]


def _has(product: str | None, needles: list[str]) -> bool:
    return product is not None and any(n in product for n in needles)


_LOCK = threading.Lock()
_REFERENCE: Reference | None = None


def status() -> dict:
    missing = []
    if not (CACHE / "kev" / "known_exploited_vulnerabilities.json").exists():
        missing.append("CISA KEV file (run python -m ml.fetch_reference)")
    if (
        not list((CACHE / "nvd").glob("CVE-*.json.xz"))
        and not (CACHE / "derived" / "nvd_parsed.parquet").exists()
    ):
        missing.append("NVD yearly files (run python -m ml.fetch_reference)")
    if not list((CACHE / "epss").glob("epss_scores-*.csv.gz")):
        missing.append("EPSS snapshots (run python -m ml.fetch_reference)")
    if not MODEL_FILE.exists():
        missing.append("trained model (run python -m ml.train)")
    return {"ready": not missing, "missing": missing}


def load_reference(*, force: bool = False) -> Reference:
    global _REFERENCE
    with _LOCK:
        if _REFERENCE is not None and not force:
            return _REFERENCE
        state = status()
        if not state["ready"]:
            raise ReferenceUnavailable("; ".join(state["missing"]))
        kev, released = load_kev()
        nvd = load_nvd().reset_index(drop=True)
        ctx = history_context(kev, nvd)
        files = _epss_files(CACHE / "epss")
        as_of = max(files)
        model = xgb.XGBClassifier()
        model.load_model(MODEL_FILE)
        vendor_positions = {
            vendor: np.asarray(index)
            for vendor, index in pd.Series(ctx["vendors"]).groupby(ctx["vendors"]).indices.items()
        }
        reference = Reference(
            as_of=as_of,
            kev_released=released,
            kev=kev,
            nvd=nvd,
            ctx=ctx,
            epss=_read_epss(files[as_of]),
            model=model,
            reference_scores=np.array([]),
            positions={cve: i for i, cve in enumerate(nvd["cve_id"])},
            vendor_positions=vendor_positions,
        )
        # Reference distribution: every CVE old enough and not yet KEV-listed at the snapshot.
        eligible = np.flatnonzero(
            (ctx["published"] <= reference.s_day - MIN_AGE_DAYS) & (ctx["added"] > reference.s_day)
        )
        rng = np.random.default_rng(0)
        sample = rng.choice(eligible, size=min(REFERENCE_SAMPLE, len(eligible)), replace=False)
        frame = reference.frame(sample)
        reference.reference_scores = np.sort(model.predict_proba(frame[EPSS_FEATURES])[:, 1])
        _REFERENCE = reference
        return reference


def score_cve(cve_id: str) -> dict | None:
    """Score one CVE at the snapshot, or report that it is already KEV-listed."""
    ref = load_reference()
    position = ref.positions.get(cve_id)
    if position is None:
        return None
    added = int(ref.ctx["added"][position])
    published = date(1970, 1, 1) + timedelta(days=int(ref.ctx["published"][position]))
    base = {
        "cve_id": cve_id,
        "published": published,
        "as_of": ref.as_of,
        "model_version": MODEL_VERSION,
    }
    if added <= ref.s_day:
        listed = date(1970, 1, 1) + timedelta(days=added)
        return {**base, "status": "already_in_kev", "kev_added": listed}
    if int(ref.ctx["published"][position]) > ref.s_day - MIN_AGE_DAYS:
        return {**base, "status": "too_recent"}
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
