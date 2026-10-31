"""Pure feature and point-in-time helpers for the KEV-prioritization signal.

Leakage rules enforced here and in data.py:
  * Never read NVD ``references``, ``cisaExploit*`` fields, SSVC metrics or ``cveTags``: they can
    encode exploitation that was recorded after the prediction date.
  * Anything derived from KEV history may only count entries with ``dateAdded <= t0``.
  * A CVE already listed in KEV at t0 is not a prediction target.
"""

import math
import re
from collections.abc import Mapping, Sequence
from datetime import date, timedelta

import numpy as np

_AV = {"NETWORK": 3, "ADJACENT_NETWORK": 2, "ADJACENT": 2, "LOCAL": 1, "PHYSICAL": 0}
_AC = {"LOW": 2, "MEDIUM": 1, "HIGH": 0}
_PR = {"NONE": 2, "LOW": 1, "HIGH": 0}
_UI = {"NONE": 2, "PASSIVE": 1, "REQUIRED": 1, "ACTIVE": 0}
_IMPACT = {"HIGH": 2, "COMPLETE": 2, "LOW": 1, "PARTIAL": 1, "NONE": 0}
_AUTH = {"NONE": 2, "SINGLE": 1, "MULTIPLE": 0}
_SCOPE = {"CHANGED": 1, "UNCHANGED": 0}

CVSS_COLUMNS = [
    "cvss_score",
    "cvss_version",
    "cvss_av",
    "cvss_ac",
    "cvss_pr",
    "cvss_ui",
    "cvss_scope",
    "cvss_c",
    "cvss_i",
    "cvss_a",
]

TEXT_PATTERNS: dict[str, str] = {
    "txt_rce": r"remote code execution|execute arbitrary code|arbitrary code execution|code execution",
    "txt_cmd_injection": r"command injection|os command|shell command",
    "txt_sqli": r"sql injection",
    "txt_auth_bypass": r"authentication bypass|bypass authentication|improper authentication|"
    r"missing authentication",
    "txt_unauth": r"unauthenticated|without authentication|not require authentication|"
    r"no authentication",
    "txt_path_traversal": r"path traversal|directory traversal",
    "txt_deserialization": r"deserializ",
    "txt_memory": r"buffer overflow|use[- ]after[- ]free|out-of-bounds|heap overflow|memory corruption",
    "txt_priv_esc": r"privilege escalation|elevat\w+ privileges|escalate privileges",
    "txt_xss": r"cross-site scripting|\bxss\b",
    "txt_dos": r"denial of service|\bdos\b",
    "txt_info_disclosure": r"information disclosure|sensitive information|disclose",
    "txt_file_upload": r"arbitrary file upload|file upload",
    "txt_ssrf": r"server-side request forgery|\bssrf\b",
    "txt_exploit_disclosed": r"exploit (has been|is|was) (publicly )?(disclosed|available)|"
    r"public exploit|proof[- ]of[- ]concept",
    "txt_remote": r"\bremote(ly)?\b",
}
_COMPILED = {name: re.compile(pattern, re.IGNORECASE) for name, pattern in TEXT_PATTERNS.items()}

_VENDOR_SUFFIX = re.compile(
    r"\b(inc|incorporated|corp|corporation|ltd|limited|llc|gmbh|co|company|foundation|project|the)\b"
)


def text_flags(description: str) -> dict[str, int]:
    flags = {name: int(bool(pattern.search(description))) for name, pattern in _COMPILED.items()}
    flags["txt_length"] = min(len(description), 5000)
    return flags


def normalize_name(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = _VENDOR_SUFFIX.sub(" ", value.lower())
    cleaned = re.sub(r"[^a-z0-9]+", "", cleaned)
    if cleaned in {"", "na", "unknown", "none"}:
        return None
    return cleaned


def _pick(entries: Sequence[Mapping] | None) -> Mapping | None:
    if not entries:
        return None
    primary = [e for e in entries if e.get("type") == "Primary"]
    return (primary or list(entries))[0].get("cvssData")


def cvss_features(metrics: Mapping | None) -> dict[str, float]:
    """Best available CVSS (3.1, 3.0, 4.0, then 2.0) as ordinal numeric features."""
    out = dict.fromkeys(CVSS_COLUMNS, math.nan)
    if not metrics:
        return out
    for key, version in (
        ("cvssMetricV31", 3.1),
        ("cvssMetricV30", 3.0),
        ("cvssMetricV40", 4.0),
        ("cvssMetricV2", 2.0),
    ):
        data = _pick(metrics.get(key))
        if not data:
            continue
        out["cvss_score"] = float(data.get("baseScore", math.nan))
        out["cvss_version"] = version
        if version == 2.0:
            out["cvss_av"] = _AV.get(data.get("accessVector"), math.nan)
            out["cvss_ac"] = _AC.get(data.get("accessComplexity"), math.nan)
            out["cvss_pr"] = _AUTH.get(data.get("authentication"), math.nan)
            out["cvss_c"] = _IMPACT.get(data.get("confidentialityImpact"), math.nan)
            out["cvss_i"] = _IMPACT.get(data.get("integrityImpact"), math.nan)
            out["cvss_a"] = _IMPACT.get(data.get("availabilityImpact"), math.nan)
        else:
            prefix = "vuln" if version == 4.0 else ""
            out["cvss_av"] = _AV.get(data.get("attackVector"), math.nan)
            out["cvss_ac"] = _AC.get(data.get("attackComplexity"), math.nan)
            out["cvss_pr"] = _PR.get(data.get("privilegesRequired"), math.nan)
            out["cvss_ui"] = _UI.get(data.get("userInteraction"), math.nan)
            out["cvss_scope"] = _SCOPE.get(data.get("scope"), math.nan)
            for column, field in (
                ("cvss_c", "ConfidentialityImpact"),
                ("cvss_i", "IntegrityImpact"),
                ("cvss_a", "AvailabilityImpact"),
            ):
                name = (prefix + field) if prefix else (field[0].lower() + field[1:])
                out[column] = _IMPACT.get(data.get(name), math.nan)
        return out
    return out


def first_of_month_on_or_after(day: date) -> date:
    if day.day == 1:
        return day
    year, month = (day.year + 1, 1) if day.month == 12 else (day.year, day.month + 1)
    return date(year, month, 1)


def prediction_date(published: date, lag_days: int = 30) -> date:
    """t0: first month start at least ``lag_days`` after publication."""
    return first_of_month_on_or_after(published + timedelta(days=lag_days))


def count_on_or_before(sorted_days: np.ndarray | None, t0_day: int) -> int:
    """Number of recorded dates (epoch days) that are <= t0. Used for KEV/vendor history."""
    if sorted_days is None or len(sorted_days) == 0:
        return 0
    return int(np.searchsorted(sorted_days, t0_day, side="right"))


def label_in_window(added_day: int | None, t0_day: int, horizon_days: int) -> int:
    """1 if the CVE enters KEV strictly after t0 and within the horizon, else 0."""
    return int(added_day is not None and t0_day < added_day <= t0_day + horizon_days)


def to_epoch_day(day: date) -> int:
    return (day - date(1970, 1, 1)).days
