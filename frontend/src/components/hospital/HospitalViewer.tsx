import { HeartPulse, Lightbulb } from "lucide-react";
import { HotspotTwin, type TwinHotspot } from "../twin/HotspotTwin";
import { HospitalArt } from "./art";
import { WIDTH, HEIGHT, at } from "./view";
import type { TwinRisk } from "../../hooks/twinRisk";
import "./hospital.css";

const HOSP_HOTSPOTS: TwinHotspot[] = [
  {
    id: "hosp-tower",
    coord: at([-50, -75, 45]),
    label: "Inpatient & Surgical Tower",
    sub: "4-Story Wing · 380 Acute Care Beds",
    metric: "Bed Occupancy",
    value: "84.2% (320 Beds)",
  },
  {
    id: "hosp-helipad",
    coord: at([-50, -75, 82]),
    label: "Rooftop Trauma Helipad",
    sub: "Elevated Deck · Night IFR Beacon",
    metric: "Helipad Status",
    value: "CLEAR / VFR ACTIVE",
  },
  {
    id: "hosp-trauma",
    coord: at([-175, 40, 24]),
    label: "Emergency Trauma & Triage",
    sub: "Ambulance Bay & Resuscitation",
    metric: "Triage Capacity",
    value: "14 Trauma Bays Ready",
  },
  {
    id: "hosp-oxygen",
    coord: at([130, -110, 52]),
    label: "Cryogenic Liquid O2 Farm",
    sub: "Twin 15,000L Bulk Vacuum Tanks",
    metric: "O2 Storage",
    value: "88.6% (14.2 Bar)",
  },
  {
    id: "hosp-generator",
    coord: at([135, 10, 24]),
    label: "Emergency Generator Plant",
    sub: "Dual 1,250 kVA Standby Diesels",
    metric: "Auto-Transfer",
    value: "STANDBY READY (<10s)",
  },
];

export function HospitalViewer({ risk = {} }: { risk?: Record<string, TwinRisk> }) {
  return (
    <HotspotTwin
      view="hospital"
      title="Regional Trauma Hospital & Medical Campus"
      badge="HLT-001 / HLT-002 ANATOMY TWIN"
      subtitle="Surgical Tower · Active Rooftop Helipad · Cryogenic O2 Farm · 2,500 kVA Standby Generation"
      icon={HeartPulse}
      fig="FIG 05"
      plateTitle="REGIONAL TRAUMA HOSPITAL & HEALTHCARE CAMPUS"
      ariaLabel="Regional Trauma Hospital Isometric Diagram"
      width={WIDTH}
      height={HEIGHT}
      hotspots={HOSP_HOTSPOTS}
      initialPart="hosp-tower"
      risk={risk}
      reference={[
        { label: "Medical O2", value: "88.6% full" },
        { label: "Genset", value: "standby, <10 s transfer" },
      ]}
      toggles={[{ id: "beacon", label: "Helipad beacon", icon: Lightbulb }]}
      renderArt={({ selectedId, onSelect, toggles }) => (
        <HospitalArt
          selectedComponentId={selectedId}
          onSelectComponent={onSelect}
          showHelipadLights={toggles.beacon}
        />
      )}
    />
  );
}
