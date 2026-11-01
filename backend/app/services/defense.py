"""Orchestrates the attacker view, cheapest cut and reaction plan for the latest simulation."""

from collections.abc import Mapping

from app.engine import defense as engine
from app.engine.attack_path import AnalysisConfig, AttackPathAnalysis, AttackPathEngine, Controls
from app.engine.attack_path.adapter import evidence_from_run, from_bundle
from app.engine.impact import ConditionalImpactEngine
from app.engine.pivot import DEFAULT_EFFECT
from app.schemas.defense import (
    AttackerRoute,
    AttackerView,
    CutAsset,
    CutPlan,
    ReactionPlan,
    ReactionStep,
    RouteFrame,
    ServiceLoss,
    SpreadItem,
)
from app.schemas.models import ScenarioBundle

MAX_ROUTES = 8
ROUTES_PER_TARGET = 10

ASSUMPTIONS = (
    "A route is plausible on paper from configuration and public vulnerability evidence; it is "
    "not proof that an attacker could or would succeed.",
    "Taking over an asset is assumed to have the default effect for its type (scenario "
    "assumption). Services are judged by the conditional impact engine with redundancy and "
    "backups; there is no operator recovery, so results are an upper bound.",
    "Segmentation is assumed to remove an asset's configured cyber routes in both directions "
    f"and to cost {engine.SEGMENTATION_HOURS:g} effort hours per asset. Nothing is applied.",
)


def _data(ctx, isolated: frozenset[str] = frozenset()):
    return from_bundle(ctx.bundle, evidence_from_run(ctx.run), Controls(isolated_assets=isolated))


class _Impact:
    def __init__(self, bundle: ScenarioBundle) -> None:
        self._bundle = bundle
        self._engine = ConditionalImpactEngine()
        self._names = {s.id: s.name for s in bundle.services}
        self._types = {a.id: a.asset_type for a in bundle.assets}
        self._cache: dict[tuple[tuple[str, str], ...], tuple[ServiceLoss, ...]] = {}

    def effect(self, asset_id: str) -> str:
        return DEFAULT_EFFECT.get(self._types[asset_id], "loss_of_control")

    def joint(self, compromised: Mapping[str, str]) -> tuple[ServiceLoss, ...]:
        key = tuple(sorted(compromised.items()))
        if key not in self._cache:
            analysis = self._engine.analyze(self._bundle, dict(compromised))
            self._cache[key] = tuple(
                ServiceLoss(
                    service_id=s.service_id,
                    service_name=self._names.get(s.service_id, s.service_id),
                    fraction=s.disruption_fraction,
                )
                for s in analysis.services
            )
        return self._cache[key]


def _worst(services: tuple[ServiceLoss, ...]) -> float | None:
    values = [s.fraction for s in services if s.fraction is not None]
    return max(values) if values else None


def _analysis(ctx, isolated: frozenset[str] = frozenset()) -> AttackPathAnalysis:
    return AttackPathEngine().analyze(
        _data(ctx, isolated), AnalysisConfig(max_paths_per_target=ROUTES_PER_TARGET)
    )


def attacker_view(ctx) -> AttackerView:
    analysis = _analysis(ctx)
    impact = _Impact(ctx.bundle)
    names = {a.id: a.name for a in ctx.bundle.assets}
    seen: set[str] = set()
    routes: list[AttackerRoute] = []
    for path in analysis.paths:  # already ranked: status, score, criticality, hops
        if path.target in seen:
            continue
        seen.add(path.target)
        frames = tuple(
            RouteFrame(
                step=i + 1,
                asset_id=node,
                asset_name=names[node],
                effect=impact.effect(node),
                hop_status=path.hops[i].status,
                note=path.hops[i].explanation,
                services=(
                    joint := impact.joint({n: impact.effect(n) for n in path.nodes[: i + 1]})
                ),
                worst=_worst(joint),
            )
            for i, node in enumerate(path.nodes)
        )
        routes.append(
            AttackerRoute(
                rank=len(routes) + 1,
                entry_point=path.entry_point,
                target=path.target,
                target_name=names[path.target],
                status=path.status,
                ranking_score=path.ranking_score,
                nodes=path.nodes,
                explanation=path.explanation,
                frames=frames,
            )
        )
        if len(routes) == MAX_ROUTES:
            break
    unreached = tuple(sorted(set(analysis.targets) - {p.target for p in analysis.paths}))
    return AttackerView(
        method_version=engine.ENGINE_VERSION,
        entry_points=analysis.entry_points,
        targets=analysis.targets,
        routes=tuple(routes),
        unreached_targets=unreached,
        assumptions=ASSUMPTIONS,
    )


def _cut_assets(ctx, sg: engine.StepGraph, cut: frozenset[str], through: dict[str, int]):
    out = []
    for asset_id in sorted(cut):
        a = sg.assets[asset_id]
        role = (
            "target" if asset_id in sg.targets else "entry" if asset_id in sg.entries else "pivot"
        )
        out.append(
            CutAsset(
                asset_id=asset_id,
                name=a.name,
                sector=a.sector,
                criticality=a.criticality,
                role=role,
                cost_hours=engine.SEGMENTATION_HOURS,
                routes_through=through.get(asset_id, 0),
            )
        )
    return tuple(out)


