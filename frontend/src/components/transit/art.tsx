import React from "react";
import { Solid, Line } from "../iso/react/draw";
import {
  SITE_ART,
  TERMINAL_ART,
  VIADUCT_ART,
  TRAIN_ART,
  EV_DEPOT_ART,
  DISPATCH_TOWER_ART,
} from "./geometry";

interface TransitArtProps {
  selectedComponentId?: string | null;
  onSelectComponent?: (id: string) => void;
  showCatenary?: boolean;
}

export function TransitArt({
  selectedComponentId,
  onSelectComponent,
  showCatenary = true,
}: TransitArtProps) {
  const handleClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectComponent) onSelectComponent(id);
  };

  const getHL = (id: string) => {
    const isSel = selectedComponentId === id;
    return {
      tone: isSel ? ("hi" as const) : ("mid" as const),
      isLit: isSel,
      customClass: isSel ? "transit-selected-part" : "",
    };
  };

  const termHL = getHL("transit-terminal");
  const viaductHL = getHL("transit-viaduct");
  const trainHL = getHL("transit-skytrain");
  const busHL = getHL("transit-ev-depot");
  const towerHL = getHL("transit-dispatch");

  return (
    <g className="transit-assembly" role="group" aria-label="Smart Transit & Rail Transportation Anatomy Twin">
      {/* LAYER 0: CIVIL FOUNDATION PLATFORM & PLAZA */}
      <g key="transit-site-foundation">
        <Solid paths={SITE_ART.slab} tone="lo" crease="faint" />
        <Line d={SITE_ART.curbs} tone="faint" free />
        <Line d={SITE_ART.plazaStripes} tone="faint" free />
      </g>

      {/* LAYER 1: PASSENGER TERMINAL CONCOURSE */}
      <g
        key="terminal-concourse"
        className={`transit-interactive-group ${termHL.customClass}`}
        data-component="transit-terminal"
        onClick={(e) => handleClick("transit-terminal", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={TERMINAL_ART.podium} tone="lo" crease="faint" />
        <Solid paths={TERMINAL_ART.hall} tone={termHL.tone} lit={termHL.isLit} crease="faint" />
        <Solid paths={TERMINAL_ART.canopyRoof} tone="hi" crease="faint" />
        <Line d={TERMINAL_ART.skylightLines} tone={termHL.isLit ? "lit" : "faint"} free />
        {TERMINAL_ART.columns.map((c, i) => (
          <Solid key={`col-${i}`} paths={c} tone="mid" crease="faint" />
        ))}
      </g>

      {/* LAYER 2: SCADA RAILWAY SIGNALING & DISPATCH TOWER */}
      <g
        key="dispatch-tower"
        className={`transit-interactive-group ${towerHL.customClass}`}
        data-component="transit-dispatch"
        onClick={(e) => handleClick("transit-dispatch", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={DISPATCH_TOWER_ART.plinth} tone="lo" crease="faint" />
        <Solid paths={DISPATCH_TOWER_ART.tower} tone="mid" crease="faint" />
        <Solid paths={DISPATCH_TOWER_ART.cab} tone={towerHL.tone} lit={towerHL.isLit} crease="faint" />
        <Line d={DISPATCH_TOWER_ART.antenna} tone={towerHL.isLit ? "lit" : "lo"} free />
      </g>

      {/* LAYER 3: ELEVATED SKY-TRAIN RAIL VIADUCT */}
      <g
        key="rail-viaduct"
        className={`transit-interactive-group ${viaductHL.customClass}`}
        data-component="transit-viaduct"
        onClick={(e) => handleClick("transit-viaduct", e)}
        style={{ cursor: "pointer" }}
      >
        {VIADUCT_ART.piers.map((p, i) => (
          <Solid key={`pier-${i}`} paths={p} tone="lo" crease="faint" />
        ))}
        <Solid paths={VIADUCT_ART.beam} tone={viaductHL.tone} lit={viaductHL.isLit} crease="faint" />
        <Line d={VIADUCT_ART.rails} tone={viaductHL.isLit ? "lit" : "faint"} free />
        {showCatenary && <Line d={VIADUCT_ART.catenaryMasts} tone="mid" free />}
      </g>

      {/* LAYER 4: 2-CAR DRIVERLESS SKY-TRAIN TRAINSET */}
      <g
        key="skytrain-trainset"
        className={`transit-interactive-group ${trainHL.customClass}`}
        data-component="transit-skytrain"
        onClick={(e) => handleClick("transit-skytrain", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={TRAIN_ART.leadCar} tone={trainHL.tone} lit={trainHL.isLit} crease="faint" />
        <Solid paths={TRAIN_ART.trailCar} tone={trainHL.tone} lit={trainHL.isLit} crease="faint" />
        <Solid paths={TRAIN_ART.gangway} tone="lo" crease="faint" />
        <Line d={TRAIN_ART.windows} tone={trainHL.isLit ? "lit" : "lo"} free />
        <Line d={TRAIN_ART.pantograph} tone={trainHL.isLit ? "lit" : "mid"} free />
      </g>

      {/* LAYER 5: AUTONOMOUS ELECTRIC BUSES & EV DEPOT */}
      <g
        key="ev-bus-depot"
        className={`transit-interactive-group ${busHL.customClass}`}
        data-component="transit-ev-depot"
        onClick={(e) => handleClick("transit-ev-depot", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={EV_DEPOT_ART.platform} tone="lo" crease="faint" />
        <Line d={EV_DEPOT_ART.platformStallLines} tone="faint" free />

        <Solid paths={EV_DEPOT_ART.bus1} tone={busHL.tone} lit={busHL.isLit} crease="faint" />
        <Line d={EV_DEPOT_ART.bus1Windows} tone={busHL.isLit ? "lit" : "lo"} free />

        <Solid paths={EV_DEPOT_ART.bus2} tone={busHL.tone} lit={busHL.isLit} crease="faint" />
        <Line d={EV_DEPOT_ART.bus2Windows} tone={busHL.isLit ? "lit" : "lo"} free />

        {EV_DEPOT_ART.chargers.map((chg, i) => (
          <Solid key={`charger-${i}`} paths={chg} tone="mid" crease="faint" />
        ))}
        <Line d={EV_DEPOT_ART.chargerArms} tone={busHL.isLit ? "lit" : "lo"} free />
      </g>
    </g>
  );
}
