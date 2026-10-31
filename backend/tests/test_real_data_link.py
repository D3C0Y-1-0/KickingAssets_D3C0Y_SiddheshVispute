import json
from datetime import date, timedelta

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.domain.product_profiles import PRODUCT_MAP_PATH, load_product_map
from app.domain.seed import SEED_PATH
from app.main import create_app
from ml import inference
from ml.matching import AffectedIndex, in_range, parse_version

needs_ml = pytest.mark.skipif(
    not inference.status()["ready"], reason="local reference data or model not available"
)


# ------------------------------------------------------------------ version matching (pure)


def test_parse_version_reads_numbers_from_real_world_strings():
    assert parse_version("7.0.12") == (7, 0, 12)
    assert parse_version("V2.9.2") == (2, 9, 2)
    assert parse_version("22.3R1") == (22, 3, 1)
    assert parse_version("10.0.19045.4170") == (10, 0, 19045, 4170)
    assert parse_version("n/a") is None and parse_version(None) is None


def test_in_range_semantics():
    v = (7, 0, 12)
    assert in_range(v, "7.0.0", "7.0.17", None) is True  # inside [start, lessThan)
    assert in_range(v, "7.0.0", "7.0.12", None) is False  # lessThan is exclusive
    assert in_range(v, "7.0.0", None, "7.0.12") is True  # lessThanOrEqual is inclusive
    assert in_range(v, "0", "7.0.1", None) is False
    assert in_range(v, "7.0.12", None, None) is True  # exact
    assert in_range(v, "7.0", None, None) is True  # prefix of the version
    assert in_range(v, "7.2", None, None) is False
    assert in_range(v, "*", None, None) is None  # cannot be evaluated


def test_affected_index_classifies_confirmed_unknown_excluded():
    rows = pd.DataFrame(
        [
            ("CVE-1", "acme", "widgetos", "1.0", "2.0", None, "semver"),  # contains 1.5
            ("CVE-2", "acme", "widgetos", "3.0", "4.0", None, "semver"),  # excludes 1.5
            ("CVE-3", "acme", "widgetos", "*", None, None, None),  # not evaluable
            ("CVE-4", "other", "widgetos", "1.0", "2.0", None, None),  # other vendor
        ],
        columns=[
            "cve_id",
            "vendor",
            "product",
            "version",
            "less_than",
            "less_than_or_equal",
            "version_type",
        ],
    )
    index = AffectedIndex(rows)
    match = index.match("acme", ["widget"], "1.5")
    assert match.confirmed == {"CVE-1"}
    assert match.unknown == {"CVE-3"}
    assert match.excluded == {"CVE-2"}
    assert match.product_known
    assert not index.match("nobody", ["widget"], "1.5").product_known
    # A different assumed version changes which CVEs apply.
    assert index.match("acme", ["widget"], "3.5").confirmed == {"CVE-2"}


# ------------------------------------------------------------------ product map


def test_every_fictional_asset_has_a_real_product_assumption():
    ids = {a["id"] for a in json.loads(SEED_PATH.read_text(encoding="utf-8"))["assets"]}
    products, provenance = load_product_map()
    assert set(products) == ids
    assert provenance["kind"] == "scenario_assumption"
    assert all(p.version and p.nvd_vendor and p.nvd_product_contains for p in products.values())
    assert "not scan results" in PRODUCT_MAP_PATH.read_text(encoding="utf-8")


# ------------------------------------------------------------------ simulation over real data


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = tmp_path_factory.mktemp("reallink")
    with TestClient(create_app(path / "t.sqlite3", static_dir=path / "s")) as c:
        yield c


@needs_ml
def test_snapshots_are_labelled_by_whether_the_model_saw_them(client):
    options = client.get("/api/v1/simulation/snapshots").json()
    by_date = {o["as_of"]: o for o in options}
    assert by_date["2022-06-01"]["held_out"] is False
    assert "training" in by_date["2022-06-01"]["split"]
    assert by_date["2025-06-01"]["held_out"] is True
    assert by_date["2025-06-01"]["outcome_window_closed"] is True
    assert options[0]["outcome_window_closed"] is False  # the newest date has no outcomes yet


