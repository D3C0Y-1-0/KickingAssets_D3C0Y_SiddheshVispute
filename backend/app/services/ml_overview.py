"""Read-only view of the trained model, its data and its evaluation for the ML section."""

import json
from collections import defaultdict

from app.domain.seed import ROOT
from app.schemas.simulation import FeatureImportance, MlMetricRow, MlOverview, MlSource, MlStatus
from ml import inference

MANIFEST = ROOT / "data" / "reference" / "manifest.json"
SOURCE_INFO = {
    "kev": (
        "CISA Known Exploited Vulnerabilities catalog",
        "Labels (added to KEV within 180 days) and KEV-history features",
        "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        "Authoritative list of vulnerabilities exploited in the wild. Not the full set of "
        "exploited vulnerabilities.",
    ),
    "nvd": (
        "NVD CVE records (fkie-cad per-year release)",
        "CVSS vector, weakness types, vendor/product and description features",
        "https://github.com/fkie-cad/nvd-json-data-feeds",
        "Current records, not a point-in-time archive.",
    ),
    "epss": (
        "EPSS monthly snapshots (FIRST / Empirical Security)",
        "EPSS percentile: baseline and model feature",
        "https://epss.empiricalsecurity.com/",
        "Score scale changed across EPSS model versions, so the within-snapshot rank is used.",
    ),
}
LABELS = {k: v for k, v in inference.FEATURE_LABELS.items()}


def overview() -> MlOverview:
    state = inference.status()
    status = MlStatus(ready=state["ready"], missing=state["missing"])
    if not inference.CARD_FILE.exists():
        return MlOverview(status=status)
    card = json.loads(inference.CARD_FILE.read_text(encoding="utf-8"))
    sources: list[MlSource] = []
    manifest_time = tag = None
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        manifest_time, tag = manifest["retrieved_at"], manifest["nvd_release_tag"]
        grouped: dict[str, list[dict]] = defaultdict(list)
        for f in manifest["files"]:
            grouped[f["path"].split("/")[3]].append(f)
        for key, (name, role, url, note) in SOURCE_INFO.items():
            files = grouped.get(key, [])
            sources.append(
                MlSource(
                    name=name,
                    role=role,
                    url=url,
                    files=len(files),
                    megabytes=round(sum(f["bytes"] for f in files) / 1e6, 1),
                    note=note,
                )
            )
    metrics = []
    for name, row in card["test_results"].items():
        metrics.append(
            MlMetricRow(
                name=name,
                average_precision=row["average_precision"],
                average_precision_ci95=row["average_precision_ci95"],
                roc_auc=row["roc_auc"],
                precision_at_50_per_month=row["precision_at_50_per_month"],
                recall_at_50_per_month=row["recall_at_50_per_month"],
                precision_at_200_per_month=row["precision_at_200_per_month"],
                ap_delta_vs_epss_ci95=row.get("ap_delta_vs_epss_ci95"),
                is_baseline=name.endswith("_baseline"),
            )
        )
    return MlOverview(
        status=status,
        model_version=card["model_version"],
        task=card["task"],
        not_claimed=card["not_claimed"],
        sources=sources,
        manifest_retrieved_at=manifest_time,
        nvd_release_tag=tag,
        panel=card["data"]["panel"],
        design={k: v for k, v in card["design"].items() if k != "leakage_controls"},
        leakage_controls=card["design"]["leakage_controls"],
        metrics=metrics,
        prevalence=card["test_prevalence_weighted"],
        shuffled_label_audit=card["shuffled_label_audit"],
        importances=[
            FeatureImportance(feature=k, label=LABELS.get(k, k), mean_abs_contribution=v)
            for k, v in card["mean_abs_contribution_top"].items()
        ],
        ap_by_quarter=card["average_precision_by_quarter"],
        features=card["features"]["with_epss"],
        limitations=card["limitations"],
    )
