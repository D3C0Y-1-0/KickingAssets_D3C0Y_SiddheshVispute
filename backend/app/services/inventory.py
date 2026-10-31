from pathlib import Path

from fastapi import HTTPException

from app.db.store import read_documents
from app.domain.seed import SCENARIO_ID
from app.schemas.models import Scenario


class Inventory:
    def __init__(self, path: Path):
        self.path = path

    def context(
        self, scenario_id: str = SCENARIO_ID, snapshot_id: str | None = None
    ) -> tuple[str, str]:
        scenarios = read_documents(self.path, "scenarios", scenario_id)
        if not scenarios:
            raise HTTPException(404, "Scenario not found")
        scenario = Scenario.model_validate(scenarios[0])
        snapshot = snapshot_id or scenario.current_snapshot_id
        if not read_documents(self.path, "snapshots", scenario_id, snapshot):
            raise HTTPException(404, "Snapshot not found in this scenario")
        return scenario_id, snapshot

    def collection(self, table: str, scenario_id: str, snapshot_id: str) -> list[dict]:
        return read_documents(self.path, table, scenario_id, snapshot_id)
