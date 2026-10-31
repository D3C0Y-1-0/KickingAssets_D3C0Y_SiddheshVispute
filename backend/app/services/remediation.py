"""Baseline binding, patch evidence and operational constraints for what-if and planning.

Nothing here scores risk. It decides which requests are valid, which CVEs a patch is modelled to
remediate (and which it is not, with the evidence), and whether a set of actions fits the
operational limits. The numbers still come from the scoring and conditional-impact engines.
"""

import hashlib
import json
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

from app.schemas.models import ApiIssue
from app.schemas.simulation import (
    ActionType,
    CveRemediation,
    OperationalConstraints,
    PatchOutcome,
)
from ml.matching import parse_version

PATCH_BATCH = 3
EXTRA_CVE_HOURS = 2.0
SCORE_EPSILON = 1e-9


class RemediationError(Exception):
    """A request that cannot be honoured, with enough structure for the UI to show why."""

    def __init__(self, status: int, code: str, message: str, issues: Sequence[ApiIssue] = ()):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.issues = list(issues)


# ------------------------------------------------------------------------------ run binding


def run_fingerprint(
    *,
    scenario_id: str,
    snapshot_id: str,
    as_of: str,
    model_version: str,
    scoring_version: str,
    city_score: float | None,
    asset_scores: Sequence[tuple[str, float | None]],
) -> str:
    """Stable digest of everything a projection depends on. Identical inputs, identical digest."""
    payload = {
        "scenario": scenario_id,
        "snapshot": snapshot_id,
        "as_of": as_of,
        "model": model_version,
        "scoring": scoring_version,
        "city": city_score,
        "assets": sorted(asset_scores),
    }
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode()).hexdigest()[:32]


def bind_baseline(ctx: Any, history: dict[str, str], body: Any) -> None:
    """Accept the request only if it names the exact run that is the current baseline."""
    run = ctx.run
    if (body.scenario_id, body.snapshot_id) != (
        ctx.bundle.scenario.id,
        ctx.bundle.snapshot.snapshot_id,
    ):
        raise RemediationError(
            409,
            "baseline_mismatch",
            "The request names a different scenario or snapshot than the current simulation.",
            [
                ApiIssue(
                    path="snapshot_id",
                    code="baseline_mismatch",
                    message=f"Current simulation is for {ctx.bundle.scenario.id} / "
                    f"{ctx.bundle.snapshot.snapshot_id}.",
                )
            ],
        )
    if body.run_id != run.id:
        if body.run_id in history:
            same = history[body.run_id] == run.fingerprint
            raise RemediationError(
                409,
                "stale_baseline",
                f"Simulation run {body.run_id} has been superseded by {run.id}. Re-run the "
                "request against the current run.",
                [
                    ApiIssue(
                        path="run_id",
                        code="stale_baseline",
                        message=f"Latest run is {run.id}"
                        + (
                            "; its results are identical to the requested run."
                            if same
                            else "; its results differ from the requested run."
                        ),
                    )
                ],
            )
        raise RemediationError(
            404,
            "baseline_not_found",
            f"No simulation run {body.run_id} exists in this session.",
            [
                ApiIssue(
                    path="run_id", code="baseline_not_found", message=f"Current run is {run.id}."
                )
            ],
        )
    if body.baseline_fingerprint and body.baseline_fingerprint != run.fingerprint:
        raise RemediationError(
            409,
            "baseline_fingerprint_mismatch",
            "The baseline fingerprint does not match the run's results.",
            [
                ApiIssue(
                    path="baseline_fingerprint",
                    code="baseline_fingerprint_mismatch",
                    message=f"Run {run.id} has fingerprint {run.fingerprint}.",
                )
            ],
        )


# ------------------------------------------------------------------------------ patch evidence


@dataclass(frozen=True)
class PatchResolution:
    scope: str
    target_version: str | None
    remediated: tuple[CveRemediation, ...]
    not_remediated: tuple[CveRemediation, ...]
    effort_hours: float

    @property
    def cves(self) -> frozenset[str]:
        return frozenset(r.cve_id for r in self.remediated)

    def outcome(self) -> PatchOutcome:
        return PatchOutcome(
            scope=self.scope,  # type: ignore[arg-type]
            target_version=self.target_version,
            remediated=list(self.remediated),
            not_remediated=list(self.not_remediated),
        )


def candidate_map(evidence: Any) -> dict[str, str]:
    """CVE -> applicability tier for every CVE the asset's evidence lists."""
    out: dict[str, str] = {}
    for frame in (evidence.listed, evidence.unlisted):
        out.update(zip(frame["cve_id"], frame["applicability"], strict=True))
    return out


def priority_order(evidence: Any) -> list[str]:
    """KEV-listed CVEs first (newest first), then the highest ML-ranked. Ties break on CVE id."""
    listed = evidence.listed.sort_values(["published", "cve_id"], ascending=[False, True])
    ranked = evidence.unlisted.sort_values(["ml_score", "cve_id"], ascending=[False, True])
    return listed["cve_id"].tolist() + ranked["cve_id"].tolist()


