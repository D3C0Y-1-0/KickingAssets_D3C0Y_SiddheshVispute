import * as React from 'react'
import { Dots, Line, Solid } from '../iso/react/draw'
import {
  EDGE_CAMPUS_ART,
  HOSP_CAMPUS_ART,
  INTERCONNECT_ART,
  IOC_CAMPUS_ART,
  ISLAND_BASES,
  POWER_CAMPUS_ART,
  PULSE_NETWORKS,
  TRANSIT_CAMPUS_ART,
  WATER_CAMPUS_ART,
} from './geometry'

interface SmartCityArtProps {
  selectedComponentId?: string
  statusMap?: Record<string, 'operational' | 'degraded' | 'offline' | 'maintenance'>
  showMicrogrid?: boolean
  showFiberMesh?: boolean
  showTransitFlow?: boolean
  showBridges?: boolean
  showWirelessWaves?: boolean
  onSelectComponent?: (componentId: string) => void
}

export function SmartCityArt({
  selectedComponentId,
  statusMap = {},
  showMicrogrid = true,
  showFiberMesh = true,
  showTransitFlow = true,
  showBridges = true,
  showWirelessWaves = true,
  onSelectComponent,
}: SmartCityArtProps) {
  // Highlight determination helper
  const getHighlight = (componentId: string) => {
    const isSelected = selectedComponentId === componentId
    const status = statusMap[componentId] || 'operational'

    let tone: 'hi' | 'mid' | 'lo' = 'mid'
    let isLit = false
    let customClass = ''

    if (isSelected) {
      tone = 'hi'
      isLit = true
      customClass = 'smartcity-selected-part'
    }

    if (status === 'offline') {
      customClass += ' smartcity-offline-pulse'
    } else if (status === 'degraded') {
      customClass += ' smartcity-warning-pulse'
    }

    return { tone, isLit, isSelected, customClass }
  }

  const powerHL = getHighlight('city-substation')
  const edgeHL = getHighlight('city-edge-dc')
  const iocHL = getHighlight('city-ioc')
  const waterHL = getHighlight('city-water')
  const reservoirHL = getHighlight('city-reservoir')
  const hospHL = getHighlight('city-hospital')
  const transitHL = getHighlight('city-transit-rail')
  const evHL = getHighlight('city-ev-hub')
  const bessHL = getHighlight('city-bess')
  const solarHL = getHighlight('city-solar')
  const trenchHL = getHighlight('city-utility-trench')

  const handleClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSelectComponent) {
      onSelectComponent(id)
    }
  }

  return (
    <g
      className="smartcity-assembly"
      role="group"
      aria-label="Distributed Smart City Architecture Digital Twin"
    >
      {/* ------------------------------------------------------------- */}
      {/* LAYER 0: SUBTERRANEAN COORDINATE ALIGNMENT GRID */}
      {/* ------------------------------------------------------------- */}
      <g key="subterranean-grid" className="smartcity-subgrid">
        <Line d={INTERCONNECT_ART.subGrid} tone="faint" dashed free />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 1: BASE 2 — 5G TELECOM & EDGE COMPUTE ISLAND (TOP-LEFT) */}
      {/* ------------------------------------------------------------- */}
      <g
        key="island-edge-compound"
        className={`smartcity-interactive-group city-color-edge ${edgeHL.customClass}`}
        data-component="city-edge-dc"
        onClick={(e) => handleClick('city-edge-dc', e)}
        style={{ cursor: 'pointer' }}
      >
        {/* Dedicated Foundation Platform Slab */}
        <Solid paths={ISLAND_BASES.edge} tone="lo" crease="faint" />
        <Line d={ISLAND_BASES.edgeCurbs} tone={edgeHL.isSelected ? 'lit' : 'faint'} free />

        {/* Modular Edge Datacenter Bunker */}
        <Solid
          paths={EDGE_CAMPUS_ART.bunker}
          tone={edgeHL.tone}
          lit={edgeHL.isLit}
          crease="faint"
        />
        <Line d={EDGE_CAMPUS_ART.bunkerLines} tone={edgeHL.isSelected ? 'lit' : 'faint'} free />

        {/* Rooftop Dual HVAC Chillers */}
        <Solid paths={EDGE_CAMPUS_ART.chiller1} tone="lo" crease="faint" />
        <Solid paths={EDGE_CAMPUS_ART.chiller2} tone="lo" crease="faint" />
        <Line d={EDGE_CAMPUS_ART.chillerFans} tone={edgeHL.isSelected ? 'lit' : 'faint'} free />

        {/* 5G Telecom Communications Lattice Mast (Z=165) */}
        <Line d={EDGE_CAMPUS_ART.mastPillars} tone={edgeHL.isSelected ? 'lit' : 'mid'} free />
        <Line d={EDGE_CAMPUS_ART.mastBays} tone={edgeHL.isSelected ? 'lit' : 'lo'} free />

        {/* 3-Sector 5G MIMO Phased Panels */}
        <Solid
          paths={EDGE_CAMPUS_ART.mimo1}
          tone={edgeHL.isSelected ? 'hi' : 'mid'}
          lit={edgeHL.isLit}
          crease="faint"
        />
        <Solid
          paths={EDGE_CAMPUS_ART.mimo2}
          tone={edgeHL.isSelected ? 'hi' : 'mid'}
          lit={edgeHL.isLit}
          crease="faint"
        />
        <Solid
          paths={EDGE_CAMPUS_ART.mimo3}
          tone={edgeHL.isSelected ? 'hi' : 'mid'}
          lit={edgeHL.isLit}
          crease="faint"
        />

        {/* Directional Microwave Drum Dishes */}
        <Solid
          paths={EDGE_CAMPUS_ART.microwaveDish1}
          tone={edgeHL.isSelected ? 'hi' : 'mid'}
          lit={edgeHL.isLit}
          crease="faint"
        />
        <Solid
          paths={EDGE_CAMPUS_ART.microwaveDish2}
          tone={edgeHL.isSelected ? 'hi' : 'mid'}
          lit={edgeHL.isLit}
          crease="faint"
        />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 2: BASE 3 — IOC COMMAND SKYSCRAPER & CIVIC PLAZA (TOP-RIGHT) */}
      {/* ------------------------------------------------------------- */}
      <g
        key="island-ioc-plaza"
        className={`smartcity-interactive-group city-color-ioc ${iocHL.customClass}`}
        data-component="city-ioc"
        onClick={(e) => handleClick('city-ioc', e)}
        style={{ cursor: 'pointer' }}
      >
        {/* Tiered Civic Foundation Platform Slab */}
        <Solid paths={ISLAND_BASES.iocLower} tone="lo" crease="faint" />
        <Solid paths={ISLAND_BASES.iocTerrace} tone="lo" crease="faint" />
        <Line d={ISLAND_BASES.iocPlazaSteps} tone={iocHL.isSelected ? 'lit' : 'faint'} free />

        {/* Multi-Tier Stepped Glass Skyscraper (Stage 1, 2, 3) */}
        <Solid paths={IOC_CAMPUS_ART.stage1} tone={iocHL.tone} lit={iocHL.isLit} crease="faint" />
        <Line d={IOC_CAMPUS_ART.stage1Lines} tone={iocHL.isSelected ? 'lit' : 'faint'} free />
        <Solid paths={IOC_CAMPUS_ART.stage2} tone={iocHL.tone} lit={iocHL.isLit} crease="faint" />
        <Line d={IOC_CAMPUS_ART.stage2Bands} tone={iocHL.isSelected ? 'lit' : 'faint'} free />
        <Solid paths={IOC_CAMPUS_ART.stage3} tone={iocHL.tone} lit={iocHL.isLit} crease="faint" />
        <Line d={IOC_CAMPUS_ART.stage3Bands} tone={iocHL.isSelected ? 'lit' : 'faint'} free />
        <Line d={IOC_CAMPUS_ART.mullions} tone={iocHL.isSelected ? 'lit' : 'faint'} free />

        {/* Rooftop Drone / Helipad Operations Deck */}
        <Line d={IOC_CAMPUS_ART.helipadRing} tone={iocHL.isSelected ? 'lit' : 'mid'} free />
        <Line d={IOC_CAMPUS_ART.helipadH} tone={iocHL.isSelected ? 'lit' : 'hi'} free />

        {/* Parabolic Satellite Ground Station Dishes */}
        <Solid paths={IOC_CAMPUS_ART.dish1Pedestal} tone="lo" crease="faint" />
        <Solid
          paths={IOC_CAMPUS_ART.dish1Bowl}
          tone={iocHL.isSelected ? 'hi' : 'mid'}
          lit={iocHL.isLit}
          crease="faint"
        />
        <Solid paths={IOC_CAMPUS_ART.dish2Pedestal} tone="lo" crease="faint" />
        <Solid
          paths={IOC_CAMPUS_ART.dish2Bowl}
          tone={iocHL.isSelected ? 'hi' : 'mid'}
          lit={iocHL.isLit}
          crease="faint"
        />

        {/* Rooftop Emergency Telemetry Spire (Z=172) */}
        <Line d={IOC_CAMPUS_ART.telemetrySpire} tone={iocHL.isSelected ? 'lit' : 'mid'} free />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 3: BASE 4 — WATER PURIFICATION & RESERVOIR (MID-RIGHT) */}
      {/* ------------------------------------------------------------- */}
      <g
        key="island-water-works"
        className={`smartcity-interactive-group city-color-water ${waterHL.customClass}`}
        data-component="city-water"
        onClick={(e) => handleClick('city-water', e)}
        style={{ cursor: 'pointer' }}
      >
        {/* Dedicated Foundation Platform Slab */}
        <Solid paths={ISLAND_BASES.water} tone="lo" crease="faint" />
        <Line d={ISLAND_BASES.waterCurbs} tone={waterHL.isSelected ? 'lit' : 'faint'} free />

        {/* 3 Sand & Carbon Filtration Vessels */}
        <Solid
          paths={WATER_CAMPUS_ART.filter1}
          tone={waterHL.tone}
          lit={waterHL.isLit}
          crease="faint"
        />
        <Solid
          paths={WATER_CAMPUS_ART.filter2}
          tone={waterHL.tone}
          lit={waterHL.isLit}
          crease="faint"
        />
        <Solid
          paths={WATER_CAMPUS_ART.filter3}
          tone={waterHL.tone}
          lit={waterHL.isLit}
          crease="faint"
        />
        <Line d={WATER_CAMPUS_ART.pipingManifold} tone={waterHL.isSelected ? 'lit' : 'mid'} free />
        <Solid paths={WATER_CAMPUS_ART.pumpShed} tone="mid" crease="faint" />
      </g>

      <g
        key="reservoir-tower"
        className={`smartcity-interactive-group city-color-water ${reservoirHL.customClass}`}
        data-component="city-reservoir"
        onClick={(e) => handleClick('city-reservoir', e)}
        style={{ cursor: 'pointer' }}
      >
        {/* Elevated Potable Water Reservoir Tank */}
        <Solid paths={WATER_CAMPUS_ART.tankPedestal} tone="lo" crease="faint" />
        <Solid
          paths={WATER_CAMPUS_ART.tankDrum}
          tone={reservoirHL.tone}
          lit={reservoirHL.isLit}
          crease="faint"
        />
        <Solid
          paths={WATER_CAMPUS_ART.tankDome}
          tone={reservoirHL.tone}
          lit={reservoirHL.isLit}
          crease="faint"
        />
        <Line d={WATER_CAMPUS_ART.tankSeam} tone={reservoirHL.isSelected ? 'lit' : 'lo'} free />
        <Line
          d={WATER_CAMPUS_ART.tankLadder}
          tone={reservoirHL.isSelected ? 'lit' : 'faint'}
          free
        />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 4: BASE 1 — ELECTRICITY POWER PLANT & SUBSTATION (MID-LEFT) */}
      {/* ------------------------------------------------------------- */}
      <g
        key="island-power-substation"
        className={`smartcity-interactive-group city-color-power ${powerHL.customClass}`}
        data-component="city-substation"
        onClick={(e) => handleClick('city-substation', e)}
        style={{ cursor: 'pointer' }}
      >
        {/* Dedicated Foundation Platform Slab */}
        <Solid paths={ISLAND_BASES.power} tone="lo" crease="faint" />
        <Line d={ISLAND_BASES.powerCurbs} tone={powerHL.isSelected ? 'lit' : 'faint'} free />
        <Dots points={ISLAND_BASES.powerGravel} size={0.5} tone="lo" />

        {/* 33/11kV Main Power Transformer Tank */}
        <Solid paths={POWER_CAMPUS_ART.trPlinth} tone="lo" crease="faint" />
        <Solid
          paths={POWER_CAMPUS_ART.trTank}
          tone={powerHL.tone}
          lit={powerHL.isLit}
          crease="faint"
        />
        {POWER_CAMPUS_ART.radiators.map((rad, i) => (
          <Solid key={`radiator-${i}`} paths={rad} tone="lo" crease="faint" />
        ))}
        <Line d={POWER_CAMPUS_ART.radiatorFins} tone={powerHL.isSelected ? 'lit' : 'faint'} free />

        {/* Conservator Oil Tank */}
        <Solid paths={POWER_CAMPUS_ART.conservator} tone="mid" crease="faint" />
        <Line d={POWER_CAMPUS_ART.conservatorPipe} tone="mid" free />

        {/* High-Voltage Porcelain Bushings with Sheds */}
        {POWER_CAMPUS_ART.bushings.map((bsh, i) => (
          <Solid
            key={`bushing-${i}`}
            paths={bsh}
            tone={powerHL.isSelected ? 'hi' : 'mid'}
            lit={powerHL.isLit}
            crease="faint"
          />
        ))}
        <Line d={POWER_CAMPUS_ART.bushingKnurls} tone={powerHL.isSelected ? 'lit' : 'lo'} free />

        {/* Switchgear Breakers & Grounding Grid */}
        <Solid paths={POWER_CAMPUS_ART.cbPlinth} tone="lo" crease="faint" />
        {POWER_CAMPUS_ART.cbPoles.map((pole, i) => (
          <Solid key={`cb-pole-${i}`} paths={pole} tone="mid" crease="faint" />
        ))}
        <Line
          d={POWER_CAMPUS_ART.groundingGrid}
          tone={powerHL.isSelected ? 'lit' : 'lo'}
          dashed
          free
        />
      </g>

      {/* BESS Pods & Solar Canopy Subsystems */}
      <g
        key="bess-storage-pods"
        className={`smartcity-interactive-group city-color-power ${bessHL.customClass}`}
        data-component="city-bess"
        onClick={(e) => handleClick('city-bess', e)}
        style={{ cursor: 'pointer' }}
      >
        <Solid
          paths={POWER_CAMPUS_ART.bessPod1}
          tone={bessHL.tone}
          lit={bessHL.isLit}
          crease="faint"
        />
        <Solid
          paths={POWER_CAMPUS_ART.bessPod2}
          tone={bessHL.tone}
          lit={bessHL.isLit}
          crease="faint"
        />
        <Line d={POWER_CAMPUS_ART.bessDetails} tone={bessHL.isSelected ? 'lit' : 'faint'} free />
      </g>

      <g
        key="solar-canopy-subsystem"
        className={`smartcity-interactive-group city-color-power ${solarHL.customClass}`}
        data-component="city-solar"
        onClick={(e) => handleClick('city-solar', e)}
        style={{ cursor: 'pointer' }}
      >
        <Line d={POWER_CAMPUS_ART.solarPosts} tone="mid" free />
        <Solid
          paths={POWER_CAMPUS_ART.solarPlane}
          tone={solarHL.tone}
          lit={solarHL.isLit}
          crease="faint"
        />
        <Line d={POWER_CAMPUS_ART.solarGrid} tone={solarHL.isSelected ? 'lit' : 'faint'} free />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 5: BASE 5 — REGIONAL TRAUMA HOSPITAL MEDICAL CAMPUS */}
      {/* ------------------------------------------------------------- */}
      <g
        key="island-hospital-campus"
        className={`smartcity-interactive-group city-color-hospital ${hospHL.customClass}`}
        data-component="city-hospital"
        onClick={(e) => handleClick('city-hospital', e)}
        style={{ cursor: 'pointer' }}
      >
        {/* Dedicated Medical Campus Podium Slab */}
        <Solid paths={ISLAND_BASES.hosp} tone="lo" crease="faint" />
        <Line d={ISLAND_BASES.hospCurbs} tone={hospHL.isSelected ? 'lit' : 'faint'} free />
        <Solid paths={ISLAND_BASES.hospRamp} tone="lo" crease="faint" />

        {/* Main 5-Story Clinical Hospital Ward Building */}
        <Solid
          paths={HOSP_CAMPUS_ART.mainWard}
          tone={hospHL.tone}
          lit={hospHL.isLit}
          crease="faint"
        />
        <Line d={HOSP_CAMPUS_ART.floorBands} tone={hospHL.isSelected ? 'lit' : 'faint'} free />

        {/* Emergency Trauma Intake Wing & Covered Bay */}
        <Solid
          paths={HOSP_CAMPUS_ART.emergencyWing}
          tone={hospHL.tone}
          lit={hospHL.isLit}
          crease="faint"
        />
        <Solid paths={HOSP_CAMPUS_ART.ambulanceCanopy} tone="mid" crease="faint" />
        <Line d={HOSP_CAMPUS_ART.canopyPillars} tone="mid" free />

        {/* 3D Emergency Ambulance Vehicle */}
        <Solid
          paths={HOSP_CAMPUS_ART.ambulanceBody}
          tone={hospHL.isSelected ? 'hi' : 'mid'}
          lit={hospHL.isLit}
          crease="faint"
        />
        <Solid paths={HOSP_CAMPUS_ART.ambulanceBeacon} tone="hi" lit={true} crease="faint" />

        {/* Rooftop Trauma Helipad & Red Cross Sign */}
        <Line d={HOSP_CAMPUS_ART.helipadRing} tone={hospHL.isSelected ? 'lit' : 'mid'} free />
        <Line d={HOSP_CAMPUS_ART.crossSymbol} tone={hospHL.isSelected ? 'lit' : 'hi'} free />

        {/* Cryogenic Medical Liquid Oxygen Tank */}
        <Solid paths={HOSP_CAMPUS_ART.oxygenTank} tone="mid" crease="faint" />
        <Line d={HOSP_CAMPUS_ART.oxygenPipes} tone="mid" free />

        {/* Emergency Backup Diesel Generator Pod */}
        <Solid paths={HOSP_CAMPUS_ART.generatorPod} tone="lo" crease="faint" />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 6: BASE 6 — SMART TRANSIT & EV MOBILITY HUB (BOTTOM-LEFT) */}
      {/* ------------------------------------------------------------- */}
      <g
        key="island-transit-hub"
        className={`smartcity-interactive-group city-color-transit ${evHL.customClass}`}
        data-component="city-ev-hub"
        onClick={(e) => handleClick('city-ev-hub', e)}
        style={{ cursor: 'pointer' }}
      >
        {/* Dedicated Transit Platform Slab */}
        <Solid paths={ISLAND_BASES.transit} tone="lo" crease="faint" />
        <Line d={ISLAND_BASES.transitCurbs} tone={evHL.isSelected ? 'lit' : 'faint'} free />
        <Line d={ISLAND_BASES.transitStripes} tone={evHL.isSelected ? 'lit' : 'faint'} free />

        {/* Passenger Terminal Concourse */}
        <Solid
          paths={TRANSIT_CAMPUS_ART.terminal}
          tone={evHL.tone}
          lit={evHL.isLit}
          crease="faint"
        />
        <Line
          d={TRANSIT_CAMPUS_ART.terminalRoofLines}
          tone={evHL.isSelected ? 'lit' : 'faint'}
          free
        />

        {/* Autonomous Electric Transit Bus */}
        <Solid
          paths={TRANSIT_CAMPUS_ART.busBody}
          tone={evHL.tone}
          lit={evHL.isLit}
          crease="faint"
        />
        <Line d={TRANSIT_CAMPUS_ART.busWindows} tone={evHL.isSelected ? 'lit' : 'lo'} free />
        {TRANSIT_CAMPUS_ART.busWheels.map((wheel, i) => (
          <Solid key={`wheel-${i}`} paths={wheel} tone="lo" crease="faint" />
        ))}

        {/* Overhead Fast-Charging Pantograph Arm & Pedestals */}
        <Line d={TRANSIT_CAMPUS_ART.chargingArm} tone={evHL.isSelected ? 'lit' : 'mid'} free />
        {TRANSIT_CAMPUS_ART.chargers.map((chg, i) => (
          <Solid key={`charger-${i}`} paths={chg} tone="mid" crease="faint" />
        ))}
      </g>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 7: ELEVATED SKY-TRAIN RAIL VIADUCT ACROSS BASES */}
      {/* ------------------------------------------------------------- */}
      {showTransitFlow && (
        <g
          key="transit-viaduct"
          className={`smartcity-interactive-group city-color-transit ${transitHL.customClass}`}
          data-component="city-transit-rail"
          onClick={(e) => handleClick('city-transit-rail', e)}
          style={{ cursor: 'pointer' }}
        >
          {/* Concrete Bridge Piers Rising from Below */}
          {INTERCONNECT_ART.viaductPiers.map((pier, i) => (
            <Solid key={`viaduct-pier-${i}`} paths={pier} tone="lo" crease="faint" />
          ))}
          {/* Continuous Guideway Track Girder */}
          <Solid paths={INTERCONNECT_ART.viaductBeam} tone="mid" crease="faint" />
          <Line
            d={INTERCONNECT_ART.viaductRails}
            tone={transitHL.isSelected ? 'lit' : 'faint'}
            free
          />

          {/* 2-Car Driverless Sky-Train Trainset */}
          <Solid
            paths={INTERCONNECT_ART.trainLead}
            tone={transitHL.tone}
            lit={transitHL.isLit}
            crease="faint"
          />
          <Solid
            paths={INTERCONNECT_ART.trainTrail}
            tone={transitHL.tone}
            lit={transitHL.isLit}
            crease="faint"
          />
          <Line d={INTERCONNECT_ART.trainWindows} tone={transitHL.isSelected ? 'lit' : 'lo'} free />
        </g>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LAYER 8: STRUCTURAL SKY-BRIDGES & CABLE CONDUITS BETWEEN BASES */}
      {/* ------------------------------------------------------------- */}
      {showBridges && (
        <g
          key="inter-island-bridges"
          className={`smartcity-interactive-group ${trenchHL.customClass}`}
          data-component="city-utility-trench"
          onClick={(e) => handleClick('city-utility-trench', e)}
          style={{ cursor: 'pointer' }}
        >
          {/* Structural Bridges Spanning Between Distinct Islands */}
          <Line
            d={INTERCONNECT_ART.bridgePowerTransit}
            tone={trenchHL.isSelected ? 'lit' : 'mid'}
            free
          />
          <Line
            d={INTERCONNECT_ART.bridgePowerEdge}
            tone={trenchHL.isSelected ? 'lit' : 'mid'}
            free
          />
          <Line
            d={INTERCONNECT_ART.bridgeEdgeIoc}
            tone={trenchHL.isSelected ? 'lit' : 'mid'}
            free
          />
          <Line
            d={INTERCONNECT_ART.bridgeIocWater}
            tone={trenchHL.isSelected ? 'lit' : 'mid'}
            free
          />
          <Line
            d={INTERCONNECT_ART.bridgeWaterHosp}
            tone={trenchHL.isSelected ? 'lit' : 'mid'}
            free
          />

          {/* Subterranean Pull-Box & Turn Pedestals at Corridor Intersections */}
          {INTERCONNECT_ART.junctionBoxes.map((jbox, idx) => (
            <Solid key={`jbox-${idx}`} paths={jbox} tone="mid" crease="faint" />
          ))}
        </g>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LAYER 9: CYBER-PHYSICAL DATA & ENERGY PULSE OVERLAYS */}
      {/* ------------------------------------------------------------- */}
      {/* Cyan High-Speed Fiber Optic Backbone */}
      {showFiberMesh && (
        <g key="fiber-mesh-pulse" className="smartcity-flow-fiber">
          <Line d={PULSE_NETWORKS.fiber} tone="lit" free />
        </g>
      )}

      {/* Amber High-Voltage Microgrid Distribution Line */}
      {showMicrogrid && (
        <g key="microgrid-pulse" className="smartcity-flow-power">
          <Line d={PULSE_NETWORKS.powerGrid} tone="lit" dashed free />
        </g>
      )}

      {/* Purple 5G Wireless Broadcast Radio Arcs */}
      {showWirelessWaves && (
        <g key="wireless-mesh-pulse" className="smartcity-flow-wireless">
          <Line
            d={PULSE_NETWORKS.wirelessWaves}
            tone={edgeHL.isSelected ? 'lit' : 'mid'}
            dashed
            free
          />
        </g>
      )}
    </g>
  )
}
