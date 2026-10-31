"""Small hand-built scenarios for impact tests. Independent of the Aurora seed."""

from datetime import UTC, datetime

from app.schemas.models import ScenarioBundle

TIME = "2026-10-01T09:00:00Z"
FIXED_NOW = datetime(2026, 10, 2, 8, 0, tzinfo=UTC)
CONTEXT = {"scenario_id": "unit", "snapshot_id": "unit-v1"}
PROVENANCE = {
    "kind": "scenario_assumption",
    "source": "unit test",
    "recorded_at": TIME,
}


def asset(asset_id: str, asset_type: str = "controller") -> dict:
    return {
        **CONTEXT,
        "id": asset_id,
        "name": asset_id,
        "sector": "power",
        "asset_type": asset_type,
        "site": "Test",
        "vendor": "Fictional",
        "product": "Test",
        "version": "1.0.0",
        "criticality": "important",
        "exposure": "internal",
        "description": "Test asset",
        "security": {"network_zone": "OT control", "provenance": PROVENANCE},
        "provenance": PROVENANCE,
    }


def edge(
    source: str,
    target: str,
    dependency: str = "control",
    requirement: str = "required",
    *,
    group: str | None = None,
    minimum: int = 1,
    grace: int = 0,
    edge_id: str | None = None,
) -> dict:
    return {
        **CONTEXT,
        "id": edge_id or f"ops-{source}-{target}-{dependency}",
        "kind": "operational",
        "source_asset_id": source,
        "target_asset_id": target,
        "dependency": dependency,
        "requirement": requirement,
        "redundancy_group": group,
        "minimum_providers": minimum,
        "grace_period_minutes": grace,
        "assumptions": ["Provider to dependent."],
        "provenance": PROVENANCE,
    }


def primary(req_id: str, members: list[str], minimum: int = 1) -> dict:
    return {"id": req_id, "asset_ids": members, "minimum_available": minimum, "role": "primary"}


def backup(
    req_id: str,
    members: list[str],
    substitutes: str,
    *,
    delay: int = 5,
    duration: int = 240,
) -> dict:
    return {
        "id": req_id,
        "asset_ids": members,
        "minimum_available": 1,
        "role": "backup",
        "backup_duration_minutes": duration,
        "activation_delay_minutes": delay,
        "substitutes_requirement_id": substitutes,
        "activation_condition": "Unit-test activation condition.",
    }


def service(service_id: str, requirements: list[dict]) -> dict:
    return {
        **CONTEXT,
        "id": service_id,
        "name": service_id,
        "sector": "power",
        "description": "Test service",
        "requirements": requirements,
        "assumptions": ["Unit test."],
        "provenance": PROVENANCE,
    }


def bundle(
    asset_ids: list[str],
    edges: list[dict],
    services: list[dict],
    *,
    types: dict[str, str] | None = None,
) -> ScenarioBundle:
    types = types or {}
    return ScenarioBundle.model_validate(
        {
            "scenario": {
                "id": "unit",
                "name": "Unit",
                "description": "Unit scenario",
                "current_snapshot_id": "unit-v1",
                "is_sample": True,
                "seed_version": "test",
                "created_at": TIME,
                "provenance": PROVENANCE,
            },
            "snapshot": {
                **CONTEXT,
                "name": "Unit snapshot",
                "created_at": TIME,
                "state": "current",
                "provenance": PROVENANCE,
            },
            "assets": [asset(a, types.get(a, "controller")) for a in asset_ids],
            "cyber_edges": [],
            "operational_edges": edges,
            "services": services,
        }
    )
