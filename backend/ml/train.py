"""Train and evaluate the KEV-prioritization signal.

The output ranks CVEs by how much they resemble CVEs that CISA later added to KEV. It is a
relative prioritization signal for CVEs, not the probability that any asset will be attacked.

Run from backend/:  ..\\.venv\\Scripts\\python.exe -m ml.train
"""

import argparse
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ml.data import BASE_FEATURES, EPSS_FEATURES, HISTORY_COLUMNS, ROOT, build_panel
from ml.evaluate import cluster_bootstrap, topk_per_snapshot, weighted_ap, weighted_auc

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
MODEL_VERSION = "kev-signal-v1"
SEED = 0

# Time splits on the snapshot date, purged so no training label window reaches the next split.
VAL_START = date(2024, 1, 1)
TEST_START = date(2025, 1, 1)
MONOTONE = {
    "epss_percentile": 1,
    "vendor_kev_pre": 1,
    "vendor_kev_90d": 1,
    "product_kev_pre": 1,
    "cwe_kev_pre": 1,
}
COUNT_COLUMNS = [
    "vendor_kev_pre",
    "vendor_cve_pre",
    "vendor_kev_90d",
    "product_kev_pre",
    "cwe_kev_pre",
    "cwe_kev_90d",
    "age_days",
    "txt_length",
]


def split_panel(panel: pd.DataFrame, horizon: int) -> dict[str, pd.DataFrame]:
    s = panel["snapshot"]
    parts = {
        "train": panel[s + pd.Timedelta(days=horizon) <= pd.Timestamp(VAL_START)],
        "val": panel[
            (s >= pd.Timestamp(VAL_START))
            & (s + pd.Timedelta(days=horizon) <= pd.Timestamp(TEST_START))
        ],
        "test": panel[s >= pd.Timestamp(TEST_START)],
    }
    # Leakage guard: label windows of earlier splits must close before the next split begins.
    assert parts["train"]["snapshot"].max() + timedelta(days=horizon) <= pd.Timestamp(VAL_START)
    assert parts["val"]["snapshot"].max() + timedelta(days=horizon) <= pd.Timestamp(TEST_START)
    assert parts["train"]["snapshot"].max() < parts["val"]["snapshot"].min()
    assert parts["val"]["snapshot"].max() < parts["test"]["snapshot"].min()
    return parts


def fit_xgb(train, val, features, params, *, label=None, weighted=True, train_from=None):
    """``train_from`` drops earlier snapshots (the 2022 KEV catalog build-out phase);
    ``weighted=False`` trains on the undersampled rows as-is, which keeps the ranking but gives
    positives more influence than the 1/rate population weights do."""
    if train_from is not None:
        keep = (train["snapshot"] >= pd.Timestamp(train_from)).to_numpy()
        train = train[keep]
        label = None if label is None else label[keep]
    y = train["y"].to_numpy() if label is None else label
    model = xgb.XGBClassifier(
        n_estimators=1500,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_lambda=10.0,
        tree_method="hist",
        eval_metric="aucpr",
        early_stopping_rounds=60,
        random_state=SEED,
        n_jobs=4,
        monotone_constraints="(" + ",".join(str(MONOTONE.get(f, 0)) for f in features) + ")",
        **params,
    )
    model.fit(
        train[features],
        y,
        sample_weight=train["weight"] if weighted else None,
        eval_set=[(val[features], val["y"])],
        sample_weight_eval_set=[val["weight"]],
        verbose=False,
    )
    return model


def tune(train, val, features):
    """Pick settings by validation weighted AP only; the test split is never consulted."""
    best = None
    for train_from in (None, "2022-07-01"):
        for weighted in (True, False):
            for depth in (3, 5):
                for min_child in (1.0, 10.0):
                    params = {"max_depth": depth, "min_child_weight": min_child}
                    model = fit_xgb(
                        train, val, features, params, weighted=weighted, train_from=train_from
                    )
                    score = weighted_ap(
                        val["y"].to_numpy(),
                        model.predict_proba(val[features])[:, 1],
                        val["weight"].to_numpy(),
                    )
                    if best is None or score > best[0]:
                        best = (
                            score,
                            {**params, "weighted_training": weighted, "train_from": train_from},
                            model,
                        )
    return best


