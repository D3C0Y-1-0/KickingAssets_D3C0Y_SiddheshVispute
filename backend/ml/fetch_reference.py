"""Download public vulnerability reference data into an uncommitted cache.

Sources (all public, no credentials):
  - CISA KEV catalog JSON                       (label source)
  - NVD per-year JSON from fkie-cad/nvd-json-data-feeds releases (CVE features)
  - EPSS monthly snapshots from epss.empiricalsecurity.com (point-in-time baseline/feature)

The raw files are cached under data/reference/cache/ (not committed). A manifest of exactly
what was retrieved, with sizes and SHA-256 digests, is written to data/reference/manifest.json.

Run from backend/:  ..\\.venv\\Scripts\\python.exe -m ml.fetch_reference
"""

import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "reference" / "cache"
MANIFEST = ROOT / "data" / "reference" / "manifest.json"

KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
FKIE_RELEASES = "https://api.github.com/repos/fkie-cad/nvd-json-data-feeds/releases/latest"
EPSS_URL = "https://epss.empiricalsecurity.com/epss_scores-{day}.csv.gz"
EPSS_FIRST_SNAPSHOT = date(2021, 5, 1)
USER_AGENT = "GridSentinel-reference-fetch/1.0 (hackathon prototype)"


def _request(url: str, retries: int = 4) -> bytes:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code == 404:
                raise
            if attempt == retries - 1:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == retries - 1:
                raise
        time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def _store(path: Path, url: str, records: list[dict], *, force: bool) -> bool:
    if path.exists() and path.stat().st_size > 0 and not force:
        data = path.read_bytes()
    else:
        try:
            data = _request(url)
        except urllib.error.HTTPError as error:
            # S3 answers 403 for an object that does not exist.
            if error.code in (403, 404):
                print(f"  missing ({error.code}): {url}")
                return False
            raise
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    records.append(
        {
            "path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "url": url,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    )
    return True


def monthly_snapshots(first: date, last: date) -> list[date]:
    days, year, month = [], first.year, first.month
    while date(year, month, 1) <= last:
        days.append(date(year, month, 1))
        month += 1
        if month == 13:
            year, month = year + 1, 1
    return days


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--first-year", type=int, default=2015)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    records: list[dict] = []
    print("KEV catalog")
    _store(CACHE / "kev" / "known_exploited_vulnerabilities.json", KEV_URL, records, force=True)

    print("NVD per-year feeds (fkie-cad release)")
    release = json.loads(_request(FKIE_RELEASES))
    tag = release["tag_name"]
    assets = {a["name"]: a["browser_download_url"] for a in release["assets"]}
    years = sorted(
        int(name[4:8])
        for name in assets
        if name.startswith("CVE-") and name.endswith(".json.xz") and name[4:8].isdigit()
    )
    for year in [y for y in years if y >= args.first_year]:
        name = f"CVE-{year}.json.xz"
        print(f"  {name}")
        _store(CACHE / "nvd" / name, assets[name], records, force=args.force)

    print("EPSS monthly snapshots")
    today = datetime.now(UTC).date()
    for month_start in monthly_snapshots(EPSS_FIRST_SNAPSHOT, today):
        # Use the first published file of the month (a few days are occasionally absent).
        for offset in range(5):
            day = month_start.replace(day=1 + offset)
            if day > today:
                break
            print(f"  {day.isoformat()}")
            name = f"epss_scores-{day.isoformat()}.csv.gz"
            if _store(
                CACHE / "epss" / name,
                EPSS_URL.format(day=day.isoformat()),
                records,
                force=args.force,
            ):
                break

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(
        json.dumps(
            {
                "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
                "nvd_release_tag": tag,
                "files": sorted(records, key=lambda r: r["path"]),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    total = sum(r["bytes"] for r in records)
    print(f"Done: {len(records)} files, {total / 1e6:.1f} MB. Manifest: {MANIFEST.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
