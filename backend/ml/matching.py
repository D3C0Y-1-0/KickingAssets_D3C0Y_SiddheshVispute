"""Decide whether an assumed product version falls inside a CVE's NVD affected-version range.

Three outcomes per CVE for a given (vendor, product family, version):
  version_confirmed  at least one affected range contains the version
  version_unknown    the product matches but no range could be evaluated (for example a
                     range with no usable bounds); kept as a lower-confidence candidate
  excluded           every evaluable range excludes the version, so the CVE does not apply

The version itself is a scenario assumption; "confirmed" means the NVD range matches that
assumed version, never that a real system was scanned.
"""

import math
import re
from dataclasses import dataclass

import pandas as pd

_NUMBERS = re.compile(r"\d+")
_UNKNOWN = {"", "*", "-", "n/a", "na", "unspecified", "unknown", "all", "various", "nan", "none"}


def parse_version(text: object) -> tuple[int, ...] | None:
    if text is None or (isinstance(text, float) and math.isnan(text)):
        return None
    numbers = tuple(int(x) for x in _NUMBERS.findall(str(text)))
    return numbers or None


def _unknown(text: object) -> bool:
    if text is None or (isinstance(text, float) and math.isnan(text)):
        return True
    return str(text).strip().lower() in _UNKNOWN


def in_range(
    version: tuple[int, ...],
    start: object,
    less_than: object,
    less_than_or_equal: object,
) -> bool | None:
    """True/False when the row can be evaluated, None when it cannot."""
    upper, inclusive = (None, False)
    if not _unknown(less_than):
        upper = parse_version(less_than)
        if upper is None:
            return None
    elif not _unknown(less_than_or_equal):
        upper, inclusive = parse_version(less_than_or_equal), True
        if upper is None:
            return None
    if upper is not None:
        lower = (0,) if _unknown(start) or str(start).strip() == "0" else parse_version(start)
        if lower is None:
            return None
        return lower <= version <= upper if inclusive else lower <= version < upper
    if _unknown(start):
        return None
    exact = parse_version(start)
    if exact is None:
        return None
    return version[: len(exact)] == exact


@dataclass(frozen=True, slots=True)
class ProductMatch:
    confirmed: frozenset[str]
    unknown: frozenset[str]
    excluded: frozenset[str]
    product_cves: frozenset[str]

    @property
    def product_known(self) -> bool:
        return bool(self.product_cves)


class AffectedIndex:
    def __init__(self, affected: pd.DataFrame) -> None:
        self._by_vendor = {vendor: frame for vendor, frame in affected.groupby("vendor")}
        self._cache: dict[tuple, ProductMatch] = {}

    def match(self, vendor: str, product_contains: list[str], version: str) -> ProductMatch:
        key = (vendor, tuple(product_contains), version)
        if key in self._cache:
            return self._cache[key]
        frame = self._by_vendor.get(vendor)
        target = parse_version(version)
        if frame is None or target is None or not product_contains:
            result = ProductMatch(frozenset(), frozenset(), frozenset(), frozenset())
        else:
            pattern = "|".join(re.escape(p) for p in product_contains)
            rows = frame[frame["product"].str.contains(pattern, regex=True)]
            state: dict[str, set[bool | None]] = {}
            for r in rows.itertuples(index=False):
                state.setdefault(r.cve_id, set()).add(
                    in_range(target, r.version, r.less_than, r.less_than_or_equal)
                )
            confirmed = {c for c, s in state.items() if True in s}
            unknown = {c for c, s in state.items() if c not in confirmed and None in s}
            excluded = set(state) - confirmed - unknown
            result = ProductMatch(
                frozenset(confirmed), frozenset(unknown), frozenset(excluded), frozenset(state)
            )
        self._cache[key] = result
        return result

    def fixed_versions(
        self, vendor: str, product_contains: list[str], version: str
    ) -> dict[str, str | None]:
        """Documented fix boundary per CVE that affects `version`.

        The boundary is the NVD `lessThan` bound of the affected range that contains the version,
        i.e. the first version outside the range. None means the data names no fixed version
        (only an inclusive upper bound, an open range, or a range that cannot be evaluated), so a
        fix is not established. With several containing ranges the highest boundary is needed,
        and any undocumented one makes the whole CVE undocumented.
        """
        frame = self._by_vendor.get(vendor)
        target = parse_version(version)
        if frame is None or target is None or not product_contains:
            return {}
        pattern = "|".join(re.escape(p) for p in product_contains)
        rows = frame[frame["product"].str.contains(pattern, regex=True)]
        bounds: dict[str, list[str | None]] = {}
        for r in rows.itertuples(index=False):
            if in_range(target, r.version, r.less_than, r.less_than_or_equal) is not True:
                continue
            documented = not _unknown(r.less_than) and parse_version(r.less_than) is not None
            bounds.setdefault(r.cve_id, []).append(str(r.less_than).strip() if documented else None)
        out: dict[str, str | None] = {}
        for cve, values in bounds.items():
            if any(v is None for v in values):
                out[cve] = None
            else:
                out[cve] = max(values, key=lambda v: parse_version(v) or ())  # type: ignore[arg-type]
        return out