def logistic(train, features):
    def prep(frame):
        x = frame[features].copy()
        x[[c for c in COUNT_COLUMNS if c in x]] = np.log1p(x[[c for c in COUNT_COLUMNS if c in x]])
        return x

    model = make_pipeline(
        SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(C=0.5, max_iter=2000)
    )
    model.fit(prep(train), train["y"])
    return lambda frame: model.predict_proba(prep(frame))[:, 1]


def evaluate(test, scorers, horizon):
    y, w = test["y"].to_numpy(), test["weight"].to_numpy()
    snapshots = test["snapshot"].to_numpy()
    results = {}
    for name, score in scorers.items():
        row = {
            "average_precision": round(weighted_ap(y, score, w), 4),
            "roc_auc": round(weighted_auc(y, score, w), 4),
        }
        for k in (50, 200):
            row.update(
                {m: round(v, 4) for m, v in topk_per_snapshot(y, score, w, snapshots, k).items()}
            )
        results[name] = row
    codes = pd.factorize(test["cve_id"])[0]
    ci = cluster_bootstrap(y, w, codes, scorers, "epss_percentile_baseline")
    for name in results:
        results[name]["average_precision_ci95"] = ci[name]["ci95"]
        if "delta_vs_reference_ci95" in ci[name]:
            results[name]["ap_delta_vs_epss_ci95"] = ci[name]["delta_vs_reference_ci95"]
            results[name]["share_of_bootstrap_draws_better_than_epss"] = ci[name][
                "share_of_draws_better_than_reference"
            ]
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--horizon", type=int, default=180)
    parser.add_argument("--no-cache", action="store_true")
    args = parser.parse_args()

    panel, meta = build_panel(horizon_days=args.horizon, use_cache=not args.no_cache)
    panel["snapshot"] = pd.to_datetime(panel["snapshot"])
    parts = split_panel(panel, args.horizon)
    train, val, test = parts["train"], parts["val"], parts["test"]
    for name, part in parts.items():
        print(
            f"{name}: {len(part):,} rows, {int(part.y.sum()):,} positive rows, "
            f"{part.loc[part.y == 1, 'cve_id'].nunique()} positive CVEs, "
            f"{part.snapshot.min().date()}..{part.snapshot.max().date()}"
        )

    models, tuned = {}, {}
    for name, features in (
        ("xgboost_with_epss", EPSS_FEATURES),
        ("xgboost_no_epss", BASE_FEATURES),
        ("xgboost_no_kev_history", [f for f in EPSS_FEATURES if f not in HISTORY_COLUMNS]),
    ):
        score, params, model = tune(train, val, features)
        models[name] = (model, features)
        tuned[name] = {
            "validation_average_precision": round(score, 4),
            **params,
            "best_iteration": int(model.best_iteration),
        }
        print(name, tuned[name])
    lr = logistic(train, EPSS_FEATURES)

    scorers = {
        name: model.predict_proba(test[features])[:, 1]
        for name, (model, features) in models.items()
    }
    scorers["logistic_with_epss"] = lr(test)
    scorers["epss_percentile_baseline"] = test["epss_percentile"].fillna(0).to_numpy()
    scorers["cvss_only_baseline"] = test["cvss_score"].fillna(0).to_numpy()
    scorers["vendor_kev_history_baseline"] = test["vendor_kev_pre"].to_numpy()
    results = evaluate(test, scorers, args.horizon)

    # Leakage audit: permute (label, weight) pairs across training rows so the features carry no
    # information about either; the same pipeline must then score near prevalence.
    perm = np.random.default_rng(SEED).permutation(len(train))
    audit_train = train.assign(weight=train["weight"].to_numpy()[perm])
    audit_model = fit_xgb(
        audit_train,
        val,
        EPSS_FEATURES,
        {"max_depth": 3, "min_child_weight": 1.0},
        label=train["y"].to_numpy()[perm],
    )
    prevalence = float(np.average(test["y"], weights=test["weight"]))
    audit_ap = weighted_ap(
        test["y"].to_numpy(),
        audit_model.predict_proba(test[EPSS_FEATURES])[:, 1],
        test["weight"].to_numpy(),
    )

    best_model, best_features = models["xgboost_with_epss"]
    sample = test.sample(n=min(20000, len(test)), random_state=SEED)
    contribs = best_model.get_booster().predict(
        xgb.DMatrix(sample[best_features]), pred_contribs=True
    )
    importance = pd.Series(np.abs(contribs[:, :-1]).mean(axis=0), index=best_features).sort_values(
        ascending=False
    )

    quarters = test["snapshot"].dt.to_period("Q").astype(str)
    drift = {}
    for q in sorted(quarters.unique()):
        part = test[quarters == q]
        if part["y"].sum() == 0:
            continue
        y, w = part["y"].to_numpy(), part["weight"].to_numpy()
        drift[q] = {
            "xgboost_with_epss": round(
                weighted_ap(
                    y, models["xgboost_with_epss"][0].predict_proba(part[best_features])[:, 1], w
                ),
                4,
            ),
            "epss_percentile_baseline": round(
                weighted_ap(y, part["epss_percentile"].fillna(0).to_numpy(), w), 4
            ),
            "positive_rows": int(y.sum()),
        }

    ARTIFACTS.mkdir(exist_ok=True)
    for name, (model, _) in models.items():
        model.save_model(ARTIFACTS / f"{MODEL_VERSION}_{name}.ubj")
    manifest = json.loads((ROOT / "data" / "reference" / "manifest.json").read_text())
    card = {
        "model_version": MODEL_VERSION,
        "task": "Rank CVEs by resemblance to CVEs CISA later adds to KEV within the horizon.",
        "not_claimed": [
            "Not the probability that an asset or organisation is attacked or compromised.",
            "Not calibrated; scores are a relative ranking signal.",
            "Non-KEV CVEs are unlabeled, not confirmed unexploited (positive-unlabeled).",
        ],
        "data": {
            "sources": ["CISA KEV", "NVD (fkie-cad per-year release)", "EPSS monthly snapshots"],
            "manifest": "data/reference/manifest.json",
            "manifest_retrieved_at": manifest["retrieved_at"],
            "nvd_release_tag": manifest["nvd_release_tag"],
            "panel": meta,
        },
        "design": {
            "horizon_days": args.horizon,
            "candidate": "CVE at least 30 days old and not yet in KEV at the monthly snapshot",
            "negative_sampling": "negatives subsampled; weighted by 1/rate so metrics describe the population",
            "splits": {
                "train": "snapshots whose label window closes by " + VAL_START.isoformat(),
                "validation": f"{VAL_START} .. snapshots closing by {TEST_START}",
                "test": f"{TEST_START} onward",
                "rows": {k: len(v) for k, v in parts.items()},
            },
            "leakage_controls": [
                "NVD references, cisaExploit*, SSVC and cveTags are never read",
                "KEV-history features count only dateAdded <= snapshot",
                "snapshots begin after KEV's Nov 2021 launch (initial bulk listing excluded)",
                "training label windows closed before validation; validation before test",
                "EPSS used as within-snapshot rank percentile (scale changed across EPSS versions)",
                "shuffled-label audit below",
            ],
        },
        "features": {"with_epss": EPSS_FEATURES, "no_epss": BASE_FEATURES},
        "tuning": tuned,
        "test_results": results,
        "test_prevalence_weighted": round(prevalence, 6),
        "shuffled_label_audit": {
            "average_precision": round(audit_ap, 4),
            "prevalence": round(prevalence, 6),
        },
        "mean_abs_contribution_top": {
            k: round(float(v), 4) for k, v in importance.head(12).items()
        },
        "average_precision_by_quarter": drift,
        "limitations": [
            "NVD fields are the current record, not a point-in-time archive: CVSS, CWE and affected-product fields may have been edited after the snapshot.",
            "Few positives (hundreds of distinct CVEs); intervals are wide and clustered by CVE.",
            "KEV listing reflects CISA's inclusion criteria and timing, not the full set of exploited vulnerabilities.",
            "EPSS model versions changed during the period; rank percentile mitigates but does not remove drift.",
            "Vendor/product matching uses normalised NVD names.",
            "Pairs of (CVE, snapshot) are correlated; precision/recall are over pairs.",
        ],
    }
    (ARTIFACTS / f"{MODEL_VERSION}_model_card.json").write_text(json.dumps(card, indent=2) + "\n")
    print(
        json.dumps(
            {
                "test": results,
                "audit": card["shuffled_label_audit"],
                "top": card["mean_abs_contribution_top"],
            },
            indent=1,
        )
    )


if __name__ == "__main__":
    main()
