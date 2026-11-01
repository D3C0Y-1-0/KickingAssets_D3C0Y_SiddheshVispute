"""Additive SOC contracts. Observations are never infrastructure-compromise probabilities."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.simulation import (
    ActionOption,
    AssetSimulation,
    BaselineBinding,
    PlanHandoffRequest,
    WhatIfResult,
)


class SocContract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SocSession(SocContract):
    operator: bool


class SocEvent(SocContract):
    id: int
    timestamp: str
    source_ip: str
    asset_id: str | None
    category: str
    severity: Literal["info", "medium", "high", "critical"]
    outcome: str
    method: str
    path: str
    status: int
    latency_ms: float
    explanation: str
    rule_version: str = "soc-rules-v1"


class SocNode(SocContract):
    asset_id: str
    name: str
    scenario: str
    path: str
    protected: bool


class SocBlock(SocContract):
    ip: str
    reason: str
    expires_at: float


class SocSnapshot(SocContract):
    gateway_port: int = 8006
    gateway_ready: bool = False
    events: list[SocEvent]
    nodes: list[SocNode]
    blocks: list[SocBlock]
    cursor: int
    retained_events: int
    retention_floor: int
    operator: bool


class SocBlockRequest(SocContract):
    ip: str = Field(min_length=2, max_length=64)
    reason: str = Field(min_length=3, max_length=160)
    minutes: int = Field(default=10, ge=1, le=1440)


class SocUnblockRequest(SocContract):
    ip: str = Field(min_length=2, max_length=64)


class SocProtectionRequest(SocContract):
    protected: bool


class SocLogin(SocContract):
    username: str = Field(max_length=48)
    password: str = Field(max_length=128)


class SocAnalysisRequest(BaselineBinding):
    event_id: int = Field(gt=0)
    baseline_fingerprint: str = Field(min_length=8, max_length=64)


class SocAnalysis(SocAnalysisRequest):
    event: SocEvent
    model_version: str
    model_as_of: date
    asset: AssetSimulation
    options: list[ActionOption]
    what_if_request: PlanHandoffRequest | None
    projection: WhatIfResult | None
    notes: list[str]
