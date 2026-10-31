"""Transparent relative risk index. Pure functions; no I/O.

risk = 100 x S x E x I'
  S  ML vulnerability signal in [0, 1]: the highest ML priority percentile among the asset's
     candidate CVEs; a CISA-KEV-listed CVE for the assumed product family sets a floor.
  E  exposure factor in [0.5, 1.0] from the asset's configured security posture.
  I' impact factor in [0.2, 1.0]: 0.2 + 0.8 x the worst plausible service disruption fraction.

It is a relative prioritisation index. It is not a probability of an incident.
"""

from collections.abc import Mapping, Sequence

SCORING_VERSION = "risk-index-v1"
KEV_FLOOR = 0.95
EXPOSURE_BASE = 0.5
IMPACT_FLOOR = 0.2
BANDS = ((60.0, "critical"), (40.0, "high"), (20.0, "medium"), (0.0, "low"))
CRITICALITY_WEIGHT = {"essential": 3.0, "important": 2.0, "supporting": 1.0}
FORMULA = (
    "risk = 100 x S x E x I'.  S = ML vulnerability signal (max priority percentile of the asset's "
    f"candidate CVEs; a KEV-listed CVE sets a floor of {KEV_FLOOR}).  E = exposure factor "
    f"({EXPOSURE_BASE} + 0.2 internet-exposed + 0.1 remote access + 0.1 no MFA + 0.1 patch review "
    f"required, max 1).  I' = {IMPACT_FLOOR} + {1 - IMPACT_FLOOR:.1f} x worst plausible service "
    "disruption. Bands: critical >= 60, high >= 40, medium >= 20, else low."
)


def exposure_factor(security: Mapping[str, object]) -> tuple[float, list[str]]:
    parts = [f"base {EXPOSURE_BASE}"]
    value = EXPOSURE_BASE
    for flag, weight, text in (
        (security.get("internet_exposed") is True, 0.2, "internet-exposed"),
        (security.get("remote_access") is True, 0.1, "remote access enabled"),
        (security.get("mfa_enabled") is False, 0.1, "no multifactor authentication"),
        (security.get("patch_status") == "review_required", 0.1, "patch review required"),
    ):
        if flag:
            value += weight
            parts.append(f"+{weight} {text}")
    return min(1.0, round(value, 4)), parts


def vulnerability_signal(
    unlisted_percentiles: Sequence[float], kev_listed_count: int, total_candidates: int
) -> float | None:
    """None means no candidate CVEs exist (unknown), which is not the same as zero."""
    if total_candidates == 0:
        return None
    signal = max(unlisted_percentiles, default=0.0)
    if kev_listed_count > 0:
        signal = max(signal, KEV_FLOOR)
    return round(float(signal), 6)


def impact_factor(worst_disruption: float) -> float:
    return round(IMPACT_FLOOR + (1 - IMPACT_FLOOR) * worst_disruption, 6)


def risk_score(signal: float, exposure: float, impact: float) -> float:
    return round(100.0 * signal * exposure * impact, 2)


def category(score: float) -> str:
    return next(name for floor, name in BANDS if score >= floor)


def city_index(scores_and_criticality: Sequence[tuple[float, str]]) -> float | None:
    """Criticality-weighted mean over assets that have a computed score."""
    if not scores_and_criticality:
        return None
    weights = [CRITICALITY_WEIGHT.get(c, 1.0) for _, c in scores_and_criticality]
    total = sum(s * w for (s, _), w in zip(scores_and_criticality, weights, strict=True))
    return round(total / sum(weights), 2)
