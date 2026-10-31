"""Run-bound resilience catalog, prevention assumptions and optimization orchestration."""

import hashlib
import json
from datetime import UTC, datetime

from app.engine.attack_path import AnalysisConfig, AttackPathEngine, Controls
from app.engine.attack_path.adapter import evidence_from_run, from_bundle
from app.engine.preventive_failure import ENGINE_VERSION, simulate_failures, standbys
from app.engine.preventive_optimizer import infeasible, objective, optimize_subsets, totals
from app.schemas.models import ApiIssue
from app.schemas.preventive import (
    Binding,
    Catalog,
    ChallengeOutcome,
    Comparison,
    Evaluation,
    EvaluationRequest,
    Failure,
    Intervention,
    Optimization,
    OptimizationRequest,
    RejectedAlternative,
    StressOutcome,
    StressReport,
    StressRequest,
)
from app.schemas.simulation import StagedActionRequest, WhatIfRequest
from app.services import simulation
from app.services.remediation import RemediationError, candidate_map

CATALOG_VERSION = "aurora-preventive-catalog-v1"
ASSUMPTIONS = [
    "Synthetic Aurora planning assumptions; no intervention is executed or verified.",
    "Objective is equal-weight service-disruption minutes under explicit simultaneous events, "
    "not expected loss, incident probability or the existing city risk index.",
    "Costs are synthetic planning credits, not currency, quotations or real procurement costs. "
    "Effort/downtime are summed pre-incident maintenance limits, not incident outage time.",
    "A recovery intervention assumes a clean, validated restore within 60 minutes from onset. "
    "Dependents restore when their providers do; repair cannot bypass another failed dependency.",
    "Existing standby sources, named substitution groups and backup edges are reused. "
    "Only explicitly assumed power-loss unavailability is covered; no control/data compromise "
    "is repaired. Activation uses the larger of requirement delay and backup-edge grace.",
    "Standby usable energy limits full-output runtime. Consumption is continuous after first "
    "activation; no refuelling, fractional-load process model or extra provider capacity is assumed.",
    "A standby's single energy window is shared by its service substitution and its configured "
    "dependent. New electrical topology, real ratings and competing load allocation are not inferred.",
    "Cyber challenges assume only the named target is compromised if a candidate route is supported. "
    "They are scenarios, not observed exploits. Segmentation disconnects cyber edges only; "
    "a patch prevents only an explicitly attributed, fixed-version-supported CVE challenge.",
    "Naming a CVE assumes it is the sole enabling cause of the requested effect. Product/version "
    "applicability is verified against reference ranges, but CVE exploit-vector/effect attribution "
    "is a user scenario assumption, not a verified property of that vulnerability.",
    "Unattributed cyber scenarios and direct already-assumed failures are not prevented by patches. "
    "KEV/ML evidence does not prove an exploit vector. Bounded path enumeration cannot prove safety.",
    "Integer-minute event simulation uses the existing effect policy and k-of-n operational groups; "
    "cycles use the greatest available fixed point. No independent dependent restart delay is assumed.",
    "Optional legacy risk projection covers patch/segmentation only; recovery and standby "
    "benefits belong to this service-continuity model and never change the original risk formula.",
]


def digest(value) -> str:
    return hashlib.sha256(
        json.dumps(
            value, sort_keys=True, separators=(",", ":"), default=str, allow_nan=False
        ).encode()
    ).hexdigest()


def fail(code: str, message: str, path: str, *, status=422):
    raise RemediationError(status, code, message, [ApiIssue(path=path, code=code, message=message)])


def unique(values, path):
    if len(values) != len(set(values)):
        fail("duplicate_value", "Values must be unique", path)


