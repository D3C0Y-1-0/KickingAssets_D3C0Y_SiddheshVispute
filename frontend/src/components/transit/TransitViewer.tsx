import { Train, Zap } from "lucide-react";
import { HotspotTwin, type TwinHotspot } from "../twin/HotspotTwin";
import { TransitArt } from "./art";
import { WIDTH, HEIGHT, at } from "./view";
import "./transit.css";

const TRANSIT_HOTSPOTS: TwinHotspot[] = [
  {
    id: "transit-terminal",
    coord: at([-90, -75, 42]),
    label: "Central Passenger Concourse",
    sub: "Ticketing & Inter-Modal Transfers",
    metric: "Pax Throughput",
    value: "14,800 pax/hr",
  },
  {
    id: "transit-viaduct",
    coord: at([0, 48, 52]),
    label: "Elevated Sky-Train Viaduct",
    sub: "Automated Guideway Concrete Piers",
    metric: "Track Telemetry",
    value: "Nominal Align",
  },
  {
    id: "transit-skytrain",
    coord: at([-55, 49, 72]),
    label: "Driverless Sky-Train Trainset",
    sub: "2-Car CBTC Autonomous Electric Unit",
    metric: "Train Headway",
    value: "90s / 65 km/h",
  },
  {
    id: "transit-ev-depot",
    coord: at([-150, 135, 24]),
    label: "Electric Bus Rapid Depot",
    sub: "Overhead Pantograph & Inductive Bays",
    metric: "Fleet SOC",
    value: "88.5% Charged",
  },
  {
    id: "transit-dispatch",
    coord: at([155, -105, 68]),
    label: "SCADA Rail Dispatch Tower",
    sub: "Signaling, Switching & Route Control",
    metric: "Signaling System",
    value: "CBTC SIL-4 Active",
  },
];

/** Transit is not part of the scored scenario, so it has no risk overlay or asset links. */
export function TransitViewer() {
  return (
    <HotspotTwin
      view="transit"
      title="Metropolitan Smart Transit & Rail Network"
      badge="TRANSIT PRECINCT 4 TWIN"
      subtitle="Sky-Train AGT Viaduct · Autonomous Bus Depot · 750V DC Overhead Catenary · SCADA Dispatch"
      icon={Train}
      fig="FIG 04"
      plateTitle="METROPOLITAN SMART TRANSIT & RAIL TRANSPORTATION NETWORK"
      ariaLabel="Smart Transit and Rail Network Isometric Diagram"
      width={WIDTH}
      height={HEIGHT}
      hotspots={TRANSIT_HOTSPOTS}
      initialPart="transit-terminal"
      risk={{}}
      reference={[
        { label: "Headway", value: "90 s (65 km/h)" },
        { label: "Catenary", value: "750 V DC" },
        { label: "Bus fleet SOC", value: "88.5%" },
      ]}
      toggles={[{ id: "catenary", label: "Catenary", icon: Zap }]}
      renderArt={({ selectedId, onSelect, toggles }) => (
        <TransitArt
          selectedComponentId={selectedId}
          onSelectComponent={onSelect}
          showCatenary={toggles.catenary}
        />
      )}
    />
  );
}
