"""API context around the unchanged pure attack-path engine's analysis."""

from typing import Literal

from app.engine.attack_path.models import AttackPathAnalysis


class AttackPathReport(AttackPathAnalysis):
    scenario_id: str
    snapshot_id: str
    run_id: str
    baseline_fingerprint: str
    state: Literal["current", "projected"]
    isolated_assets: tuple[str, ...]