def catalog(ctx) -> Catalog:
    actions = []
    # Original What-If definitions/evidence own patch and segmentation effort/downtime.
    for a in sorted(ctx.bundle.assets, key=lambda a: a.id):
        patch = ctx.default_patch(a.id)
        if patch.cves:
            definition = simulation.ACTIONS["patch_prioritization"]
            actions.append(
                Intervention(
                    id=f"patch-{a.id}",
                    asset_id=a.id,
                    action_type="patch",
                    cost_credits=3,
                    effort_hours=patch.effort_hours,
                    downtime_hours=definition.downtime_hours,
                    patch=patch.outcome(),
                    preconditions=[definition.operational_disruption],
                    modelled_effect="Prevent only a named CVE challenge included in this documented-fix batch.",
                    evidence_ids=sorted(patch.cves),
                )
            )
        definition = simulation.ACTIONS["network_segmentation"]
        actions.append(
            Intervention(
                id=f"segment-{a.id}",
                asset_id=a.id,
                action_type="segmentation",
                cost_credits=5,
                effort_hours=definition.effort_hours,
                downtime_hours=definition.downtime_hours,
                preconditions=[
                    definition.operational_disruption,
                    "Validate essential communications before full cyber isolation.",
                ],
                modelled_effect="Remove incident cyber routes through this asset, not operational edges.",
                evidence_ids=[
                    e.id
                    for e in ctx.bundle.cyber_edges
                    if a.id in (e.source_asset_id, e.target_asset_id)
                ],
            )
        )
        actions.append(
            Intervention(
                id=f"recover-{a.id}",
                asset_id=a.id,
                action_type="recovery",
                cost_credits=4,
                effort_hours=8.0,
                downtime_hours=1.0,
                recovery_minutes=60,
                preconditions=[
                    "Assume tested clean backup/configuration, available crew and safe restart.",
                    "Restoration target is synthetic and not demonstrated on real equipment.",
                ],
                modelled_effect="Cap direct initiating failure duration at 60 minutes; dependencies still apply.",
                evidence_ids=[a.id, "synthetic-recovery-policy-v1"],
            )
        )
    for p in standbys(ctx.bundle):
        if len(p.members) != 1:
            continue  # no invented allocation for a multi-provider standby group
        actions.append(
            Intervention(
                id=f"backup-{p.members[0]}",
                asset_id=p.members[0],
                action_type="backup_power",
                cost_credits=12,
                effort_hours=16.0,
                downtime_hours=2.0,
                added_backup_minutes=240,
                preconditions=[
                    "Assume validated nominal-output fuel/energy extension of 240 minutes.",
                    p.condition,
                    "Does not create a provider, edge or new service substitution.",
                ],
                modelled_effect="Extend the existing named standby's stored-energy runtime by 240 minutes.",
                evidence_ids=[p.id, *p.targets, "synthetic-standby-extension-v1"],
            )
        )
    actions.sort(key=lambda a: a.id)
    fp = digest(
        {
            "version": CATALOG_VERSION,
            "bundle": ctx.bundle.model_dump(mode="json"),
            "actions": [a.model_dump(mode="json") for a in actions],
            "assumptions": ASSUMPTIONS,
        }
    )
    return Catalog(
        scenario_id=ctx.run.scenario_id,
        snapshot_id=ctx.run.snapshot_id,
        run_id=ctx.run.id,
        baseline_fingerprint=ctx.run.fingerprint,
        baseline_created_at=ctx.run.created_at,
        baseline_as_of=ctx.run.as_of,
        model_version=ctx.run.model_version,
        catalog_version=CATALOG_VERSION,
        catalog_fingerprint=fp,
        interventions=actions,
        assumptions=ASSUMPTIONS,
    )


