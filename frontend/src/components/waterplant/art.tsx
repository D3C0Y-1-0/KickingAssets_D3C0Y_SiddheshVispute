import React from "react";
import { Solid, Line } from "../iso/react/draw";
import {
  SITE_ART,
  INTAKE_ART,
  COAGULATION_ART,
  CLARIFIERS_ART,
  FILTRATION_ART,
  CHEMICAL_ART,
  PUMP_HOUSE_ART,
  RESERVOIR_ART,
  PIPING_ART,
} from "./geometry";

interface WaterPlantArtProps {
  selectedComponentId?: string | null;
  onSelectComponent?: (id: string) => void;
  showPiping?: boolean;
}

export function WaterPlantArt({
  selectedComponentId,
  onSelectComponent,
  showPiping = true,
}: WaterPlantArtProps) {
  const handleClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectComponent) onSelectComponent(id);
  };

  const getHL = (id: string) => {
    const isSel = selectedComponentId === id;
    return {
      tone: isSel ? ("hi" as const) : ("mid" as const),
      isLit: isSel,
      customClass: isSel ? "water-selected-part" : "",
    };
  };

  const intakeHL = getHL("water-intake");
  const coagHL = getHL("water-coagulation");
  const clarifierHL = getHL("water-clarifiers");
  const filterHL = getHL("water-filters");
  const chemHL = getHL("water-chemical");
  const pumpHL = getHL("water-booster-pumps");
  const resHL = getHL("water-reservoir");

  return (
    <g className="waterplant-assembly" role="group" aria-label="Municipal Water Treatment Complex Anatomy Twin">
      {/* LAYER 0: CIVIL FOUNDATION PLATFORM & DRAINAGE */}
      <g key="water-site-foundation">
        <Solid paths={SITE_ART.slab} tone="lo" crease="faint" />
        <Line d={SITE_ART.curbs} tone="faint" free />
        <Line d={SITE_ART.drainLines} tone="faint" free />
      </g>

      {/* LAYER 1: RAW WATER INTAKE & CASCADE AERATION */}
      <g
        key="intake-facility"
        className={`water-interactive-group ${intakeHL.customClass}`}
        data-component="water-intake"
        onClick={(e) => handleClick("water-intake", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={INTAKE_ART.intakePlinth} tone="lo" crease="faint" />
        {INTAKE_ART.pumps.map((p, i) => (
          <Solid key={`intake-pump-${i}`} paths={p} tone={intakeHL.tone} lit={intakeHL.isLit} crease="faint" />
        ))}
        {INTAKE_ART.pumpMotors.map((m, i) => (
          <Solid key={`intake-motor-${i}`} paths={m} tone="hi" crease="faint" />
        ))}
        <Line d={INTAKE_ART.intakeHeader} tone={intakeHL.isLit ? "lit" : "mid"} free />
        
        {/* Stepped Aeration Terraces */}
        <Solid paths={INTAKE_ART.cascade1} tone="lo" crease="faint" />
        <Solid paths={INTAKE_ART.cascade2} tone="mid" crease="faint" />
        <Solid paths={INTAKE_ART.cascade3} tone={intakeHL.tone} lit={intakeHL.isLit} crease="faint" />
      </g>

      {/* LAYER 2: COAGULATION & FLASH MIXING BASIN */}
      <g
        key="coagulation-basin"
        className={`water-interactive-group ${coagHL.customClass}`}
        data-component="water-coagulation"
        onClick={(e) => handleClick("water-coagulation", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={COAGULATION_ART.tank} tone={coagHL.tone} lit={coagHL.isLit} crease="faint" />
        <Line d={COAGULATION_ART.baffles} tone={coagHL.isLit ? "lit" : "faint"} free />
        {COAGULATION_ART.mixers.map((mx, i) => (
          <Solid key={`mixer-${i}`} paths={mx} tone="hi" crease="faint" />
        ))}
      </g>

      {/* LAYER 3: DUAL CIRCULAR SEDIMENTATION CLARIFIERS */}
      <g
        key="clarifier-basins"
        className={`water-interactive-group ${clarifierHL.customClass}`}
        data-component="water-clarifiers"
        onClick={(e) => handleClick("water-clarifiers", e)}
        style={{ cursor: "pointer" }}
      >
        {/* Clarifier 1 */}
        <Solid paths={CLARIFIERS_ART.basin1} tone={clarifierHL.tone} lit={clarifierHL.isLit} crease="faint" />
        <Solid paths={CLARIFIERS_ART.well1} tone="hi" crease="faint" />
        <Line d={CLARIFIERS_ART.bridge1} tone={clarifierHL.isLit ? "lit" : "mid"} free />
        <Solid paths={CLARIFIERS_ART.driveMotor1} tone="lo" crease="faint" />

        {/* Clarifier 2 */}
        <Solid paths={CLARIFIERS_ART.basin2} tone={clarifierHL.tone} lit={clarifierHL.isLit} crease="faint" />
        <Solid paths={CLARIFIERS_ART.well2} tone="hi" crease="faint" />
        <Line d={CLARIFIERS_ART.bridge2} tone={clarifierHL.isLit ? "lit" : "mid"} free />
        <Solid paths={CLARIFIERS_ART.driveMotor2} tone="lo" crease="faint" />
      </g>

      {/* LAYER 4: CHEMICAL DOSING & CHLORINATION HOUSE */}
      <g
        key="chemical-house"
        className={`water-interactive-group ${chemHL.customClass}`}
        data-component="water-chemical"
        onClick={(e) => handleClick("water-chemical", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={CHEMICAL_ART.building} tone={chemHL.tone} lit={chemHL.isLit} crease="faint" />
        {CHEMICAL_ART.silos.map((s, i) => (
          <Solid key={`chem-silo-${i}`} paths={s} tone="hi" crease="faint" />
        ))}
      </g>

      {/* LAYER 5: RAPID GRAVITY SAND FILTRATION COMPLEX */}
      <g
        key="filtration-complex"
        className={`water-interactive-group ${filterHL.customClass}`}
        data-component="water-filters"
        onClick={(e) => handleClick("water-filters", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={FILTRATION_ART.building} tone={filterHL.tone} lit={filterHL.isLit} crease="faint" />
        <Line d={FILTRATION_ART.filterBays} tone={filterHL.isLit ? "lit" : "faint"} free />
        {FILTRATION_ART.backwashTanks.map((bw, i) => (
          <Solid key={`backwash-${i}`} paths={bw} tone="hi" crease="faint" />
        ))}
      </g>

      {/* LAYER 6: HIGH-PRESSURE BOOSTER PUMP HOUSE */}
      <g
        key="booster-pumps"
        className={`water-interactive-group ${pumpHL.customClass}`}
        data-component="water-booster-pumps"
        onClick={(e) => handleClick("water-booster-pumps", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={PUMP_HOUSE_ART.building} tone={pumpHL.tone} lit={pumpHL.isLit} crease="faint" />
        {PUMP_HOUSE_ART.roofVents.map((v, i) => (
          <Solid key={`roof-vent-${i}`} paths={v} tone="lo" crease="faint" />
        ))}
        <Line d={PUMP_HOUSE_ART.dischargeHeader} tone={pumpHL.isLit ? "lit" : "mid"} free />
      </g>

      {/* LAYER 7: MUNICIPAL POTABLE WATER RESERVOIR */}
      <g
        key="potable-reservoir"
        className={`water-interactive-group ${resHL.customClass}`}
        data-component="water-reservoir"
        onClick={(e) => handleClick("water-reservoir", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={RESERVOIR_ART.plinth} tone="lo" crease="faint" />
        <Solid paths={RESERVOIR_ART.tank} tone={resHL.tone} lit={resHL.isLit} crease="faint" />
        <Line d={RESERVOIR_ART.knurlRings} tone={resHL.isLit ? "lit" : "faint"} free />
        <Solid paths={RESERVOIR_ART.domeRoof} tone="hi" crease="faint" />
        <Line d={RESERVOIR_ART.accessLadder} tone="lo" free />
        <Line d={RESERVOIR_ART.telemetryAntenna} tone="hi" free />
      </g>

      {/* LAYER 8: INTERCONNECTING PROCESS WATER PIPING RUNS */}
      {showPiping && (
        <g key="process-piping" className="waterplant-flow-pipes">
          <Line d={PIPING_ART.pipeIntakeCascade} tone="lit" free />
          <Line d={PIPING_ART.pipeAerationCoag} tone="lit" free />
          <Line d={PIPING_ART.pipeClarifierFeeder} tone="lit" free />
          <Line d={PIPING_ART.pipeClarifierFilters} tone="lit" free />
          <Line d={PIPING_ART.pipeFiltersPumpReservoir} tone="lit" free />
        </g>
      )}
    </g>
  );
}
