#!/usr/bin/env bash
# Render build for the API: install dependencies, download the public reference data
# (CISA KEV, NVD, EPSS) into the uncommitted cache, and pre-build the derived tables.
set -euo pipefail

pip install --upgrade pip
pip install -r backend/requirements.txt

cd backend
python -m ml.fetch_reference
python - <<'PY'
from ml import data

data.load_nvd()
data.load_affected()
print("derived tables ready")
PY
