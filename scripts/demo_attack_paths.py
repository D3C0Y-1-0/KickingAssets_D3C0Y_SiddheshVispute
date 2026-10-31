r"""Reproducible Aurora City attack-path demonstration.

Runs the real simulation (needs the local reference data and trained model) to obtain
version-matched vulnerability evidence, then analyses the cyber reachability graph.
Usage (repo root): .venv\Scripts\python.exe scripts/demo_attack_paths.py [--write docs/ATTACK_PATH_DEMO.md]
"""

import argparse
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.domain.seed import make_bundle  # noqa: E402
from app.engine.attack_path import AnalysisConfig, AttackPathEngine, Controls  # noqa: E402
from app.engine.attack_path.adapter import (  # noqa: E402
    consequence_lookup,
    evidence_from_run,
    from_bundle,
)
from app.main import create_app  # noqa: E402
from app.schemas.simulation import SimulationRun  # noqa: E402
from ml import inference  # noqa: E402


def render() -> str:
    if not inference.status()["ready"]:
        raise SystemExit(
            "Local reference data and model are required for this demonstration."
        )
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with TestClient(
            create_app(tmp_path / "demo.sqlite3", static_dir=tmp_path / "s")
        ) as client:
            run = SimulationRun.model_validate(
                client.post("/api/v1/simulation/run").json()
            )
    bundle = make_bundle()
    evidence = evidence_from_run(run)
    engine = AttackPathEngine(consequence_lookup(bundle))
    config = AnalysisConfig()
    baseline = engine.analyze(from_bundle(bundle, evidence), config)

    lines = [
        "# Aurora City attack-path demonstration",
        "",
        f"Method `{baseline.method_version}`. Simulated as of **{run.as_of}**. Evidence: real "
        "NVD/KEV/EPSS data matched to the assumed product versions; topology and configuration "
        "are fictional scenario assumptions.",
        "",
        f"Entry points: {', '.join(baseline.entry_points)}. "
        f"Targets: {len(baseline.targets)} security-critical assets.",
        "",
        "## Target reachability",
        "",
        "| Target | Reachable | Supported paths | Verdict |",
        "|---|---|---|---|",
    ]
    for t in baseline.target_reachability:
        lines.append(
            f"| {t.target} | {t.reachable} | {t.supported_paths} | {t.verdict} |"
        )
    lines += ["", "## Ranked paths (top 6)", ""]
    for p in baseline.paths[:6]:
        lines.append(
            f"{p.rank}. **{' → '.join(('internet', *p.nodes))}** ({p.status}, score {p.ranking_score})"
        )
        for hop in p.hops:
            lines.append(f"    - {hop.explanation}")
        if p.consequence:
            services = ", ".join(
                f"{s.service_id} {s.disruption_fraction:.0%}"
                for s in p.consequence.services
            )
            lines.append(
                f"    - Operational consequence if {p.target} suffers "
                f"{p.consequence.effect.replace('_', ' ')} (dependency graph): {services or 'none'}"
            )
    lines += [
        "",
        "## Choke points",
        "",
        "| Asset | Paths through | Removing it cuts all paths to |",
        "|---|---|---|",
    ]
    for c in baseline.chokepoints:
        lines.append(
            f"| {c.asset_id} {c.name} | {c.paths_through} | {', '.join(c.targets_cut) or '—'} |"
        )

    segmented = engine.analyze(
        from_bundle(bundle, evidence, Controls(isolated_assets=frozenset({"PWR-008"}))),
        config,
    )
    lines += [
        "",
        "## Effect of isolating PWR-008 (Dispatch Control Server)",
        "",
        f"Supported paths drop from {len(baseline.paths)} to {len(segmented.paths)}; power "
        "controllers reached through it: "
        + (
            ", ".join(
                sorted({p.target for p in baseline.paths if "PWR-008" in p.nodes[1:-1]})
            )
            or "none"
        )
        + ".",
        "",
    ]
    if baseline.notes:
        lines += ["## Notes", ""] + [f"- {n}" for n in baseline.notes] + [""]
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path)
    args = parser.parse_args()
    text = render()
    if args.write:
        args.write.write_text(text, encoding="utf-8", newline="\n")
        print(f"Wrote {args.write}")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(text)