class Evaluator:
    def __init__(self, ctx, request: EvaluationRequest):
        self.ctx, self.request = ctx, request
        self.catalog = catalog(ctx)
        if request.catalog_fingerprint != self.catalog.catalog_fingerprint:
            fail(
                "catalog_mismatch",
                "Catalog assumptions/evidence changed; retrieve the catalog again.",
                "catalog_fingerprint",
                status=409,
            )
        self.actions = {a.id: a for a in self.catalog.interventions}
        self.assets = {a.id: a for a in ctx.bundle.assets}
        unique(request.intervention_ids, "intervention_ids")
        for i, action_id in enumerate(request.intervention_ids):
            if action_id not in self.actions:
                fail(
                    "unknown_intervention",
                    "Unknown or unsupported intervention",
                    f"intervention_ids[{i}]",
                )
        for i, f in enumerate(request.scenario.failures):
            if f.asset_id not in self.assets:
                fail(
                    "unknown_asset", "Unknown initiating asset", f"scenario.failures[{i}].asset_id"
                )
        self.route_cache, self.outcome_cache = {}, {}
        for i, c in enumerate(request.scenario.cyber_challenges):
            if c.entry_asset_id not in self.assets or c.target_asset_id not in self.assets:
                fail(
                    "unknown_asset",
                    "Unknown cyber challenge endpoint",
                    f"scenario.cyber_challenges[{i}]",
                )
            if self.assets[c.entry_asset_id].security.internet_exposed is not True:
                fail(
                    "unsupported_entry",
                    "An internet challenge needs declared exposure evidence",
                    f"scenario.cyber_challenges[{i}].entry_asset_id",
                )
            if (
                c.cve_id
                and candidate_map(ctx.evidence[c.target_asset_id]).get(c.cve_id)
                != "version_confirmed"
            ):
                fail(
                    "cve_not_applicable",
                    "Named CVE requires confirmed target-version applicability",
                    f"scenario.cyber_challenges[{i}].cve_id",
                )
            report = self.route(c, ())
            if not any(c.effect in p.final_effects for p in report.paths):
                fail(
                    "unsupported_challenge",
                    "No reported candidate route supports the requested effect; "
                    "this is not proof of safety",
                    f"scenario.cyber_challenges[{i}]",
                )

    def route(self, challenge, isolated):
        key = (challenge.id, tuple(sorted(isolated)))
        if key not in self.route_cache:
            data = from_bundle(
                self.ctx.bundle,
                evidence_from_run(self.ctx.run),
                Controls(isolated_assets=frozenset(isolated)),
            )
            self.route_cache[key] = AttackPathEngine().analyze(
                data,
                AnalysisConfig(
                    entry_points=(challenge.entry_asset_id,),
                    targets=(challenge.target_asset_id,),
                    max_paths_per_target=50,
                    max_hops=20,
                ),
            )
        return self.route_cache[key]

    def outcome(self, ids, stress=None):
        selected = [self.actions[k] for k in ids]
        isolated = tuple(sorted(a.asset_id for a in selected if a.action_type == "segmentation"))
        patched = {(a.asset_id, c.cve_id) for a in selected if a.patch for c in a.patch.remediated}
        failures = list(self.request.scenario.failures)
        challenges = []
        for c in self.request.scenario.cyber_challenges:
            report = self.route(c, isolated)
            # Only plain disconnection proves removal within the configured cyber topology.
            disconnected = (
                c.entry_asset_id in isolated
                or c.target_asset_id in isolated
                or any(not r.reachable for r in report.target_reachability)
            )
            if c.cve_id and (c.target_asset_id, c.cve_id) in patched:
                status, why = (
                    "specified_cve_patched",
                    "Under the explicit sole-CVE attribution assumption, this challenge is removed "
                    "using documented fixed-version evidence; exploit/effect attribution is not verified.",
                )
            elif disconnected:
                status, why = (
                    "route_disconnected",
                    "Full isolation disconnects the declared cyber route; operational edges are unchanged.",
                )
            else:
                status, why = (
                    "assumed_compromise",
                    "Assume target compromise via a candidate route; no success probability or exploit is established.",
                )
                failures.append(
                    Failure(
                        id=c.id,
                        asset_id=c.target_asset_id,
                        cause="cyber",
                        effect=c.effect,
                        recovery_minutes=c.recovery_minutes,
                    )
                )
            challenges.append(
                ChallengeOutcome(
                    challenge_id=c.id,
                    outcome=status,
                    explanation=why,
                    candidate_paths=[list(p.nodes) for p in report.paths],
                )
            )
        energy, disabled = {}, frozenset()
        if stress:
            disabled = frozenset(stress.failed_backup_ids)
            failures.extend(stress.additional_failures)
            failures.extend(
                Failure(id=f"stress-backup-{a}", asset_id=a, cause="hardware_failure")
                for a in disabled
            )
            energy = {c.backup_asset_id: c.usable_energy_fraction for c in stress.backup_capacity}
        recovery = {a.asset_id: a.recovery_minutes for a in selected if a.action_type == "recovery"}
        extension = {
            a.asset_id: a.added_backup_minutes for a in selected if a.action_type == "backup_power"
        }
        key = digest(
            {
                "failures": [f.model_dump() for f in sorted(failures, key=lambda f: f.id)],
                "recovery": recovery,
                "extension": extension,
                "energy": energy,
                "disabled": sorted(disabled),
            }
        )
        if key not in self.outcome_cache:
            self.outcome_cache[key] = simulate_failures(
                self.ctx.bundle,
                tuple(failures),
                self.request.scenario.horizon_minutes,
                recovery=recovery,
                backup_extension=extension,
                energy=energy,
                disabled_backups=disabled,
            )
        return self.outcome_cache[key], challenges

    def comparison(self, ids, stress=None):
        before, _ = self.outcome((), stress)
        after, challenges = self.outcome(ids, stress)
        old = {s.service_id: s.disrupted_minutes for s in before.services}
        return Comparison(
            before=before,
            after=after,
            avoided_service_disruption_minutes=before.total_service_disruption_minutes
            - after.total_service_disruption_minutes,
            improved_service_ids=[
                s.service_id for s in after.services if s.disrupted_minutes < old[s.service_id]
            ],
            fully_protected_service_ids=[
                s.service_id
                for s in after.services
                if old[s.service_id] > 0 and s.disrupted_minutes == 0
            ],
            challenges=challenges,
        )

    def evaluation(self, ids):
        actions = [self.actions[k] for k in sorted(ids)]
        cost, effort, downtime = totals(actions)
        legacy = [
            StagedActionRequest(
                asset_id=a.asset_id,
                action_type="network_segmentation"
                if a.action_type == "segmentation"
                else "patch_prioritization",
                cve_ids=sorted(c.cve_id for c in a.patch.remediated) if a.patch else None,
            )
            for a in actions
            if a.action_type in {"patch", "segmentation"}
        ]
        binding = Binding.model_validate(self.request.model_dump(include=set(Binding.model_fields)))
        projection = (
            simulation.what_if(self.ctx, WhatIfRequest(**binding.model_dump(), actions=legacy))
            if legacy
            else None
        )
        return Evaluation(
            **binding.model_dump(),
            baseline_created_at=self.ctx.run.created_at,
            baseline_as_of=self.ctx.run.as_of,
            model_version=self.ctx.run.model_version,
            scoring_version=self.ctx.run.city_risk.scoring_version,
            catalog_fingerprint=self.catalog.catalog_fingerprint,
            input_fingerprint=digest(
                {
                    "request": self.request.model_dump(mode="json"),
                    "selected": sorted(ids),
                    "engine": ENGINE_VERSION,
                }
            ),
            engine_version=ENGINE_VERSION,
            calculated_at=datetime.now(UTC),
            interventions=actions,
            cost_credits=cost,
            effort_hours=effort,
            downtime_hours=downtime,
            comparison=self.comparison(ids),
            baseline_city_index=self.ctx.run.city_risk.score,
            risk_projection=projection,
            risk_projection_intervention_ids=[
                a.id for a in actions if a.action_type in {"patch", "segmentation"}
            ],
            assumptions=ASSUMPTIONS,
        )


