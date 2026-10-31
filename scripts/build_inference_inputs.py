"""Build exact within-snapshot EPSS ranks for the curated references; preserve provenance."""

import gzip
import hashlib
import io
import json
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def main():
    import pandas as pd

    from app.services.vulnerability_ingestion import load_dataset

    dataset = load_dataset(ROOT / "data/reference/risk-v1")
    dates = {r.epss_date.isoformat() for r in dataset.references if r.epss_date}
    if len(dates) != 1:
        raise ValueError("Expected one reference EPSS feature date")
    day = dates.pop()
    url = f"https://epss.empiricalsecurity.com/epss_scores-{day}.csv.gz"
    with urllib.request.urlopen(url, timeout=60) as response:
        raw = response.read()
    frame = pd.read_csv(
        io.BytesIO(gzip.decompress(raw)), comment="#", usecols=["cve", "epss"]
    )
    frame["rank"] = frame.epss.rank(pct=True)
    wanted = {r.reference.cve_id for r in dataset.references}
    ranks = {row.cve: row.rank for row in frame[frame.cve.isin(wanted)].itertuples()}
    target = ROOT / "data/reference/risk-inference.json"
    target.write_text(
        json.dumps(
            {
                "feature_date": day,
                "url": url,
                "retrieved_at": datetime.now(UTC).isoformat(),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "population_rows": len(frame),
                "method": "pandas.Series.rank(pct=True); average ties, full snapshot, same as ml.data._read_epss",
                "ranks": ranks,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(target.read_text())


if __name__ == "__main__":
    main()
