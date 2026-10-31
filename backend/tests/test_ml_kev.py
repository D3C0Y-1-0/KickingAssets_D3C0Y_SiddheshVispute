from datetime import date

import numpy as np
import pytest

from ml.data import BASE_FEATURES, EPSS_FEATURES, snapshot_candidates
from ml.evaluate import topk_per_snapshot
from ml.features import (
    count_on_or_before,
    cvss_features,
    normalize_name,
    text_flags,
    to_epoch_day,
)


def test_kev_history_counts_only_dates_up_to_the_snapshot():
    days = np.array([10, 20, 30, 40])
    assert count_on_or_before(days, 5) == 0
    assert count_on_or_before(days, 20) == 2  # inclusive of the snapshot day
    assert count_on_or_before(days, 39) == 3
    assert count_on_or_before(None, 100) == 0


def test_candidates_exclude_already_listed_young_and_label_future_additions_only():
    published = np.array([0, 0, 0, 0, 90])
    added = np.array([50, 120, 400, 10**9, 10**9])  # 0: already listed, 1: inside window
    positive, negative = snapshot_candidates(
        published, added, snapshot_day=100, horizon_days=100, min_age_days=30
    )
    assert positive.tolist() == [1]  # listed after the snapshot, within the horizon
    assert negative.tolist() == [2, 3]  # outside the horizon / never listed
    # index 0 was already in KEV at the snapshot and index 4 is younger than 30 days


def test_exploitation_derived_fields_are_not_model_features():
    for forbidden in ("references", "cisa", "ssvc", "kev_added", "cve_tags", "epss"):
        assert not any(forbidden in name for name in BASE_FEATURES)
    assert "epss_percentile" in EPSS_FEATURES and "epss_percentile" not in BASE_FEATURES
    for era_proxy in ("cvss_version", "cvss_ui", "cvss_scope"):
        assert era_proxy not in EPSS_FEATURES


def test_cvss_and_text_extraction():
    metrics = {
        "cvssMetricV31": [
            {
                "type": "Primary",
                "cvssData": {
                    "baseScore": 9.8,
                    "attackVector": "NETWORK",
                    "attackComplexity": "LOW",
                    "privilegesRequired": "NONE",
                    "userInteraction": "NONE",
                    "scope": "UNCHANGED",
                    "confidentialityImpact": "HIGH",
                    "integrityImpact": "HIGH",
                    "availabilityImpact": "HIGH",
                },
            }
        ]
    }
    out = cvss_features(metrics)
    assert out["cvss_score"] == 9.8 and out["cvss_av"] == 3 and out["cvss_c"] == 2
    assert np.isnan(cvss_features(None)["cvss_score"])
    flags = text_flags("Unauthenticated remote code execution via deserialization.")
    assert flags["txt_rce"] == flags["txt_unauth"] == flags["txt_deserialization"] == 1
    assert normalize_name("Microsoft Corporation") == normalize_name("microsoft") == "microsoft"
    assert normalize_name("n/a") is None


def test_weighted_top_k_uses_population_weights():
    y = np.array([1, 0, 0, 1])
    score = np.array([0.9, 0.8, 0.1, 0.05])
    weight = np.array([1.0, 10.0, 10.0, 1.0])  # negatives stand for 10 candidates each
    snapshot = np.array(["m"] * 4)
    result = topk_per_snapshot(y, score, weight, snapshot, k=11)
    assert result["precision_at_11_per_month"] == pytest.approx(1 / 11)
    assert result["recall_at_11_per_month"] == pytest.approx(0.5)


def test_epoch_day_round_trip():
    assert to_epoch_day(date(1970, 1, 2)) == 1
