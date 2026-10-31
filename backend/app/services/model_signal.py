"""Native XGBoost inference using the exact evaluated feature order and extraction helpers."""

import hashlib
import json
from datetime import date
from functools import lru_cache

import numpy as np
import xgboost as xgb

from app.domain.seed import ROOT
from app.schemas.intelligence import CVESignal, FeatureContribution, ModelEvidence
from ml.features import cvss_features, text_flags

ARTIFACTS = ROOT / "backend/ml/artifacts"
VARIANT = "xgboost_no_kev_history"
VERSION = "kev-signal-v1"
ARTIFACT = ARTIFACTS / f"{VERSION}_{VARIANT}.ubj"


@lru_cache(maxsize=1)
def model_bundle():
    model = xgb.XGBClassifier(n_jobs=1)
    model.load_model(ARTIFACT)
    card = json.loads((ARTIFACTS / f"{VERSION}_model_card.json").read_text())
    return model, card, hashlib.sha256(ARTIFACT.read_bytes()).hexdigest()


def evidence() -> ModelEvidence:
    model, card, sha = model_bundle()
    verification = json.loads((ROOT / "data/reference/ml-reevaluation.json").read_text())
    matched = verification["model_sha256"].get(VARIANT) == sha
    return ModelEvidence(
        model_version=VERSION,
        variant=VARIANT,
        artifact_sha256=sha,
        feature_names=model.get_booster().feature_names,
        task=card["task"],
        metrics=card["test_results"],
        manifest_sha256=hashlib.sha256(
            (ROOT / "data/reference/manifest.json").read_bytes()
        ).hexdigest(),
        evaluation_status=(
            f"Source-verified reevaluation: {verification['test_rows']} holdout rows, {verification['verified_sources']} pinned sources; saved-model metrics reproduced."
            if matched
            else "Model artifact differs from the recorded local reevaluation; reevaluation required"
        ),
        limitations=[
            *card["not_claimed"],
            *card["limitations"],
            "The portable curated input bundle excludes complete NVD vendor/CWE history, so it uses the evaluated no-KEV-history ablation. The workflow uses the full historical cache and main model. No history counts are fabricated.",
            "The shuffled-label audit AP is 0.0006 versus weighted prevalence 0.000158; this audit does not establish absence of leakage.",
            "No statistically established improvement over EPSS; experimental model, not an operationally validated predictor.",
        ],
    )


def predict(
    raw_cve: dict, *, feature_date: date, epss_rank: float | None, kev_added: date | None
) -> CVESignal:
    model, _, sha = model_bundle()
    common = dict(
        cve_id=raw_cve["id"],
        model_version=VERSION,
        model_variant=VARIANT,
        artifact_sha256=sha,
        feature_date=feature_date.isoformat(),
    )
    if kev_added is not None and kev_added <= feature_date:
        return CVESignal(
            **common,
            status="known_kev",
            reason="Already listed in KEV: outside the model's prediction candidate population. KEV evidence is used directly; no ML score is invented.",
        )
    age = (feature_date - date.fromisoformat(raw_cve["published"][:10])).days
    if age < 30 or epss_rank is None:
        return CVESignal(
            **common,
            status="unavailable",
            reason="Model requires age >=30 days and a full-snapshot EPSS rank percentile.",
        )
    description = next(
        (item["value"] for item in raw_cve.get("descriptions", []) if item["lang"] == "en"), ""
    )
    cwes = {
        d["value"]
        for w in raw_cve.get("weaknesses", [])
        for d in w.get("description", [])
        if d.get("value", "").startswith("CWE-") and d["value"][4:].isdigit()
    }
    values = {
        **cvss_features(raw_cve.get("metrics")),
        **text_flags(description),
        "n_cwe": len(cwes),
        "age_days": age,
        "epss_percentile": epss_rank,
    }
    names = model.get_booster().feature_names
    row = np.array([[values[name] for name in names]], dtype=np.float32)
    signal = float(model.predict_proba(row, validate_features=False)[0, 1])
    # Match early-stopped classifier inference; explain only the same trees, not all saved trees.
    matrix = xgb.DMatrix(row, feature_names=names)
    contributions = model.get_booster().predict(
        matrix, pred_contribs=True, iteration_range=(0, model.best_iteration + 1)
    )[0]
    return CVESignal(
        **common,
        status="computed",
        signal=signal,
        reason="Experimental, uncalibrated CVE KEV-listing ranking signal; not an asset-compromise probability.",
        contributions=[
            FeatureContribution(
                feature=name,
                value=None if np.isnan(value) else float(value),
                log_odds_contribution=float(contribution),
            )
            for name, value, contribution in sorted(
                zip(names, row[0], contributions[:-1], strict=True), key=lambda item: -abs(item[2])
            )[:6]
        ],
    )
