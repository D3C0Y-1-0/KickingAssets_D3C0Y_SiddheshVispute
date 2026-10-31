import { Droplets } from "lucide-react";
import { HotspotTwin, type TwinHotspot } from "../twin/HotspotTwin";
import { WaterPlantArt } from "./art";
import { WIDTH, HEIGHT, at } from "./view";
import type { TwinRisk } from "../../hooks/twinRisk";
import "./waterplant.css";

const WATER_HOTSPOTS: TwinHotspot[] = [
  {
    id: "water-intake",
    coord: at([-195, -155, 30]),
    label: "Raw Water Intake Wells",
    sub: "3x 450kW Vertical Turbine Pumps",
    metric: "Intake Flow",
    value: "42,500 m³/day",
  },
  {
    id: "water-coagulation",
    coord: at([-100, -145, 28]),
    label: "Flash Coagulation & Flocculator",
    sub: "Alum Dosing & Rapid Mixers",
    metric: "Turbidity",
    value: "1.2 NTU",
  },
  {
    id: "water-clarifiers",
    coord: at([-105, 70, 24]),
    label: "Sedimentation Clarifiers",
    sub: "Twin 52m Radial Scraper Basins",
    metric: "Sludge Level",
    value: "0.8 m",
  },
  {
    id: "water-filters",
    coord: at([160, -140, 34]),
    label: "Rapid Gravity Sand Filters",
    sub: "Dual Multi-Media Beds & Backwash",
    metric: "Filter Head Loss",
    value: "0.35 bar",
  },
  {
    id: "water-chemical",
    coord: at([38, -150, 24]),
    label: "Chlorination Dosing Silos",
    sub: "Secondary Disinfection Building",
    metric: "Free Chlorine",
    value: "1.8 mg/L",
  },
  {
    id: "water-booster-pumps",
    coord: at([160, -40, 28]),
    label: "Treated Water Booster Pumps",
    sub: "High-Pressure Distribution House",
    metric: "Discharge Pressure",
    value: "6.4 bar",
  },
  {
    id: "water-reservoir",
    coord: at([145, 105, 80]),
    label: "Potable Storage Reservoir",
    sub: "18.5M Gallon Elevated Steel Tank",
    metric: "Storage Level",
    value: "92.4% Nominal",
  },
];

export function WaterPlantViewer({ risk = {} }: { risk?: Record<string, TwinRisk> }) {
  return (
    <HotspotTwin
      view="water"
      title="Municipal Water Purification & Reservoir Plant"
      badge="WTR-001 / WTR-002 ANATOMY TWIN"
      subtitle="Clarification · Sand Filtration · High-Pressure Booster Pumping · 18.5MG Potable Reservoir"
      icon={Droplets}
      fig="FIG 03"
      plateTitle="MUNICIPAL WATER TREATMENT PLANT & RESERVOIR"
      ariaLabel="Water Treatment Plant Isometric Diagram"
      width={WIDTH}
      height={HEIGHT}
      hotspots={WATER_HOTSPOTS}
      initialPart="water-reservoir"
      risk={risk}
      reference={[
        { label: "Intake flow", value: "42.5K m³/d" },
        { label: "Pressure", value: "6.4 bar" },
        { label: "Reservoir", value: "92.4%" },
      ]}
      toggles={[{ id: "piping", label: "Piping", icon: Droplets }]}
      renderArt={({ selectedId, onSelect, toggles }) => (
        <WaterPlantArt
          selectedComponentId={selectedId}
          onSelectComponent={onSelect}
          showPiping={toggles.piping}
        />
      )}
    />
  );
}
