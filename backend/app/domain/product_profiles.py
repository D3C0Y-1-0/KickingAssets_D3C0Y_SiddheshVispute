"""Scenario assumption: which REAL product and version each fictional asset is assumed to run.

Aurora City assets are fictional. data/scenarios/aurora-product-map.json assigns each one a
specific real product and version so that real NVD affected-version ranges can be applied to
it. It is a labelled assumption, never a scan result, and the protected scenario fixture is
untouched.
"""

import json
from dataclasses import dataclass
from functools import lru_cache

from app.domain.seed import ROOT

PRODUCT_MAP_PATH = ROOT / "data" / "scenarios" / "aurora-product-map.json"


@dataclass(frozen=True, slots=True)
class AssetProduct:
    asset_id: str
    vendor: str
    product: str
    version: str
    nvd_vendor: str
    nvd_product_contains: tuple[str, ...]
    role: str

    @property
    def label(self) -> str:
        return f"{self.vendor} {self.product} {self.version}"


@lru_cache(maxsize=1)
def load_product_map() -> tuple[dict[str, AssetProduct], dict]:
    doc = json.loads(PRODUCT_MAP_PATH.read_text(encoding="utf-8"))
    products = {
        asset_id: AssetProduct(
            asset_id=asset_id,
            vendor=item["vendor"],
            product=item["product"],
            version=item["version"],
            nvd_vendor=item["nvd_vendor"],
            nvd_product_contains=tuple(item["nvd_product_contains"]),
            role=item["role"],
        )
        for asset_id, item in doc["assets"].items()
    }
    return products, doc["provenance"]


def product_for(asset_id: str) -> AssetProduct:
    return load_product_map()[0][asset_id]
