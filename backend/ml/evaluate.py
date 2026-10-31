"""Ranking metrics for a population sampled with known weights.

Negatives in the panel are subsampled and carry weight 1/rate, so every metric below is
computed on the weighted population. Candidates are (CVE, snapshot) pairs, so uncertainty is
estimated with a bootstrap that resamples whole CVEs, not individual rows.
"""

from collections.abc import Callable, Mapping, Sequence

import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score


def weighted_ap(y: np.ndarray, score: np.ndarray, weight: np.ndarray) -> float:
    return float(average_precision_score(y, score, sample_weight=weight))


def weighted_auc(y: np.ndarray, score: np.ndarray, weight: np.ndarray) -> float:
    return float(roc_auc_score(y, score, sample_weight=weight))


def topk_per_snapshot(
    y: np.ndarray,
    score: np.ndarray,
    weight: np.ndarray,
    snapshot: np.ndarray,
    k: int,
) -> dict[str, float]:
    """Review-budget view: each month take the ``k`` highest-scored candidates (by population
    weight). Returns pooled precision and the share of that month's positives captured."""
    hit = seen = positives = 0.0
    for key in np.unique(snapshot):
        mask = snapshot == key
        order = np.argsort(-score[mask], kind="stable")
        ys, ws = y[mask][order], weight[mask][order]
        cumulative = np.cumsum(ws)
        cut = int(np.searchsorted(cumulative, k, side="left")) + 1
        hit += float((ys[:cut] * ws[:cut]).sum())
        seen += float(ws[:cut].sum())
        positives += float((ys * ws).sum())
    return {
        f"precision_at_{k}_per_month": hit / seen if seen else float("nan"),
        f"recall_at_{k}_per_month": hit / positives if positives else float("nan"),
    }


def cluster_bootstrap(
    y: np.ndarray,
    weight: np.ndarray,
    cve_codes: np.ndarray,
    scores: Mapping[str, np.ndarray],
    reference: str,
    *,
    draws: int = 200,
    seed: int = 0,
    metric: Callable[[np.ndarray, np.ndarray, np.ndarray], float] = weighted_ap,
) -> dict[str, dict[str, Sequence[float] | float]]:
    """95% intervals for each scorer's metric and for its difference from ``reference``."""
    rng = np.random.default_rng(seed)
    n_cves = int(cve_codes.max()) + 1
    names = list(scores)
    samples: dict[str, list[float]] = {name: [] for name in names}
    for _ in range(draws):
        counts = np.bincount(rng.integers(0, n_cves, n_cves), minlength=n_cves)
        w = weight * counts[cve_codes]
        if not (w * y).sum():
            continue
        for name in names:
            samples[name].append(metric(y, scores[name], w))
    out: dict[str, dict[str, Sequence[float] | float]] = {}
    ref = np.array(samples[reference])
    for name in names:
        values = np.array(samples[name])
        low, high = np.percentile(values, [2.5, 97.5])
        entry: dict[str, Sequence[float] | float] = {
            "ci95": [round(float(low), 4), round(float(high), 4)]
        }
        if name != reference:
            diff = values - ref
            d_low, d_high = np.percentile(diff, [2.5, 97.5])
            entry["delta_vs_reference_ci95"] = [round(float(d_low), 4), round(float(d_high), 4)]
            entry["share_of_draws_better_than_reference"] = round(float((diff > 0).mean()), 3)
        out[name] = entry
    return out