def evaluate(ctx, request):
    return Evaluator(ctx, request).evaluation(tuple(sorted(request.intervention_ids)))


def optimize(ctx, request: OptimizationRequest):
    ev = Evaluator(ctx, request)
    unique(request.excluded_asset_ids, "excluded_asset_ids")
    unique(request.service_ids, "service_ids")
    if not set(request.excluded_asset_ids) <= ev.assets.keys():
        fail("unknown_asset", "Unknown excluded asset", "excluded_asset_ids")
    all_services = {s.id for s in ctx.bundle.services}
    if not set(request.service_ids) <= all_services:
        fail("unknown_service", "Unknown objective service", "service_ids")
    services = set(request.service_ids) or all_services
    candidates = [ev.actions[k] for k in request.intervention_ids]
    selection = optimize_subsets(candidates, request, lambda ids: ev.outcome(ids)[0], services)
    result = ev.evaluation(selection.ids)
    chosen = [ev.actions[k] for k in selection.ids]
    rejected = []
    for action in sorted(candidates, key=lambda a: a.id):
        if action.id in selection.ids:
            continue
        reasons = selection.exclusions[action.id] or infeasible([*chosen, action], request)
        rejected.append(
            RejectedAlternative(
                intervention_id=action.id,
                reasons=reasons or ["not_in_best_subset_under_objective_and_tiebreak"],
                standalone_disruption_minutes=objective(ev.outcome((action.id,))[0], services),
            )
        )
    return Optimization(
        **result.model_dump(),
        objective_service_ids=sorted(services),
        objective_before_minutes=objective(result.comparison.before, services),
        objective_after_minutes=objective(selection.outcome, services),
        subsets_considered=selection.considered,
        feasible_subsets=selection.feasible,
        rejected_alternatives=rejected,
    )


def stress_test(ctx, request: StressRequest):
    ev = Evaluator(ctx, request)
    unique([c.id for c in request.cases], "cases")
    backups = {a for p in standbys(ctx.bundle) for a in p.members}
    base_ids = {f.id for f in request.scenario.failures} | {
        c.id for c in request.scenario.cyber_challenges
    }
    results = []
    nominal = ev.evaluation(tuple(sorted(request.intervention_ids)))
    for i, case in enumerate(request.cases):
        path = f"cases[{i}]"
        unique(case.failed_backup_ids, path + ".failed_backup_ids")
        unique([c.backup_asset_id for c in case.backup_capacity], path + ".backup_capacity")
        unique([f.id for f in case.additional_failures], path + ".additional_failures")
        if not set(case.failed_backup_ids) <= backups or any(
            c.backup_asset_id not in backups for c in case.backup_capacity
        ):
            fail(
                "unknown_backup", "Stress capacity/failure targets must be declared standbys", path
            )
        ids = base_ids | {f.id for f in case.additional_failures}
        if base_ids & {f.id for f in case.additional_failures} or any(
            f"stress-backup-{a}" in ids for a in case.failed_backup_ids
        ):
            fail("duplicate_event", "Stress event IDs collide with another event", path)
        if any(f.asset_id not in ev.assets for f in case.additional_failures):
            fail("unknown_asset", "Unknown additional failure asset", path)
        comparison = ev.comparison(tuple(sorted(request.intervention_ids)), case)
        results.append(
            StressOutcome(
                case=case,
                comparison=comparison,
                extra_projected_disruption_minutes=comparison.after.total_service_disruption_minutes
                - nominal.comparison.after.total_service_disruption_minutes,
            )
        )
    return StressReport(nominal=nominal, cases=results)
