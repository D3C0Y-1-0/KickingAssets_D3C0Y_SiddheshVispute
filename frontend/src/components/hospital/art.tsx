import React from "react";
import { Solid, Line } from "../iso/react/draw";
import {
  SITE_ART,
  TOWER_ART,
  HELIPAD_ART,
  TRAUMA_ART,
  OXYGEN_ART,
  GEN_PLANT_ART,
} from "./geometry";

interface HospitalArtProps {
  selectedComponentId?: string | null;
  onSelectComponent?: (id: string) => void;
  showHelipadLights?: boolean;
}

export function HospitalArt({
  selectedComponentId,
  onSelectComponent,
  showHelipadLights = true,
}: HospitalArtProps) {
  const handleClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectComponent) onSelectComponent(id);
  };

  const getHL = (id: string) => {
    const isSel = selectedComponentId === id;
    return {
      tone: isSel ? ("hi" as const) : ("mid" as const),
      isLit: isSel,
      customClass: isSel ? "hosp-selected-part" : "",
    };
  };

  const towerHL = getHL("hosp-tower");
  const heliHL = getHL("hosp-helipad");
  const traumaHL = getHL("hosp-trauma");
  const o2HL = getHL("hosp-oxygen");
  const genHL = getHL("hosp-generator");

  return (
    <g className="hospital-assembly" role="group" aria-label="Regional Trauma Hospital Anatomy Twin">
      {/* LAYER 0: CIVIL SITE FOUNDATION & RAMP */}
      <g key="hospital-foundation">
        <Solid paths={SITE_ART.slab} tone="lo" crease="faint" />
        <Line d={SITE_ART.curbs} tone="faint" free />
        <Line d={SITE_ART.emergencyDrive} tone="faint" free />
      </g>

      {/* LAYER 1: MAIN CLINICAL & SURGICAL INPATIENT TOWER */}
      <g
        key="clinical-tower"
        className={`hosp-interactive-group ${towerHL.customClass}`}
        data-component="hosp-tower"
        onClick={(e) => handleClick("hosp-tower", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={TOWER_ART.podium} tone="lo" crease="faint" />
        <Solid paths={TOWER_ART.tower} tone={towerHL.tone} lit={towerHL.isLit} crease="faint" />
        <Line d={TOWER_ART.windowBands} tone={towerHL.isLit ? "lit" : "faint"} free />
        {TOWER_ART.hvacChillers.map((ch, i) => (
          <Solid key={`chiller-${i}`} paths={ch} tone="mid" crease="faint" />
        ))}
      </g>

      {/* LAYER 2: ILLUMINATED ROOFTOP EMERGENCY HELIPAD */}
      <g
        key="rooftop-helipad"
        className={`hosp-interactive-group ${heliHL.customClass}`}
        data-component="hosp-helipad"
        onClick={(e) => handleClick("hosp-helipad", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={HELIPAD_ART.deck} tone={heliHL.tone} lit={heliHL.isLit} crease="faint" />
        <Line d={HELIPAD_ART.outerRing} tone={heliHL.isLit ? "lit" : "faint"} free />
        <Line d={HELIPAD_ART.hMarking} tone={heliHL.isLit ? "lit" : "mid"} free />
        {showHelipadLights && <Line d={HELIPAD_ART.beacon} tone="hi" free />}
      </g>

      {/* LAYER 3: EMERGENCY TRAUMA RECEPTION & AMBULANCE BAY */}
      <g
        key="trauma-wing"
        className={`hosp-interactive-group ${traumaHL.customClass}`}
        data-component="hosp-trauma"
        onClick={(e) => handleClick("hosp-trauma", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={TRAUMA_ART.wing} tone={traumaHL.tone} lit={traumaHL.isLit} crease="faint" />
        <Line d={TRAUMA_ART.crossLines} tone="lit" free />
        <Solid paths={TRAUMA_ART.canopy} tone="hi" crease="faint" />
        {TRAUMA_ART.canopyPillars.map((p, i) => (
          <Solid key={`pillar-${i}`} paths={p} tone="mid" crease="faint" />
        ))}
        <Solid paths={TRAUMA_ART.ambulance1} tone="lo" crease="faint" />
        <Solid paths={TRAUMA_ART.ambulance2} tone="lo" crease="faint" />
      </g>

      {/* LAYER 4: CRYOGENIC MEDICAL OXYGEN BULK FARM */}
      <g
        key="oxygen-farm"
        className={`hosp-interactive-group ${o2HL.customClass}`}
        data-component="hosp-oxygen"
        onClick={(e) => handleClick("hosp-oxygen", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={OXYGEN_ART.plinth} tone="lo" crease="faint" />
        <Solid paths={OXYGEN_ART.tank1} tone={o2HL.tone} lit={o2HL.isLit} crease="faint" />
        <Solid paths={OXYGEN_ART.tank2} tone={o2HL.tone} lit={o2HL.isLit} crease="faint" />
        {OXYGEN_ART.tankCaps.map((c, i) => (
          <Solid key={`cap-${i}`} paths={c} tone="hi" crease="faint" />
        ))}
        <Line d={OXYGEN_ART.vaporizers} tone={o2HL.isLit ? "lit" : "lo"} free />
      </g>

      {/* LAYER 5: EMERGENCY DIESEL GENERATION PLANT */}
      <g
        key="generator-plant"
        className={`hosp-interactive-group ${genHL.customClass}`}
        data-component="hosp-generator"
        onClick={(e) => handleClick("hosp-generator", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={GEN_PLANT_ART.plinth} tone="lo" crease="faint" />
        <Solid paths={GEN_PLANT_ART.gen1} tone={genHL.tone} lit={genHL.isLit} crease="faint" />
        <Solid paths={GEN_PLANT_ART.gen2} tone={genHL.tone} lit={genHL.isLit} crease="faint" />
        {GEN_PLANT_ART.exhaustStacks.map((s, i) => (
          <Solid key={`stack-${i}`} paths={s} tone="hi" crease="faint" />
        ))}
      </g>
    </g>
  );
}
