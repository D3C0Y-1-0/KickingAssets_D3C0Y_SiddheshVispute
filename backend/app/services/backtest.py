"""Pooled backtest over held-out months using the city's version-matched CVEs.

At each monthly snapshot from the held-out test period onward, every applicable not-yet-listed
CVE is scored using only information available then. The real KEV additions in the following
180 days are the outcome. Results are pooled across months, so a (CVE, month) pair counts once
per month in which it was a candidate.
"""

import threading

import numpy as np
import pandas as pd

from app.domain.product_profiles import load_product_map
from app.schemas.simulation import BacktestGroup, PooledBacktest, PooledHit
from ml import inference

_LOCK = threading.Lock()
_CACHE: PooledBacktest | None = None


def pooled_backtest(*, force: bool = False) -> PooledBacktest:
    global _CACHE
    with _LOCK:
        if _CACHE is not None and not force:
            return _CACHE
        products, _ = load_product_map()
        frames = []
        for snapshot in inference.available_snapshots():
            if snapshot < inference.TEST_START or snapshot.day != 1:
                continue
            ref = inference.load_reference(snapshot)
            if not ref.outcome_window_closed:
                continue
            by_cve: dict[int, set[str]] = {}
            for asset_id, p in sorted(products.items()):
                match = ref.match_product(p.nvd_vendor, list(p.nvd_product_contains), p.version)
                for position in match.unlisted:
                    by_cve.setdefault(int(position), set()).add(asset_id)
            if not by_cve:
                continue
            positions = sorted(by_cve)
            scored = ref.score_positions(np.array(positions))
            outcomes = ref.outcomes(np.array(positions))
            scored["snapshot"] = snapshot
            scored["outcome"] = [o for o, _ in outcomes]
            scored["outcome_date"] = [d for _, d in outcomes]
            scored["assets"] = [sorted(by_cve[p]) for p in positions]
            frames.append(
                scored[
                    [
                        "cve_id",
                        "snapshot",
                        "priority_percentile",
                        "epss_percentile",
                        "outcome",
                        "outcome_date",
                        "assets",
                    ]
                ]
            )
        if not frames:
            raise inference.ReferenceUnavailable("No held-out snapshot has a closed outcome window")
        table = pd.concat(frames, ignore_index=True)
        table["hit"] = table["outcome"] == "added_to_kev"
        ml_top = table["priority_percentile"] >= 0.9
        epss_top = table["epss_percentile"].fillna(0) >= 0.9

        def group(label: str, mask) -> BacktestGroup:
            part = table[mask]
            return BacktestGroup(
                label=label,
                cves=int(len(part)),
                hits=int(part["hit"].sum()),
                hit_rate=round(float(part["hit"].mean()), 5) if len(part) else 0.0,
            )

        groups = [
            group("All applicable candidates", table["hit"].notna()),
            group("ML top 10%", ml_top),
            group("ML other 90%", ~ml_top),
            group("EPSS top 10%", epss_top),
            group("EPSS other 90%", ~epss_top),
        ]
        hits = []
        for cve, part in table[table["hit"]].groupby("cve_id"):
            first = part.sort_values("snapshot").iloc[0]
            hits.append(
                PooledHit(
                    cve_id=cve,
                    assets=sorted({a for lst in part["assets"] for a in lst}),
                    first_flagged=first["snapshot"],
                    kev_added=first["outcome_date"],
                    best_priority_percentile=round(float(part["priority_percentile"].max()), 4),
                    epss_percentile=None
                    if pd.isna(first["epss_percentile"])
                    else round(float(first["epss_percentile"]), 4),
                )
            )
        hits.sort(key=lambda h: (-h.best_priority_percentile, h.cve_id))
        _CACHE = PooledBacktest(
            first_snapshot=min(table["snapshot"]),
            last_snapshot=max(table["snapshot"]),
            snapshots=int(table["snapshot"].nunique()),
            pairs_evaluated=int(len(table)),
            hit_pairs=int(table["hit"].sum()),
            distinct_hit_cves=len(hits),
            groups=groups,
            hits=hits[:20],
            note="Held-out months only (never used to train or tune the model). Each candidate "
            "was scored with information available at its month; the outcome is the real CISA "
            "KEV addition within 180 days. The version assumption is a scenario assumption.",
        )
        return _CACHE
