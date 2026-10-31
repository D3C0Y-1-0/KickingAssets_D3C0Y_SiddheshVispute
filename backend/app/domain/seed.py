"""Deterministic fixture authoring. These are fictional configurations, not scan results."""

import json
from pathlib import Path

from app.schemas.models import ScenarioBundle

ROOT = Path(__file__).resolve().parents[3]
SEED_PATH = ROOT / "data" / "scenarios" / "aurora-city.json"
SCENARIO_ID = "aurora-city"
SNAPSHOT_ID = "aurora-baseline-v1"
TIME = "2026-10-01T09:00:00Z"


def make_bundle() -> ScenarioBundle:
    provenance = {
        "kind": "scenario_assumption",
        "source": "Aurora City fixture v1",
        "recorded_at": TIME,
        "notes": "Fictional scenario. No live infrastructure or scans.",
    }
    context = {"scenario_id": SCENARIO_ID, "snapshot_id": SNAPSHOT_ID}
    names = {
        "power": [
            "North Grid Gateway",
            "North Substation PLC",
            "South Substation PLC",
            "Grid Operator Workstation",
            "Energy Historian",
            "Transformer Sensor Array",
            "Feeder Protection Relay",
            "Dispatch Control Server",
            "Microgrid Controller",
            "Emergency Power Backup",
        ],
        "water": [
            "Waterworks Access Gateway",
            "River Intake PLC",
            "Treatment Process PLC",
            "Water Operator Workstation",
            "Water Quality Historian",
            "Reservoir Sensor Array",
            "Distribution Pump Controller",
            "Waterworks Control Server",
            "Pressure Management PLC",
            "Waterworks Backup Controller",
        ],
        "healthcare": [
            "Central Hospital Gateway",
            "Clinical Systems Controller",
            "HVAC Plant Controller",
            "Clinical Engineering Workstation",
            "Patient Systems Server",
            "Cold Chain Sensor Array",
            "Medical Gas Controller",
            "Hospital Operations Server",
            "Emergency Ward Controller",
            "Hospital Backup Generator",
        ],
    }
    types = [
        "gateway",
        "controller",
        "controller",
        "workstation",
        "server",
        "sensor",
        "controller",
        "server",
        "controller",
        "backup",
    ]
    assets = []
    for sector, sector_names in names.items():
        prefix = {"power": "PWR", "water": "WTR", "healthcare": "HLT"}[sector]
        for index, name in enumerate(sector_names, 1):
            assets.append(
                {
                    **context,
                    "id": f"{prefix}-{index:03}",
                    "name": name,
                    "sector": sector,
                    "asset_type": types[index - 1],
                    "site": {
                        "power": "North Energy Campus",
                        "water": "Riverside Waterworks",
                        "healthcare": "Aurora Central Hospital",
                    }[sector],
                    "vendor": "Aurora Systems (fictional)",
                    "product": f"Sentinel {types[index - 1].title()} Series",
                    "version": f"{2 + index % 3}.{index % 4}.0",
                    "criticality": "essential"
                    if index in [2, 3, 7, 8, 9]
                    else "important"
                    if index in [1, 5, 10]
                    else "supporting",
                    "exposure": "external"
                    if index == 1
                    else "isolated"
                    if index == 10
                    else "internal",
                    "description": f"Fictional {sector} {types[index - 1]} supporting {name.lower()}. Product and version are simulation assumptions; no CVE applicability is claimed.",
                    "security": {
                        "network_zone": "DMZ"
                        if index == 1
                        else "Recovery"
                        if index == 10
                        else "OT control"
                        if index in [2, 3, 6, 7, 9]
                        else "Operations IT",
                        "mfa_enabled": index not in [1, 4],
                        "internet_exposed": index == 1,
                        "remote_access": index in [1, 4, 8],
                        "patch_status": "review_required"
                        if index in [1, 2, 4]
                        else "unknown"
                        if index == 6
                        else "current",
                        "backup_mode": "offline" if index in [8, 10] else "online",
                        "notes": [
                            "Configuration supplied by scenario author; not independently verified."
                        ],
                        "provenance": provenance,
                    },
                    "provenance": provenance,
                }
            )
    cyber_edges, operational_edges = [], []
    for prefix in ["PWR", "WTR", "HLT"]:
        for source, target in [
            (1, 4),
            (4, 8),
            (8, 2),
            (8, 3),
            (8, 7),
            (8, 9),
            (2, 5),
            (3, 5),
            (6, 5),
        ]:
            cyber_edges.append(
                {
                    **context,
                    "id": f"cyber-{prefix}-{source}-{target}",
                    "source_asset_id": f"{prefix}-{source:03}",
                    "target_asset_id": f"{prefix}-{target:03}",
                    "protocol": "HTTPS" if source == 1 else "OPC UA",
                    "access": "remote_management" if source in [1, 4] else "network",
                    "assumptions": [
                        "Configured directional route and protocol permitted in this fictional scenario.",
                        "Reachability does not establish exploitability or successful compromise.",
                    ],
                    "possible_effects": ["loss_of_control", "loss_of_visibility"]
                    if target in [2, 3, 7, 9]
                    else ["data_integrity", "unavailability"],
                    "provenance": provenance,
                }
            )
        for source, target, dependency in [
            (2, 7, "control"),
            (3, 9, "control"),
            (6, 2, "data"),
            (8, 2, "control"),
            (8, 3, "control"),
            (10, 8, "backup"),
        ]:
            operational_edges.append(
                {
                    **context,
                    "id": f"ops-{prefix}-{source}-{target}",
                    "source_asset_id": f"{prefix}-{source:03}",
                    "target_asset_id": f"{prefix}-{target:03}",
                    "dependency": dependency,
                    "requirement": "backup" if source == 10 else "required",
                    "grace_period_minutes": 30 if source == 10 else 0,
                    "assumptions": [
                        "Provider → dependent direction.",
                        "Backup availability and duration require a future conditional service model.",
                    ],
                    "provenance": provenance,
                }
            )
    for source, target, dependency in [
        ("PWR-007", "WTR-007", "power"),
        ("PWR-009", "WTR-007", "power"),
        ("PWR-007", "HLT-008", "power"),
        ("WTR-007", "HLT-003", "water"),
        ("PWR-009", "HLT-008", "power"),
    ]:
        operational_edges.append(
            {
                **context,
                "id": f"ops-{source}-{target}",
                "source_asset_id": source,
                "target_asset_id": target,
                "dependency": dependency,
                "requirement": "redundant" if dependency == "power" else "required",
                "redundancy_group": f"supply-{target}" if dependency == "power" else None,
                "minimum_providers": 1,
                "assumptions": [
                    "Fictional cross-sector service dependency; not a cyber access path."
                ],
                "provenance": provenance,
            }
        )
    services = []
    for sector, prefix, name, desc in [
        (
            "power",
            "PWR",
            "Electricity distribution",
            "Dispatch and distribution to Aurora City's essential sites.",
        ),
        ("water", "WTR", "Clean water supply", "Treatment and distribution of potable water."),
        (
            "healthcare",
            "HLT",
            "Emergency healthcare",
            "Clinical operations and essential hospital facilities.",
        ),
    ]:
        requirements = [
            {
                "id": f"req-{sector}-control",
                "asset_ids": [f"{prefix}-008"],
                "minimum_available": 1,
                "role": "primary",
            },
            {
                "id": f"req-{sector}-supply",
                "asset_ids": [f"{prefix}-007", f"{prefix}-009"],
                "minimum_available": 2 if sector == "healthcare" else 1,
                "role": "primary",
            },
        ]
        if sector in {"water", "healthcare"}:
            requirements.append(
                {
                    "id": f"req-{sector}-power",
                    "asset_ids": ["PWR-007", "PWR-009"],
                    "minimum_available": 1,
                    "role": "primary",
                }
            )
        if sector == "healthcare":
            requirements.append(
                {
                    "id": "req-healthcare-water",
                    "asset_ids": ["WTR-007"],
                    "minimum_available": 1,
                    "role": "primary",
                }
            )
        requirements.append(
            {
                "id": f"req-{sector}-backup",
                "asset_ids": [f"{prefix}-010"],
                "minimum_available": 1,
                "role": "backup",
                "backup_duration_minutes": 480 if sector == "healthcare" else 240,
                "activation_delay_minutes": 5,
                "substitutes_requirement_id": f"req-{sector}-power"
                if sector == "healthcare"
                else f"req-{sector}-control",
                "activation_condition": "Local power interruption only; does not replace a compromised controller or server."
                if sector != "water"
                else "Control-server unavailability only, assuming a clean, isolated spare and validated configuration.",
            }
        )
        services.append(
            {
                **context,
                "id": f"svc-{sector}",
                "name": name,
                "sector": sector,
                "description": desc,
                "requirements": requirements,
                "assumptions": [
                    "All primary requirement groups must be satisfied; members of each group use k-of-n availability.",
                    "Each backup conditionally substitutes only its named primary requirement; activation delay and duration must be evaluated.",
                    "Backup power cannot repair compromised controls or corrupted data.",
                    "No live service status or disruption estimate is available.",
                ],
                "provenance": provenance,
            }
        )
    return ScenarioBundle.model_validate(
        {
            "scenario": {
                "id": SCENARIO_ID,
                "name": "Aurora City",
                "description": "Fictional three-sector critical infrastructure demonstrator.",
                "current_snapshot_id": SNAPSHOT_ID,
                "is_sample": True,
                "seed_version": "1.0.0",
                "created_at": TIME,
                "provenance": provenance,
            },
            "snapshot": {
                **context,
                "name": "Baseline · 01 Oct 2026",
                "created_at": TIME,
                "state": "current",
                "provenance": provenance,
            },
            "assets": assets,
            "cyber_edges": cyber_edges,
            "operational_edges": operational_edges,
            "services": services,
        }
    )


def write_fixture() -> None:
    SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
    SEED_PATH.write_text(
        json.dumps(make_bundle().model_dump(mode="json"), indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    write_fixture()
    print(f"Wrote deterministic fixture: {SEED_PATH.name}")
