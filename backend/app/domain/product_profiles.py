"""Scenario assumption: which REAL product families the fictional assets are assumed to run.

Aurora City assets are fictional, so no CVE can be confirmed against them. For the simulation
each asset is assigned a plausible real-world vendor family by sector and role. Real CVEs for
that family are then treated as *candidate* findings (versions are not matched). This mapping
is a labelled assumption, never a scan result.
"""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ProductProfile:
    key: str
    label: str
    vendors: tuple[str, ...]  # normalised NVD vendor names (see ml.features.normalize_name)
    product_contains: tuple[str, ...] = ()
    product_excludes: tuple[str, ...] = ()
    rationale: str = ""


_WINDOWS_WORKSTATION = ProductProfile(
    key="windows-workstation",
    label="Microsoft Windows desktop",
    vendors=("microsoft",),
    product_contains=("windows",),
    product_excludes=("server",),
    rationale="Operator workstations commonly run Windows desktop editions.",
)
_WINDOWS_SERVER = ProductProfile(
    key="windows-server",
    label="Microsoft Windows Server",
    vendors=("microsoft",),
    product_contains=("windowsserver",),
    rationale="Control, historian and operations servers commonly run Windows Server.",
)

_PROFILES: dict[tuple[str, str], ProductProfile] = {
    ("power", "gateway"): ProductProfile(
        "edge-gateway-power",
        "Perimeter VPN / remote-access gateways",
        ("fortinet", "paloaltonetworks", "ivanti"),
        rationale="Utility perimeter and remote-access appliances.",
    ),
    ("power", "controller"): ProductProfile(
        "ics-controller-power",
        "Substation and process automation controllers",
        ("siemens", "schneiderelectric", "abb"),
        rationale="Common vendors of protection relays, RTUs and PLCs in power systems.",
    ),
    ("power", "sensor"): ProductProfile(
        "ics-sensor-power",
        "Industrial IoT gateways and I/O",
        ("moxa", "advantech", "phoenixcontact"),
        rationale="Serial/Ethernet gateways and I/O modules used with grid sensors.",
    ),
    ("power", "backup"): ProductProfile(
        "backup-power",
        "Backup power and power electronics",
        ("hitachienergy", "eaton"),
        rationale="Backup power, UPS and switchgear vendors.",
    ),
    ("water", "gateway"): ProductProfile(
        "edge-gateway-water",
        "Perimeter VPN / remote-access gateways",
        ("fortinet", "paloaltonetworks"),
        rationale="Water utility perimeter and remote-access appliances.",
    ),
    ("water", "controller"): ProductProfile(
        "ics-controller-water",
        "Water treatment PLCs and controllers",
        ("rockwellautomation", "mitsubishielectric", "siemens"),
        rationale="Common PLC vendors in water and wastewater automation.",
    ),
    ("water", "sensor"): ProductProfile(
        "ics-sensor-water",
        "Industrial IoT gateways and I/O",
        ("moxa", "wago", "advantech"),
        rationale="Serial/Ethernet gateways and I/O modules used with level and flow sensors.",
    ),
    ("water", "backup"): ProductProfile(
        "backup-water",
        "Backup power and drives",
        ("eaton", "abb"),
        rationale="Backup power and motor drive vendors.",
    ),
    ("healthcare", "gateway"): ProductProfile(
        "edge-gateway-healthcare",
        "Perimeter VPN / remote-access gateways",
        ("ivanti", "fortinet", "paloaltonetworks"),
        rationale="Hospital perimeter and remote-access appliances.",
    ),
    ("healthcare", "controller"): ProductProfile(
        "building-controller-healthcare",
        "Building and clinical-plant controllers",
        ("siemens", "schneiderelectric", "honeywell"),
        rationale="HVAC, medical-gas and building-automation controller vendors.",
    ),
    ("healthcare", "sensor"): ProductProfile(
        "ics-sensor-healthcare",
        "Industrial IoT gateways and clinical device connectivity",
        ("advantech", "moxa", "philips"),
        rationale="Connectivity gateways and clinical device vendors.",
    ),
    ("healthcare", "backup"): ProductProfile(
        "backup-healthcare",
        "Backup power and UPS",
        ("eaton", "schneiderelectric"),
        rationale="Hospital backup generator and UPS vendors.",
    ),
}


def profile_for(sector: str, asset_type: str) -> ProductProfile:
    if asset_type == "workstation":
        return _WINDOWS_WORKSTATION
    if asset_type == "server":
        return _WINDOWS_SERVER
    return _PROFILES[(sector, asset_type)]
