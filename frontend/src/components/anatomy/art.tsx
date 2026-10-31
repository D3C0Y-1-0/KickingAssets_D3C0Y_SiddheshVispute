import * as React from "react";
import { Dots, Line, Solid } from "../iso/react/draw";
import {
  ARRESTER_ART,
  BREAKER_ART,
  BUSHING_ART,
  CABINET_ART,
  CONSERVATOR_ART,
  DISCONNECT_ART,
  GANTRY_ART,
  GROUND_ART,
  PLINTH_ART,
  RADIATOR_ART,
  TRENCH_ART,
  TRANSFORMER_ART,
  YARD_ART,
} from "./geometry";

interface SubstationArtProps {
  selectedComponentId?: string;
  statusMap?: Record<string, "operational" | "degraded" | "offline" | "maintenance">;
  showJumpers?: boolean;
  showGroundGrid?: boolean;
  onSelectComponent?: (componentId: string) => void;
}

export function SubstationArt({
  selectedComponentId,
  statusMap = {},
  showJumpers = true,
  showGroundGrid = true,
  onSelectComponent,
}: SubstationArtProps) {
  // Helper to determine styling for each component
  const getComponentHighlight = (componentId: string) => {
    const isSelected = selectedComponentId === componentId;
    const status = statusMap[componentId] || "operational";

    let tone: "hi" | "mid" | "lo" = "mid";
    let isLit = false;
    let customClass = "";

    if (isSelected) {
      tone = "hi";
      isLit = true;
      customClass = "substation-selected-part";
    }

    if (status === "offline") {
      customClass += " substation-offline-pulse";
    } else if (status === "degraded") {
      customClass += " substation-warning-pulse";
    }

    return { tone, isLit, isSelected, customClass };
  };

  const trHighlight = getComponentHighlight("sub-transformer");
  const radHighlight = getComponentHighlight("sub-radiators");
  const bushHighlight = getComponentHighlight("sub-bushings");
  const cbHighlight = getComponentHighlight("sub-circuit-breaker");
  const dsHighlight = getComponentHighlight("sub-disconnect-switch");
  const laHighlight = getComponentHighlight("sub-lightning-arrester");
  const gantryHighlight = getComponentHighlight("sub-busbar-gantry");
  const cpHighlight = getComponentHighlight("sub-control-cabinet");
  const gndHighlight = getComponentHighlight("sub-grounding");
  const trenchHighlight = getComponentHighlight("sub-rtu-cable");

  const handleClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectComponent) {
      onSelectComponent(id);
    }
  };

  return (
    <g className="substation-assembly" role="group" aria-label="Electrical Substation Digital Twin Assembly">
      {/* ------------------------------------------------------------- */}
      {/* LAYER 1: FOUNDATION SLAB & GRAVEL YARD */}
      {/* ------------------------------------------------------------- */}
      <g key="yard-foundation" className="substation-layer-foundation">
        <Solid paths={YARD_ART.yard} tone="lo" crease="faint" />
        <Solid paths={YARD_ART.pad} tone="lo" crease="faint" />
        <Line d={YARD_ART.padGroove} tone="lo" free />
        <Dots points={YARD_ART.screws} size={0.5} tone="lo" />

        {/* Equipment Raised Plinths */}
        <Solid paths={PLINTH_ART.tr} tone="lo" crease="faint" />
        <Solid paths={PLINTH_ART.cb} tone="lo" crease="faint" />
        <Solid paths={PLINTH_ART.ds} tone="lo" crease="faint" />
        <Solid paths={PLINTH_ART.la} tone="lo" crease="faint" />
        <Solid paths={PLINTH_ART.cp} tone="lo" crease="faint" />
        {PLINTH_ART.gantryFootings.map((ft, i) => (
          <Solid key={`gantry-ft-${i}`} paths={ft} tone="lo" crease="faint" />
        ))}
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 2: CABLE TRENCH & RTU TRUNKING */}
      {/* ------------------------------------------------------------- */}
      <g
        key="cable-trench"
        className={`substation-interactive-group ${trenchHighlight.customClass}`}
        data-component="sub-rtu-cable"
        onClick={(e) => handleClick("sub-rtu-cable", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={TRENCH_ART.slab1} tone={trenchHighlight.tone} lit={trenchHighlight.isLit} crease="faint" />
        <Solid paths={TRENCH_ART.slab2} tone={trenchHighlight.tone} lit={trenchHighlight.isLit} crease="faint" />
        <Solid paths={TRENCH_ART.slab3} tone={trenchHighlight.tone} lit={trenchHighlight.isLit} crease="faint" />
        <Line d={TRENCH_ART.grooves} tone={trenchHighlight.isSelected ? "hi" : "faint"} free />
        <Line d={TRENCH_ART.joints} tone={trenchHighlight.isSelected ? "lit" : "lo"} free />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 3: GROUNDING GRID & EARTH RISERS */}
      {/* ------------------------------------------------------------- */}
      {showGroundGrid && (
        <g
          key="ground-grid"
          className={`substation-interactive-group ${gndHighlight.customClass}`}
          data-component="sub-grounding"
          onClick={(e) => handleClick("sub-grounding", e)}
          style={{ cursor: "pointer" }}
        >
          <Line
            d={GROUND_ART.perimeter}
            tone={gndHighlight.isSelected ? "lit" : "lo"}
            dashed
            free
          />
          <Line
            d={GROUND_ART.meshLines}
            tone={gndHighlight.isSelected ? "lit" : "faint"}
            dashed
            free
          />
          <Line
            d={GROUND_ART.risers}
            tone={gndHighlight.isSelected ? "lit" : "mid"}
            free
          />
        </g>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LAYER 4: REAR GANTRY STEEL LATTICE TOWERS */}
      {/* ------------------------------------------------------------- */}
      <g key="gantry-structure" className="substation-layer-gantry">
        <Line d={GANTRY_ART.leftTower} tone={gantryHighlight.isSelected ? "lit" : "lo"} free />
        <Line d={GANTRY_ART.rightTower} tone={gantryHighlight.isSelected ? "lit" : "lo"} free />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 5: TRANSFORMER COOLING RADIATOR BANKS (BACK) */}
      {/* ------------------------------------------------------------- */}
      <g
        key="transformer-radiators"
        className={`substation-interactive-group ${radHighlight.customClass}`}
        data-component="sub-radiators"
        onClick={(e) => handleClick("sub-radiators", e)}
        style={{ cursor: "pointer" }}
      >
        {RADIATOR_ART.fins.map((fin, idx) => (
          <Solid
            key={`fin-${idx}`}
            paths={fin}
            tone={radHighlight.tone}
            lit={radHighlight.isLit}
            crease="faint"
          />
        ))}
        <Solid paths={RADIATOR_ART.topHeaderPipe} tone="lo" crease="none" />
        <Solid paths={RADIATOR_ART.botHeaderPipe} tone="lo" crease="none" />
        {RADIATOR_ART.fans.map((fan, idx) => (
          <Solid key={`fan-${idx}`} paths={fan} tone={radHighlight.tone} crease="faint" />
        ))}
        <Line d={RADIATOR_ART.fanGrilles} tone={radHighlight.isSelected ? "lit" : "lo"} free />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 6: MAIN POWER TRANSFORMER BODY & TANK */}
      {/* ------------------------------------------------------------- */}
      <g
        key="main-transformer"
        className={`substation-interactive-group ${trHighlight.customClass}`}
        data-component="sub-transformer"
        onClick={(e) => handleClick("sub-transformer", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid paths={TRANSFORMER_ART.skidLeft} tone="lo" crease="faint" />
        <Solid paths={TRANSFORMER_ART.skidRight} tone="lo" crease="faint" />
        <Solid
          paths={TRANSFORMER_ART.tank}
          tone={trHighlight.tone}
          lit={trHighlight.isLit}
          crease="lo"
        />
        <Solid paths={TRANSFORMER_ART.tankFlange} tone={trHighlight.tone} crease="faint" />
        <Dots points={TRANSFORMER_ART.tankBolts} size={0.5} tone="mid" />
        <Line d={TRANSFORMER_ART.tankSeams} tone={trHighlight.isSelected ? "lit" : "lo"} free />

        {/* Marshalling terminal box on front face */}
        <Solid paths={TRANSFORMER_ART.marshallingBox} tone="mid" crease="faint" />
        <Line d={TRANSFORMER_ART.marshallingDoor} tone="lo" free />

        {/* Drain valve and oil sight glass */}
        <Solid paths={TRANSFORMER_ART.drainPipe} tone="lo" crease="none" />
        <Line d={TRANSFORMER_ART.drainWheel} tone="hi" free />
        <Line d={TRANSFORMER_ART.sightGlass} tone={trHighlight.isSelected ? "lit" : "lo"} free />
        <Line d={TRANSFORMER_ART.sightTicks.minor} tone="faint" free />
        <Line d={TRANSFORMER_ART.sightTicks.major} tone="lo" free />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 7: CONSERVATOR TANK & BUCHHOLZ RELAY */}
      {/* ------------------------------------------------------------- */}
      <g key="conservator-assembly">
        <Line d={CONSERVATOR_ART.brackets} tone="lo" free />
        <Solid paths={CONSERVATOR_ART.body} tone={trHighlight.tone} lit={trHighlight.isLit} crease="faint" />
        <Line d={CONSERVATOR_ART.endCap} tone={trHighlight.isSelected ? "lit" : "lo"} free />
        <Line d={CONSERVATOR_ART.pipeDown} tone="lo" free />
        <Solid paths={CONSERVATOR_ART.buchholz} tone="hi" crease="faint" />
        <Line d={CONSERVATOR_ART.breatherPipe} tone="lo" free />
        <Solid paths={CONSERVATOR_ART.silicaCanister} tone="mid" crease="faint" />
        <Line d={CONSERVATOR_ART.canisterRing} tone="faint" free />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 8: TRANSFORMER HIGH-VOLTAGE & LOW-VOLTAGE BUSHINGS */}
      {/* ------------------------------------------------------------- */}
      <g
        key="transformer-bushings"
        className={`substation-interactive-group ${bushHighlight.customClass}`}
        data-component="sub-bushings"
        onClick={(e) => handleClick("sub-bushings", e)}
        style={{ cursor: "pointer" }}
      >
        {/* HV 33kV Turrets & Columns */}
        {BUSHING_ART.hvTurrets.map((turret, i) => (
          <Solid key={`hv-turret-${i}`} paths={turret} tone="lo" crease="none" />
        ))}
        {BUSHING_ART.hvColumns.map((col, i) => (
          <Solid key={`hv-col-${i}`} paths={col} tone={bushHighlight.tone} lit={bushHighlight.isLit} crease="none" />
        ))}
        {/* Stepped Porcelain Shed Skirts */}
        {BUSHING_ART.hvSheds.map((shed, i) => (
          <Solid key={`hv-shed-${i}`} paths={shed} tone={bushHighlight.tone} crease="faint" />
        ))}
        {BUSHING_ART.hvTerminals.map((term, i) => (
          <Solid key={`hv-term-${i}`} paths={term} tone="hi" crease="none" />
        ))}

        {/* LV 11kV Bushings on front shelf */}
        {BUSHING_ART.lvBushings.map((lv, i) => (
          <Solid key={`lv-bush-${i}`} paths={lv} tone={bushHighlight.tone} crease="faint" />
        ))}
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 9: HIGH-VOLTAGE SF6 CIRCUIT BREAKER */}
      {/* ------------------------------------------------------------- */}
      <g
        key="circuit-breaker"
        className={`substation-interactive-group ${cbHighlight.customClass}`}
        data-component="sub-circuit-breaker"
        onClick={(e) => handleClick("sub-circuit-breaker", e)}
        style={{ cursor: "pointer" }}
      >
        <Line d={BREAKER_ART.legs} tone="lo" free />
        <Solid
          paths={BREAKER_ART.mechanismBox}
          tone={cbHighlight.tone}
          lit={cbHighlight.isLit}
          crease="lo"
        />
        <Line d={BREAKER_ART.gaugeRing} tone={cbHighlight.isSelected ? "lit" : "lo"} free />
        <Line d={BREAKER_ART.gaugePointer} tone="hi" free />
        <Solid paths={BREAKER_ART.manualHandle} tone="hi" crease="none" />

        {/* 3 Vertical Phase Interrupter Columns */}
        {BREAKER_ART.poles.map((pole, i) => (
          <Solid key={`cb-pole-${i}`} paths={pole} tone={cbHighlight.tone} lit={cbHighlight.isLit} crease="none" />
        ))}
        <Line d={BREAKER_ART.poleShedRings} tone={cbHighlight.isSelected ? "lit" : "lo"} free />
        {BREAKER_ART.heads.map((head, i) => (
          <Solid key={`cb-head-${i}`} paths={head} tone={cbHighlight.tone} crease="faint" />
        ))}
        {BREAKER_ART.terminals.map((term, i) => (
          <Solid key={`cb-term-${i}`} paths={term} tone="hi" crease="none" />
        ))}
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 10: MOTORIZED DISCONNECT SWITCH / ISOLATOR */}
      {/* ------------------------------------------------------------- */}
      <g
        key="disconnect-switch"
        className={`substation-interactive-group ${dsHighlight.customClass}`}
        data-component="sub-disconnect-switch"
        onClick={(e) => handleClick("sub-disconnect-switch", e)}
        style={{ cursor: "pointer" }}
      >
        <Line d={DISCONNECT_ART.legs} tone="lo" free />
        <Solid paths={DISCONNECT_ART.baseBeam} tone={dsHighlight.tone} crease="faint" />
        <Solid paths={DISCONNECT_ART.driveBox} tone="mid" crease="faint" />
        <Solid paths={DISCONNECT_ART.driveShaft} tone="lo" crease="none" />

        {/* 3 Pairs of Rotating Post Insulators */}
        {DISCONNECT_ART.insulators.map((ins, i) => (
          <Solid key={`ds-ins-${i}`} paths={ins} tone={dsHighlight.tone} lit={dsHighlight.isLit} crease="none" />
        ))}
        <Line d={DISCONNECT_ART.insulatorRings} tone={dsHighlight.isSelected ? "lit" : "lo"} free />
        <Line d={DISCONNECT_ART.blades} tone="hi" free />
        {DISCONNECT_ART.contacts.map((contact, i) => (
          <Solid key={`ds-cont-${i}`} paths={contact} tone="hi" crease="none" />
        ))}
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 11: SURGE / LIGHTNING ARRESTERS */}
      {/* ------------------------------------------------------------- */}
      <g
        key="lightning-arresters"
        className={`substation-interactive-group ${laHighlight.customClass}`}
        data-component="sub-lightning-arrester"
        onClick={(e) => handleClick("sub-lightning-arrester", e)}
        style={{ cursor: "pointer" }}
      >
        {ARRESTER_ART.stands.map((st, i) => (
          <Solid key={`la-stand-${i}`} paths={st} tone="lo" crease="none" />
        ))}
        {ARRESTER_ART.counterBoxes.map((cb, i) => (
          <Solid key={`la-box-${i}`} paths={cb} tone="hi" crease="faint" />
        ))}
        {ARRESTER_ART.columns.map((col, i) => (
          <Solid key={`la-col-${i}`} paths={col} tone={laHighlight.tone} lit={laHighlight.isLit} crease="none" />
        ))}
        <Line d={ARRESTER_ART.shedRings} tone={laHighlight.isSelected ? "lit" : "lo"} free />
        {ARRESTER_ART.terminals.map((term, i) => (
          <Solid key={`la-term-${i}`} paths={term} tone="hi" crease="none" />
        ))}
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 12: CONTROL & PROTECTION CABINET (RELAYS & SCADA) */}
      {/* ------------------------------------------------------------- */}
      <g
        key="control-cabinet"
        className={`substation-interactive-group ${cpHighlight.customClass}`}
        data-component="sub-control-cabinet"
        onClick={(e) => handleClick("sub-control-cabinet", e)}
        style={{ cursor: "pointer" }}
      >
        <Solid
          paths={CABINET_ART.enclosure}
          tone={cpHighlight.tone}
          lit={cpHighlight.isLit}
          crease="lo"
        />
        <Solid paths={CABINET_ART.canopy} tone={cpHighlight.tone} crease="faint" />
        <Line d={CABINET_ART.doorSplit} tone={cpHighlight.isSelected ? "lit" : "lo"} free />
        <Solid paths={CABINET_ART.leftHandle} tone="hi" crease="none" />
        <Solid paths={CABINET_ART.rightHandle} tone="hi" crease="none" />
        <Line d={CABINET_ART.louvers} tone="faint" free />

        {/* Warning Strobe Beacon on top */}
        <Solid paths={CABINET_ART.beaconStem} tone="lo" crease="none" />
        <Solid paths={CABINET_ART.beaconLens} tone="hi" lit={cpHighlight.isSelected} crease="none" />

        {/* Protection Relays displayed on front panel */}
        {CABINET_ART.relays.map((relay, i) => (
          <Solid key={`relay-${i}`} paths={relay} tone="hi" crease="faint" />
        ))}
        <Line d={CABINET_ART.relayScreens} tone="lo" free />
        <Dots points={CABINET_ART.relayLeds} size={0.4} tone={cpHighlight.isSelected ? "hi" : "mid"} />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 13: GANTRY CROSS-ARM & SUSPENDED 33kV BUSBARS */}
      {/* ------------------------------------------------------------- */}
      <g
        key="gantry-busbars"
        className={`substation-interactive-group ${gantryHighlight.customClass}`}
        data-component="sub-busbar-gantry"
        onClick={(e) => handleClick("sub-busbar-gantry", e)}
        style={{ cursor: "pointer" }}
      >
        <Line d={GANTRY_ART.bridge} tone={gantryHighlight.isSelected ? "lit" : "lo"} free />
        {GANTRY_ART.insulators.map((ins, i) => (
          <Solid key={`gantry-ins-${i}`} paths={ins} tone={gantryHighlight.tone} crease="none" />
        ))}
        {/* 3 Overhead Rigid Busbars */}
        <Line d={GANTRY_ART.busbarA} tone={gantryHighlight.isSelected ? "lit" : "hi"} free />
        <Line d={GANTRY_ART.busbarB} tone={gantryHighlight.isSelected ? "lit" : "hi"} free />
        <Line d={GANTRY_ART.busbarC} tone={gantryHighlight.isSelected ? "lit" : "hi"} free />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 14: HIGH-VOLTAGE POWER FLOW JUMPER CABLES */}
      {/* ------------------------------------------------------------- */}
      {showJumpers && (
        <g key="hv-jumpers" className="substation-layer-jumpers">
          {/* Overhead Busbars to Disconnect Switch */}
          <Line d={GANTRY_ART.dropperToDS} tone="hi" free />
          {/* Disconnect Switch to Circuit Breaker */}
          <Line d={GANTRY_ART.dropperDSToCB} tone="hi" free />
          {/* Circuit Breaker to Transformer HV Bushings */}
          <Line d={GANTRY_ART.dropperCBToTR} tone="hi" flow={true} free />
          {/* Transformer Bushings to Lightning Arresters */}
          <Line d={GANTRY_ART.jumperTRToLA} tone="mid" dashed={true} free />
        </g>
      )}
    </g>
  );
}