def _through(analysis: AttackPathAnalysis) -> dict[str, int]:
    counts: dict[str, int] = {}
    for path in analysis.paths:
        for node in path.nodes:
            counts[node] = counts.get(node, 0) + 1
    return counts


def _reachable_count(analysis: AttackPathAnalysis) -> int:
    return sum(1 for t in analysis.target_reachability if t.supported_paths > 0)


def prevention(ctx) -> CutPlan:
    sg = engine.step_graph(_data(ctx))
    before = _analysis(ctx)
    through = _through(before)
    everything = engine.SEGMENTATION_HOURS * len(through)
    cut = engine.min_cut(sg, sg.entries, sg.targets, {})
    if cut is None:
        status, cut = "cannot_cut", frozenset()
    elif not cut:
        status = "nothing_to_cut"
    else:
        status = "cut_found"
    after = _analysis(ctx, cut) if cut else before
    assets = _cut_assets(ctx, sg, cut, through)
    return CutPlan(
        method_version=engine.ENGINE_VERSION,
        status=status,
        assets=assets,
        total_hours=sum(a.cost_hours for a in assets),
        isolate_everything_hours=everything,
        routes_before=len(before.paths),
        routes_after=len(after.paths) if cut else len(before.paths),
        targets_before=_reachable_count(before),
        targets_after=_reachable_count(after) if cut else _reachable_count(before),
        protected_targets=tuple(
            sorted(
                {p.target for p in before.paths} - {p.target for p in after.paths} if cut else set()
            )
        ),
        verified_by="attack-path engine re-run with these assets isolated",
        assumptions=ASSUMPTIONS,
    )


def reaction(ctx, asset_id: str) -> ReactionPlan:
    data = _data(ctx)
    sg = engine.step_graph(data)
    if asset_id not in sg.assets:
        raise KeyError(asset_id)
    impact = _Impact(ctx.bundle)
    source = (asset_id,)
    reached = engine.spread(sg, source)
    targets = engine.reachable_targets(sg, source)
    cut = engine.min_cut(sg, source, targets, {}, locked=frozenset(source))
    cut = cut or frozenset()
    after_sg = engine.step_graph(_data(ctx, cut)) if cut else sg
    targets_after = len(engine.reachable_targets(after_sg, source))
    spread_items = tuple(
        SpreadItem(
            asset_id=r.asset_id,
            name=sg.assets[r.asset_id].name,
            criticality=sg.assets[r.asset_id].criticality,
            depth=r.depth,
            via=r.via,
            hop_status=r.hop.status,
            explanation=r.hop.explanation,
            worst_disruption=_worst(impact.joint({r.asset_id: impact.effect(r.asset_id)})),
        )
        for r in reached
    )
    offline = impact.joint({asset_id: "unavailability"})
    through = {a: 1 for a in cut}
    block = _cut_assets(ctx, sg, cut, through)
    block_hours = sum(a.cost_hours for a in block)
    name = sg.assets[asset_id].name
    lost = [s.service_name for s in offline if (s.fraction or 0) > 0]
    steps = [
        ReactionStep(
            order=1,
            kind="contain",
            title=f"Isolate {name}",
            detail="Take it off the network so it cannot be used to move further. "
            + (
                f"Switching it off would also affect: {', '.join(lost)}."
                if lost
                else "Switching it off would not stop any essential service on its own."
            ),
            assets=(asset_id,),
            hours=None,
        )
    ]
    if cut:
        steps.append(
            ReactionStep(
                order=len(steps) + 1,
                kind="block",
                title="Block the routes towards critical assets",
                detail="Segment these assets so no remaining route reaches a critical asset: "
                + ", ".join(sg.assets[a].name for a in sorted(cut))
                + ".",
                assets=tuple(sorted(cut)),
                hours=block_hours,
            )
        )
    nearest = tuple(r.asset_id for r in reached if r.depth == 1)
    if nearest:
        steps.append(
            ReactionStep(
                order=len(steps) + 1,
                kind="watch",
                title="Watch the assets it can reach first",
                detail="Check these for odd behaviour before anything else: "
                + ", ".join(sg.assets[a].name for a in nearest)
                + ".",
                assets=nearest,
                hours=None,
            )
        )
    steps.append(
        ReactionStep(
            order=len(steps) + 1,
            kind="recover",
            title="Check, clean and restore",
            detail="Confirm what happened, remove the cause, restore from a known-good copy, "
            "then reconnect step by step. This is a manual process; no recovery time is modelled.",
            assets=(),
            hours=None,
        )
    )
    return ReactionPlan(
        method_version=engine.ENGINE_VERSION,
        compromised=asset_id,
        compromised_name=name,
        spread=spread_items,
        targets_reached=targets,
        isolate_source_disruption=_worst(offline),
        isolate_source_services=offline,
        block_assets=block,
        block_hours=block_hours,
        targets_after_block=targets_after,
        steps=tuple(steps),
        assumptions=ASSUMPTIONS,
    )