@needs_ml
def test_products_endpoint_lists_all_assumptions(client):
    body = client.get("/api/v1/simulation/products").json()
    assert len(body["products"]) == 30
    assert "scan results" in body["provenance_note"]


@needs_ml
def test_run_rejects_a_date_without_a_snapshot(client):
    assert client.post("/api/v1/simulation/run", params={"as_of": "2022-06-15"}).status_code == 422


@needs_ml
def test_time_travel_uses_only_information_available_at_the_date(client):
    as_of = date(2023, 1, 1)
    run = client.post("/api/v1/simulation/run", params={"as_of": as_of.isoformat()}).json()
    assert run["as_of"] == "2023-01-01" and run["held_out"] is False
    assert "training" in run["as_of_split"]
    for asset in run["assets"]:
        for cve in asset["top_vulnerabilities"]:
            published = date.fromisoformat(cve["published"])
            assert published <= as_of  # a CVE that did not exist yet can never be a finding
            if cve["status"] == "scored":
                assert published <= as_of - timedelta(days=30)
            else:
                assert date.fromisoformat(cve["kev_added"]) <= as_of  # listed by then


@needs_ml
def test_outcomes_are_real_kev_additions_inside_the_window(client):
    as_of = date(2024, 1, 1)
    run = client.post("/api/v1/simulation/run", params={"as_of": as_of.isoformat()}).json()
    backtest = run["backtest"]
    assert backtest["window_closed"] and backtest["cves_evaluated"] > 0
    for hit in backtest["hits"]:
        added = date.fromisoformat(hit["kev_added"])
        assert as_of < added <= as_of + timedelta(days=180)
    assert backtest["groups"][0]["hits"] == backtest["became_kev"]
    for asset in run["assets"]:
        for cve in asset["top_vulnerabilities"]:
            if cve["outcome"] == "added_to_kev":
                assert (
                    as_of < date.fromisoformat(cve["outcome_date"]) <= as_of + timedelta(days=180)
                )


@needs_ml
def test_open_window_has_no_backtest_numbers(client):
    run = client.post("/api/v1/simulation/run").json()  # latest snapshot
    assert run["backtest"]["window_closed"] is False
    assert run["backtest"]["groups"] == [] and run["backtest"]["became_kev"] == 0


@needs_ml
def test_matching_tallies_are_consistent_and_zero_is_not_missing(client):
    run = client.post("/api/v1/simulation/run").json()
    for asset in run["assets"]:
        m = asset["matching"]
        assert m["scored"] + m["kev_listed"] == asset["candidate_count"]
        assert asset["history"]["by_year"] and asset["product"]["version"]
        if asset["candidate_count"] == 0 and m["product_known"]:
            assert asset["vulnerability_signal"] == 0.0 and asset["risk"]["status"] == "computed"
        if not m["product_known"]:
            assert asset["risk"]["status"] == "unavailable"
    confirmed = {a["asset_id"]: a["matching"]["version_confirmed"] for a in run["assets"]}
    assert len(set(confirmed.values())) > 5  # different products and versions differ


@needs_ml
def test_pooled_backtest_counts_are_coherent(client):
    body = client.get("/api/v1/simulation/backtest").json()
    assert date.fromisoformat(body["first_snapshot"]) >= date(2025, 1, 1)  # held-out months only
    groups = {g["label"]: g for g in body["groups"]}
    assert groups["All applicable candidates"]["cves"] == body["pairs_evaluated"]
    assert groups["All applicable candidates"]["hits"] == body["hit_pairs"]
    assert groups["ML top 10%"]["cves"] + groups["ML other 90%"]["cves"] == body["pairs_evaluated"]
    assert body["distinct_hit_cves"] <= body["hit_pairs"]
    for hit in body["hits"]:
        assert date.fromisoformat(hit["first_flagged"]) < date.fromisoformat(hit["kev_added"])
