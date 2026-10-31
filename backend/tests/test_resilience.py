from app.domain.product_profiles import load_product_map
from app.engine import resilience as rs
from app.engine.impact import ConditionalImpactEngine
from app.engine.pivot import DEFAULT_EFFECT
from app.services.insights import _fixture_bundle, chokepoint_report, vendor_report


def _vendors():
    return {a: p.vendor for a, p in load_product_map()[0].items()}


def test_vendor_scenario_equals_a_joint_impact_analysis():
    bundle = _fixture_bundle()
    vendors = _vendors()
    result = next(
        r for r in rs.vendor_scenarios(bundle, vendors, DEFAULT_EFFECT) if r.vendor == "Siemens"
    )
    types = {a.id: a.asset_type for a in bundle.assets}
    effects = {a: DEFAULT_EFFECT[types[a]] for a, v in vendors.items() if v == "Siemens"}
    analysis = ConditionalImpactEngine().analyze(bundle, effects)
    assert dict(result.effects) == effects
    assert {s.service_id: s.fraction for s in result.scenario.services} == {
        s.service_id: s.disruption_fraction for s in analysis.services
    }


def test_vendor_report_matches_the_product_map_and_is_sorted_worst_first():
    bundle = _fixture_bundle()
    report = vendor_report(bundle)
    counts = {}
    for vendor in _vendors().values():
        counts[vendor] = counts.get(vendor, 0) + 1
    assert {v.vendor: len(v.assets) for v in report.vendors} == counts
    worst = [(v.worst_disruption if v.worst_disruption is not None else -1) for v in report.vendors]
    assert worst == sorted(worst, reverse=True)
    assert report.provenance.kind == "simulation" and report.assumptions
    for c in report.concentration:
        assert 0 <= c.hhi <= 1 and 0 <= c.top_vendor_share <= 1


def test_concentration_is_one_when_a_single_vendor_supplies_a_service():
    bundle = _fixture_bundle()
    members = rs.service_assets(bundle)
    service = next(iter(members))
    single = {a: "OnlyVendor" for a in members[service]}
    row = next(c for c in rs.concentration(bundle, single) if c.service_id == service)
    assert row.hhi == 1.0 and row.top_vendor == "OnlyVendor" and row.top_share == 1.0


def test_chokepoints_are_consistent_with_the_engine_and_ranked_first():
    bundle = _fixture_bundle()
    results = rs.chokepoints(bundle)
    assert len(results) == len(bundle.assets)
    flags = [r.is_chokepoint for r in results]
    assert flags == sorted(flags, reverse=True)  # chokepoints come before the rest
    top = results[0]
    assert top.is_chokepoint
    direct = ConditionalImpactEngine().analyze(bundle, {top.asset_id: top.worst_effect})
    assert (
        max(s.disruption_fraction or 0 for s in direct.services)
        == top.scenarios[top.worst_effect].worst
    )


def test_an_asset_without_dependents_is_not_a_chokepoint_by_loss_of_visibility():
    bundle = _fixture_bundle()
    only_visibility = rs.chokepoints(bundle, effects=("loss_of_visibility",))
    assert not any(r.is_chokepoint for r in only_visibility)  # visibility stops nothing


def test_chokepoint_report_explains_each_row():
    report = chokepoint_report(_fixture_bundle())
    assert report.chokepoints and all(c.reason for c in report.chokepoints)
    assert report.provenance.kind == "simulation"