def resolve_patch(
    *,
    evidence: Any,
    fixed: dict[str, str | None],
    match_at: Callable[[str], Any],
    current_version: str,
    cve_ids: Sequence[str] | None,
    target_version: str | None,
    base_effort: float,
    path: str,
) -> tuple[PatchResolution | None, list[ApiIssue]]:
    """Decide which CVEs a patch remediates, from NVD evidence only.

    A CVE is remediated only when the data supports it: either NVD documents a fixed version for
    the range containing the assumed version, or the declared target version falls outside every
    affected range. Everything else is reported, not assumed fixed.
    """
    issues: list[ApiIssue] = []
    candidates = candidate_map(evidence)
    order = priority_order(evidence)
    explicit = list(cve_ids) if cve_ids else None
    if explicit is not None:
        repeated = sorted({c for c in explicit if explicit.count(c) > 1})
        if repeated:
            issues.append(
                ApiIssue(
                    path=f"{path}.cve_ids",
                    code="duplicate_cve",
                    message=f"Listed more than once: {', '.join(repeated)}.",
                )
            )
        unsupported = sorted({c for c in explicit if c not in candidates})
        if unsupported:
            issues.append(
                ApiIssue(
                    path=f"{path}.cve_ids",
                    code="cve_not_applicable",
                    message=f"{', '.join(unsupported)}: not a candidate for this asset's assumed "
                    f"product version {current_version} (NVD ranges do not include it).",
                )
            )
    if target_version is not None:
        target, current = parse_version(target_version), parse_version(current_version)
        if target is None:
            issues.append(
                ApiIssue(
                    path=f"{path}.target_version",
                    code="invalid_target_version",
                    message=f"'{target_version}' contains no version number.",
                )
            )
        elif current is not None and target <= current:
            issues.append(
                ApiIssue(
                    path=f"{path}.target_version",
                    code="invalid_target_version",
                    message=f"'{target_version}' is not newer than the assumed version "
                    f"{current_version}.",
                )
            )
    if issues:
        return None, issues

    def entry(cve: str, status: str, reason: str, fixed_in: str | None) -> CveRemediation:
        return CveRemediation(
            cve_id=cve,
            status=status,  # type: ignore[arg-type]
            applicability=candidates[cve],  # type: ignore[arg-type]
            fixed_in=fixed_in,
            reason=reason,
        )

    remediated: list[CveRemediation] = []
    not_remediated: list[CveRemediation] = []
    undocumented = (
        "NVD data names no fixed version for this CVE, so remediation is not modelled. "
        "Supply target_version to test a specific upgrade."
    )
    if target_version is not None:
        scope = "target_version"
        match = match_at(target_version)
        for cve in explicit if explicit is not None else order:
            if cve in match.excluded:
                remediated.append(
                    entry(
                        cve,
                        "remediated",
                        f"NVD affected ranges exclude {target_version}.",
                        fixed.get(cve),
                    )
                )
            elif cve in match.confirmed:
                not_remediated.append(
                    entry(
                        cve,
                        "not_resolved_by_target_version",
                        f"{target_version} is still inside an affected range.",
                        fixed.get(cve),
                    )
                )
            else:
                not_remediated.append(
                    entry(
                        cve,
                        "applicability_unestablished",
                        f"NVD ranges cannot establish whether {target_version} is affected.",
                        fixed.get(cve),
                    )
                )
        effort = base_effort
    elif explicit is not None:
        scope = "explicit_cves"
        for cve in explicit:
            boundary = fixed.get(cve)
            if boundary:
                remediated.append(entry(cve, "remediated", _documented(boundary), boundary))
            else:
                not_remediated.append(entry(cve, "fix_version_not_documented", undocumented, None))
        effort = base_effort + EXTRA_CVE_HOURS * max(0, len(explicit) - PATCH_BATCH)
    else:
        scope = "default_batch"
        chosen = [c for c in order if fixed.get(c)][:PATCH_BATCH]
        for cve in chosen:
            remediated.append(entry(cve, "remediated", _documented(fixed[cve]), fixed[cve]))
        for cve in order[:PATCH_BATCH]:
            if cve not in chosen and not fixed.get(cve):
                not_remediated.append(entry(cve, "fix_version_not_documented", undocumented, None))
        effort = base_effort
    return (
        PatchResolution(scope, target_version, tuple(remediated), tuple(not_remediated), effort),
        [],
    )


def _documented(boundary: str | None) -> str:
    return (
        f"NVD documents the fix at {boundary}; modelled as resolved by updating to {boundary} "
        "or later."
    )


# --------------------------------------------------------------------------- constraints


@dataclass(frozen=True)
class PlannedAction:
    path: str
    asset_id: str
    action_type: ActionType
    effort_hours: float
    downtime_hours: float


