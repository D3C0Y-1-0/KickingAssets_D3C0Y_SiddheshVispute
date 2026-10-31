import json
from datetime import date, timedelta

from app.domain.seed import ROOT
from app.engine import telemetry as tm
from app.services.insights import load_events, load_telemetry_inputs

END = date(2026, 10, 1)


def _inputs():
    assets, events, telemetry = load_telemetry_inputs()
    return assets, events, telemetry


def test_generation_is_deterministic_and_covers_every_asset_metric():
    assets, events, first = _inputs()
    _, _, second = _inputs()
    assert first.series == second.series
    assert first.days[-1] == END and len(first.days) == tm.WINDOW_DAYS
    for asset in assets:
        for metric in tm.metrics_for(asset.asset_type):
            assert len(first.series[(asset.id, metric)]) == tm.WINDOW_DAYS
    # OT write commands exist only for controllers.
    assert ("PWR-002", "ot_writes") in first.series and ("PWR-001", "ot_writes") not in first.series


def test_detector_never_reads_samples_after_as_of():
    assets, events, telemetry = _inputs()
    cutoff = END - timedelta(days=10)
    early = tm.detect(telemetry, assets, as_of=cutoff)
    # Corrupt every sample after the cutoff; the early result must not change.
    index = telemetry.days.index(cutoff)
    poisoned = tm.Telemetry(
        telemetry.days,
        {
            k: v[: index + 1] + tuple(1e9 for _ in v[index + 1 :])
            for k, v in telemetry.series.items()
        },
    )
    assert tm.detect(poisoned, assets, as_of=cutoff) == early
    assert early[-1].day == cutoff


def test_every_malicious_event_is_detected_and_the_benign_one_is_a_documented_false_positive():
    assets, events, telemetry = _inputs()
    results = {r.day: r for r in tm.detect(telemetry, assets)}
    for event in events:
        flagged_days = [
            d
            for d in (
                event.start + timedelta(days=i) for i in range((event.end - event.start).days + 1)
            )
            if results[d].assets[event.asset_id].anomaly > 0
        ]
        assert flagged_days, f"{event.id} was not flagged"  # includes the benign maintenance window
    benign = next(e for e in events if e.benign)
    assert results[benign.start].assets[benign.asset_id].anomaly > 0


def test_clean_assets_stay_quiet_most_days():
    assets, events, telemetry = _inputs()
    event_assets = {e.asset_id for e in events}
    results = tm.detect(telemetry, assets)
    clean = [a.id for a in assets if a.id not in event_assets]
    flagged = sum(1 for r in results for a in clean if r.assets[a].anomaly > 0)
    assert flagged / (len(results) * len(clean)) < 0.03


def test_zero_spread_history_does_not_divide_by_zero():
    z, baseline = tm.robust_z([5.0] * 28, 5.0, "failed_logins")
    assert z == 0 and baseline == 5.0
    z, _ = tm.robust_z([0.0] * 28, 3.0, "failed_logins")
    assert z == 3.0 / tm.ABSOLUTE_FLOOR["failed_logins"]


def test_scoring_and_bands_and_urgency():
    assert tm.anomaly_score(3.0, 0) == 0.0
    assert 0 < tm.anomaly_score(5.0, 1) < tm.anomaly_score(12.0, 1) <= 1.0
    assert tm.anomaly_score(5.0, 3) > tm.anomaly_score(5.0, 1)
    assert [tm.band(v) for v in (0, 14.99, 15, 39.99, 40)] == [
        "calm",
        "calm",
        "elevated",
        "elevated",
        "active",
    ]
    assert tm.urgency(None, 1.0) is None  # unavailable, never zero
    assert tm.urgency(40.0, 1.0) == 60.0 and tm.urgency(40.0, 0.0) == 40.0


def test_event_file_is_labelled_simulation_and_matches_loader():
    doc = json.loads(
        (ROOT / "data" / "scenarios" / "aurora-telemetry-events.json").read_text("utf-8")
    )
    assert doc["provenance"]["kind"] == "simulation"
    events = load_events()
    assert [e.id for e in events] == [e["id"] for e in doc["events"]]
    assert all(e.start <= e.end <= END for e in events)
