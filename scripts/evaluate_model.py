"""Verify pinned training sources and reevaluate saved models; never retrains or overwrites them."""

import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def fetch_record(record):
    target = (ROOT / record["path"]).resolve()
    if not target.is_relative_to(ROOT / "data/reference/cache"):
        raise ValueError("Manifest cache path is outside reference cache")
    if (
        target.exists()
        and hashlib.sha256(target.read_bytes()).hexdigest() == record["sha256"]
    ):
        return
    request = urllib.request.Request(
        record["url"], headers={"User-Agent": "GridSentinel-evaluation/1.0"}
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read()
            break
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    if hashlib.sha256(payload).hexdigest() != record["sha256"]:
        raise ValueError(
            f"Source checksum differs from training manifest: {record['path']}"
        )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fetch", action="store_true", help="Download exact manifest sources first"
    )
    args = parser.parse_args()
    manifest = json.loads((ROOT / "data/reference/manifest.json").read_text())
    if args.fetch:
        with ThreadPoolExecutor(max_workers=3) as pool:
            for index, _ in enumerate(pool.map(fetch_record, manifest["files"]), 1):
                print(f"Verified source {index}/{len(manifest['files'])}", flush=True)
    for record in manifest["files"]:
        path = ROOT / record["path"]
        if (
            not path.exists()
            or hashlib.sha256(path.read_bytes()).hexdigest() != record["sha256"]
        ):
            raise ValueError(
                f"Missing or changed training source: {record['path']}; use --fetch"
            )

    import pandas as pd
    import xgboost as xgb

    from ml.data import build_panel
    from ml.evaluate import topk_per_snapshot, weighted_ap, weighted_auc
    from ml.train import ARTIFACTS, MODEL_VERSION, split_panel

    card = json.loads((ARTIFACTS / f"{MODEL_VERSION}_model_card.json").read_text())
    panel, _ = build_panel(use_cache=False)
    panel["snapshot"] = pd.to_datetime(panel["snapshot"])
    test = split_panel(panel, 180)["test"]
    y, weight = test.y.to_numpy(), test.weight.to_numpy()
    scorers = {}
    for name in ("xgboost_with_epss", "xgboost_no_epss", "xgboost_no_kev_history"):
        model = xgb.XGBClassifier()
        model.load_model(ARTIFACTS / f"{MODEL_VERSION}_{name}.ubj")
        scorers[name] = model.predict_proba(test[model.get_booster().feature_names])[
            :, 1
        ]
    scorers["epss_percentile_baseline"] = test.epss_percentile.fillna(0).to_numpy()
    scorers["cvss_only_baseline"] = test.cvss_score.fillna(0).to_numpy()
    results = {}
    for name, scores in scorers.items():
        metrics = {
            "average_precision": round(weighted_ap(y, scores, weight), 4),
            "roc_auc": round(weighted_auc(y, scores, weight), 4),
        }
        metrics.update(
            {
                key: round(value, 4)
                for key, value in topk_per_snapshot(
                    y, scores, weight, test.snapshot.to_numpy(), 200
                ).items()
            }
        )
        expected = card["test_results"][name]
        if any(abs(value - expected[key]) > 0.0001 for key, value in metrics.items()):
            raise ValueError(f"Reevaluation differs from model card: {name}: {metrics}")
        results[name] = metrics
    output = {
        "verified_sources": len(manifest["files"]),
        "test_rows": len(test),
        "results": results,
    }
    target = ROOT / "artifacts/ml-reevaluation.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