def validate_constraints(constraints: OperationalConstraints | None) -> list[ApiIssue]:
    """Reject rule sets that cannot be satisfied or are self-contradictory."""
    if constraints is None:
        return []
    issues: list[ApiIssue] = []
    for i, pair in enumerate(constraints.incompatible):
        if pair.first == pair.second:
            issues.append(
                ApiIssue(
                    path=f"constraints.incompatible[{i}]",
                    code="invalid_constraint",
                    message="An action cannot be incompatible with itself.",
                )
            )
    edges = {(p.action, p.requires) for p in constraints.prerequisites}
    for i, rule in enumerate(constraints.prerequisites):
        if rule.action == rule.requires:
            issues.append(
                ApiIssue(
                    path=f"constraints.prerequisites[{i}]",
                    code="invalid_constraint",
                    message="An action cannot be its own prerequisite.",
                )
            )
    for action in sorted({a for a, _ in edges}):
        if (action, action) in edges:
            continue  # already reported as a self-prerequisite
        closure = _closure(action, edges)
        if action in _reachable(action, edges):
            issues.append(
                ApiIssue(
                    path="constraints.prerequisites",
                    code="prerequisite_cycle",
                    message=f"{action} depends on itself through its prerequisites.",
                )
            )
            continue
        for pair in constraints.incompatible:
            if {pair.first, pair.second} <= ({action} | set(closure)):
                issues.append(
                    ApiIssue(
                        path="constraints",
                        code="unsatisfiable_constraints",
                        message=f"{action} requires {', '.join(sorted(closure))}, which includes "
                        f"the incompatible pair {pair.first}/{pair.second}.",
                    )
                )
    return issues


def _reachable(action: str, edges: set[tuple[str, str]]) -> set[str]:
    """Every action that `action` depends on, directly or not (includes itself on a cycle)."""
    found: set[str] = set()
    frontier = [action]
    while frontier:
        node = frontier.pop()
        for a, r in edges:
            if a == node and r not in found:
                found.add(r)
                frontier.append(r)
    return found


def _closure(action: str, edges: set[tuple[str, str]]) -> list[str]:
    """Prerequisites of an action in application order (dependencies first)."""
    out: list[str] = []
    seen: set[str] = set()

    def visit(node: str, stack: tuple[str, ...]) -> None:
        for a, r in sorted(edges):
            if a == node and r not in seen and r not in stack:
                visit(r, stack + (node,))
                seen.add(r)
                out.append(r)

    visit(action, ())
    return out


def prerequisites_of(action: str, constraints: OperationalConstraints | None) -> list[str]:
    if constraints is None:
        return []
    return _closure(action, {(p.action, p.requires) for p in constraints.prerequisites})


def incompatible_with(
    action: str, others: set[str], constraints: OperationalConstraints | None
) -> str | None:
    if constraints is None:
        return None
    for pair in constraints.incompatible:
        if action == pair.first and pair.second in others:
            return pair.second
        if action == pair.second and pair.first in others:
            return pair.first
    return None


def check_plan(
    planned: Sequence[PlannedAction], constraints: OperationalConstraints | None
) -> tuple[list[ApiIssue], list[str]]:
    """Check a staged action set against the limits. Returns violations and the checks passed."""
    issues: list[ApiIssue] = []
    checks: list[str] = []
    total = round(sum(p.downtime_hours for p in planned), 2)
    if constraints is None:
        return issues, checks
    window = constraints.max_downtime_per_action_hours
    if window is not None:
        bad = [p for p in planned if p.downtime_hours > window]
        for p in bad:
            issues.append(
                ApiIssue(
                    path=p.path,
                    code="exceeds_maintenance_window",
                    message=f"{p.action_type} on {p.asset_id} needs {p.downtime_hours} h of "
                    f"downtime; the longest window is {window} h.",
                )
            )
        if not bad:
            checks.append(f"Every action fits the {window} h maintenance window.")
    limit = constraints.max_total_downtime_hours
    if limit is not None:
        if total > limit:
            issues.append(
                ApiIssue(
                    path="actions",
                    code="exceeds_downtime_budget",
                    message=f"Total downtime {total} h exceeds the {limit} h limit.",
                )
            )
        else:
            checks.append(f"Total downtime {total} h is within the {limit} h limit.")
    by_asset: dict[str, dict[str, PlannedAction]] = {}
    for p in planned:
        by_asset.setdefault(p.asset_id, {})[p.action_type] = p
    conflicts = prereq_missing = 0
    for p in planned:
        others = set(by_asset[p.asset_id]) - {p.action_type}
        clash = incompatible_with(p.action_type, others, constraints)
        if clash and p.action_type < clash:
            conflicts += 1
            issues.append(
                ApiIssue(
                    path=p.path,
                    code="incompatible_actions",
                    message=f"{p.action_type} and {clash} cannot both be applied to {p.asset_id}.",
                )
            )
        for rule in constraints.prerequisites:
            if rule.action == p.action_type and rule.requires not in by_asset[p.asset_id]:
                prereq_missing += 1
                issues.append(
                    ApiIssue(
                        path=p.path,
                        code="missing_prerequisite",
                        message=f"{p.action_type} on {p.asset_id} requires {rule.requires} on "
                        "the same asset.",
                    )
                )
    if constraints.incompatible and not conflicts:
        checks.append("No incompatible actions are combined on one asset.")
    if constraints.prerequisites and not prereq_missing:
        checks.append("Every prerequisite is present.")
    return issues, checks
