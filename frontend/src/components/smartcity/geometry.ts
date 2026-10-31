import {
  circleRing,
  cylinder,
  dotGrid,
  knurl,
  pathOf,
  planOutline,
  insetPlan,
  ringSeam,
  segment,
  sideArc,
  sideTicks,
  slabOf,
  type Point3,
} from '../iso/iso-kit'
import {
  at,
  BESS_POD_1,
  BESS_POD_2,
  EDGE_BASE_H,
  EDGE_BASE_PLAN,
  EDGE_BASE_TOP,
  EDGE_BASE_Z0,
  EDGE_DC_H,
  EDGE_DC_PLAN,
  EV_BUS_PLAN,
  HOSP_BASE_H,
  HOSP_BASE_PLAN,
  HOSP_BASE_TOP,
  HOSP_BASE_Z0,
  HOSP_EMG_PLAN,
  HOSP_HELIPAD_CENTER,
  HOSP_MAIN_H,
  HOSP_MAIN_PLAN,
  HOSP_ROOF_Z,
  IOC_BASE_H,
  IOC_BASE_PLAN,
  IOC_BASE_TOP,
  IOC_BASE_Z0,
  IOC_HELIPAD_CENTER,
  IOC_PODIUM_PLAN,
  IOC_ROOF_Z,
  IOC_TOWER_STAGE1,
  IOC_TOWER_STAGE2,
  MAST_BASE,
  MAST_TOP_Z,
  P,
  POWER_BASE_H,
  POWER_BASE_PLAN,
  POWER_BASE_TOP,
  POWER_BASE_Z0,
  SOLAR_CANOPY_PLAN,
  TRANSIT_BASE_H,
  TRANSIT_BASE_PLAN,
  TRANSIT_BASE_TOP,
  TRANSIT_BASE_Z0,
  TRANSIT_TERMINAL_PLAN,
  TR_TANK_H,
  TR_TANK_PLAN,
  VIADUCT_Z,
  WATER_BASE_H,
  WATER_BASE_PLAN,
  WATER_BASE_TOP,
  WATER_BASE_Z0,
  WATER_TANK_CENTER,
  WATER_TANK_RADIUS,
} from './view'

// Helper for multi-point routed line with orthogonal turns
function routed(pts: Point3[]): string {
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    d += segment(pts[i], pts[i + 1], P)
  }
  return d
}

// -------------------------------------------------------------
// 1. BASE FOUNDATION SLABS (6 DISTINCT MODULAR ISLAND PLATFORMS)
// -------------------------------------------------------------
export const ISLAND_BASES = {
  // Base 1: Power & Electricity Substation
  power: slabOf(POWER_BASE_PLAN, POWER_BASE_Z0, POWER_BASE_H, P, 6, 1.4),
  powerCurbs: planOutline(insetPlan(POWER_BASE_PLAN, 3), POWER_BASE_TOP + 0.2, P),
  powerGravel: dotGrid(
    POWER_BASE_PLAN.x + 12,
    POWER_BASE_PLAN.y + 12,
    5,
    4,
    30,
    POWER_BASE_TOP + 0.2,
    P,
  ),

  // Base 2: 5G Telecom & Edge Compute Compound
  edge: slabOf(EDGE_BASE_PLAN, EDGE_BASE_Z0, EDGE_BASE_H, P, 6, 1.4),
  edgeCurbs: planOutline(insetPlan(EDGE_BASE_PLAN, 3), EDGE_BASE_TOP + 0.2, P),

  // Base 3: Smart City IOC Command Plaza
  iocLower: slabOf(IOC_BASE_PLAN, IOC_BASE_Z0, IOC_BASE_H, P, 6, 1.6),
  iocTerrace: slabOf(insetPlan(IOC_BASE_PLAN, 6), IOC_BASE_TOP, 6, P, 4, 0.8),
  iocPlazaSteps: [
    segment(
      [IOC_BASE_PLAN.x + 8, IOC_BASE_PLAN.y + IOC_BASE_PLAN.d - 12, IOC_BASE_TOP],
      [IOC_BASE_PLAN.x + 60, IOC_BASE_PLAN.y + IOC_BASE_PLAN.d - 12, IOC_BASE_TOP],
      P,
    ),
    segment(
      [IOC_BASE_PLAN.x + 8, IOC_BASE_PLAN.y + IOC_BASE_PLAN.d - 16, IOC_BASE_TOP],
      [IOC_BASE_PLAN.x + 60, IOC_BASE_PLAN.y + IOC_BASE_PLAN.d - 16, IOC_BASE_TOP],
      P,
    ),
    segment(
      [IOC_BASE_PLAN.x + 8, IOC_BASE_PLAN.y + IOC_BASE_PLAN.d - 20, IOC_BASE_TOP],
      [IOC_BASE_PLAN.x + 60, IOC_BASE_PLAN.y + IOC_BASE_PLAN.d - 20, IOC_BASE_TOP],
      P,
    ),
  ].join(''),

  // Base 4: Water Works & Reservoir Island
  water: slabOf(WATER_BASE_PLAN, WATER_BASE_Z0, WATER_BASE_H, P, 6, 1.4),
  waterCurbs: planOutline(insetPlan(WATER_BASE_PLAN, 3), WATER_BASE_TOP + 0.2, P),

  // Base 5: Regional Trauma Hospital Campus
  hosp: slabOf(HOSP_BASE_PLAN, HOSP_BASE_Z0, HOSP_BASE_H, P, 6, 1.6),
  hospCurbs: planOutline(insetPlan(HOSP_BASE_PLAN, 3), HOSP_BASE_TOP + 0.2, P),
  hospRamp: slabOf(
    { x: HOSP_BASE_PLAN.x + 12, y: HOSP_BASE_PLAN.y + HOSP_BASE_PLAN.d - 35, w: 45, d: 25, r: 2 },
    HOSP_BASE_TOP,
    2,
    P,
  ),

  // Base 6: Smart Transit & EV Hub Island
  transit: slabOf(TRANSIT_BASE_PLAN, TRANSIT_BASE_Z0, TRANSIT_BASE_H, P, 6, 1.4),
  transitCurbs: planOutline(insetPlan(TRANSIT_BASE_PLAN, 3), TRANSIT_BASE_TOP + 0.2, P),
  transitStripes: [
    segment(
      [TRANSIT_BASE_PLAN.x + 20, TRANSIT_BASE_PLAN.y + 110, TRANSIT_BASE_TOP + 0.3],
      [TRANSIT_BASE_PLAN.x + 80, TRANSIT_BASE_PLAN.y + 110, TRANSIT_BASE_TOP + 0.3],
      P,
    ),
    segment(
      [TRANSIT_BASE_PLAN.x + 20, TRANSIT_BASE_PLAN.y + 120, TRANSIT_BASE_TOP + 0.3],
      [TRANSIT_BASE_PLAN.x + 80, TRANSIT_BASE_PLAN.y + 120, TRANSIT_BASE_TOP + 0.3],
      P,
    ),
  ].join(''),
}

// -------------------------------------------------------------
// 2. BASE 1: POWER & GRID SUBSTATION CAMPUS
// -------------------------------------------------------------
export const POWER_CAMPUS_ART = {
  // Main Transformer Plinth & Tank
  trPlinth: slabOf({ x: -452, y: -69, w: 68, d: 52, r: 2 }, POWER_BASE_TOP, 3, P),
  trTank: slabOf(TR_TANK_PLAN, POWER_BASE_TOP + 3, TR_TANK_H, P, 4, 1.0),

  // Radiator Cooling Fins on left & right
  radiators: [
    slabOf({ x: -470, y: -60, w: 18, d: 35, r: 1 }, POWER_BASE_TOP + 8, 28, P),
    slabOf({ x: -445, y: -79, w: 40, d: 10, r: 1 }, POWER_BASE_TOP + 8, 28, P),
  ],
  radiatorFins: [
    sideTicks(-470, -60, 3, 1, -25, 28, [1.5, 1.5], P, 'y').minor,
    sideTicks(-470, -60, 3, 1, -25, 28, [1.5, 1.5], P, 'y').major,
  ].join(''),

  // Conservator Tank on Tank Roof
  conservator: cylinder(-417, -42, 5.5, POWER_BASE_TOP + TR_TANK_H + 5, 22, P, 16),
  conservatorPipe: segment(
    [-417, -42, POWER_BASE_TOP + TR_TANK_H + 5],
    [-422, -50, POWER_BASE_TOP + TR_TANK_H],
    P,
  ),

  // 3 High-Voltage Bushings on Transformer Lid
  bushings: [
    cylinder(-435, -57, 2.2, POWER_BASE_TOP + TR_TANK_H, 14, P, 10),
    cylinder(-425, -57, 2.2, POWER_BASE_TOP + TR_TANK_H, 14, P, 10),
    cylinder(-415, -57, 2.2, POWER_BASE_TOP + TR_TANK_H, 14, P, 10),
  ],
  bushingKnurls: [
    knurl(-435, -57, 2.5, POWER_BASE_TOP + TR_TANK_H + 4, POWER_BASE_TOP + TR_TANK_H + 11, 4, P),
    knurl(-425, -57, 2.5, POWER_BASE_TOP + TR_TANK_H + 4, POWER_BASE_TOP + TR_TANK_H + 11, 4, P),
    knurl(-415, -57, 2.5, POWER_BASE_TOP + TR_TANK_H + 4, POWER_BASE_TOP + TR_TANK_H + 11, 4, P),
  ].join(''),

  // Disconnect Isolator & Circuit Breaker Plinth
  cbPlinth: slabOf({ x: -390, y: -60, w: 22, d: 24, r: 1 }, POWER_BASE_TOP, 4, P),
  cbPoles: [
    cylinder(-384, -53, 2.5, POWER_BASE_TOP + 4, 18, P, 10),
    cylinder(-374, -53, 2.5, POWER_BASE_TOP + 4, 18, P, 10),
  ],

  // 2 Containerized BESS Pods
  bessPod1: slabOf(BESS_POD_1, POWER_BASE_TOP, 26, P, 2, 0.8),
  bessPod2: slabOf(BESS_POD_2, POWER_BASE_TOP, 26, P, 2, 0.8),
  bessDetails: [
    // Pod 1 seams & vents
    segment(
      [BESS_POD_1.x + 14, BESS_POD_1.y + BESS_POD_1.d, POWER_BASE_TOP],
      [BESS_POD_1.x + 14, BESS_POD_1.y + BESS_POD_1.d, POWER_BASE_TOP + 26],
      P,
    ),
    sideTicks(
      BESS_POD_1.x + 4,
      BESS_POD_1.y + 6,
      3,
      1,
      BESS_POD_1.y + BESS_POD_1.d,
      22,
      [1.5, 1.5],
      P,
      'x',
    ).minor,
    sideTicks(
      BESS_POD_1.x + 4,
      BESS_POD_1.y + 6,
      3,
      1,
      BESS_POD_1.y + BESS_POD_1.d,
      22,
      [1.5, 1.5],
      P,
      'x',
    ).major,
    // Pod 2 seams & vents
    segment(
      [BESS_POD_2.x + 14, BESS_POD_2.y + BESS_POD_2.d, POWER_BASE_TOP],
      [BESS_POD_2.x + 14, BESS_POD_2.y + BESS_POD_2.d, POWER_BASE_TOP + 26],
      P,
    ),
    sideTicks(
      BESS_POD_2.x + 4,
      BESS_POD_2.y + 6,
      3,
      1,
      BESS_POD_2.y + BESS_POD_2.d,
      22,
      [1.5, 1.5],
      P,
      'x',
    ).minor,
    sideTicks(
      BESS_POD_2.x + 4,
      BESS_POD_2.y + 6,
      3,
      1,
      BESS_POD_2.y + BESS_POD_2.d,
      22,
      [1.5, 1.5],
      P,
      'x',
    ).major,
  ].join(''),

  // Solar Photovoltaic Canopy on Posts
  solarPosts: [
    segment(
      [SOLAR_CANOPY_PLAN.x + 5, SOLAR_CANOPY_PLAN.y + 5, POWER_BASE_TOP],
      [SOLAR_CANOPY_PLAN.x + 5, SOLAR_CANOPY_PLAN.y + 5, POWER_BASE_TOP + 22],
      P,
    ),
    segment(
      [SOLAR_CANOPY_PLAN.x + SOLAR_CANOPY_PLAN.w - 5, SOLAR_CANOPY_PLAN.y + 5, POWER_BASE_TOP],
      [SOLAR_CANOPY_PLAN.x + SOLAR_CANOPY_PLAN.w - 5, SOLAR_CANOPY_PLAN.y + 5, POWER_BASE_TOP + 22],
      P,
    ),
    segment(
      [SOLAR_CANOPY_PLAN.x + 5, SOLAR_CANOPY_PLAN.y + SOLAR_CANOPY_PLAN.d - 5, POWER_BASE_TOP],
      [SOLAR_CANOPY_PLAN.x + 5, SOLAR_CANOPY_PLAN.y + SOLAR_CANOPY_PLAN.d - 5, POWER_BASE_TOP + 28],
      P,
    ),
    segment(
      [
        SOLAR_CANOPY_PLAN.x + SOLAR_CANOPY_PLAN.w - 5,
        SOLAR_CANOPY_PLAN.y + SOLAR_CANOPY_PLAN.d - 5,
        POWER_BASE_TOP,
      ],
      [
        SOLAR_CANOPY_PLAN.x + SOLAR_CANOPY_PLAN.w - 5,
        SOLAR_CANOPY_PLAN.y + SOLAR_CANOPY_PLAN.d - 5,
        POWER_BASE_TOP + 28,
      ],
      P,
    ),
  ].join(''),
  solarPlane: slabOf(SOLAR_CANOPY_PLAN, POWER_BASE_TOP + 24, 3, P, 1),
  solarGrid: [
    segment(
      [SOLAR_CANOPY_PLAN.x + 22, SOLAR_CANOPY_PLAN.y, POWER_BASE_TOP + 27],
      [SOLAR_CANOPY_PLAN.x + 22, SOLAR_CANOPY_PLAN.y + SOLAR_CANOPY_PLAN.d, POWER_BASE_TOP + 27],
      P,
    ),
    segment(
      [SOLAR_CANOPY_PLAN.x + 45, SOLAR_CANOPY_PLAN.y, POWER_BASE_TOP + 27],
      [SOLAR_CANOPY_PLAN.x + 45, SOLAR_CANOPY_PLAN.y + SOLAR_CANOPY_PLAN.d, POWER_BASE_TOP + 27],
      P,
    ),
    segment(
      [SOLAR_CANOPY_PLAN.x + 68, SOLAR_CANOPY_PLAN.y, POWER_BASE_TOP + 27],
      [SOLAR_CANOPY_PLAN.x + 68, SOLAR_CANOPY_PLAN.y + SOLAR_CANOPY_PLAN.d, POWER_BASE_TOP + 27],
      P,
    ),
  ].join(''),

  // Cable Trench & Grounding Earth Line
  groundingGrid: [
    segment(
      [POWER_BASE_PLAN.x + 8, POWER_BASE_PLAN.y + 8, POWER_BASE_TOP + 0.3],
      [POWER_BASE_PLAN.x + POWER_BASE_PLAN.w - 8, POWER_BASE_PLAN.y + 8, POWER_BASE_TOP + 0.3],
      P,
    ),
    segment(
      [POWER_BASE_PLAN.x + 8, POWER_BASE_PLAN.y + POWER_BASE_PLAN.d - 8, POWER_BASE_TOP + 0.3],
      [
        POWER_BASE_PLAN.x + POWER_BASE_PLAN.w - 8,
        POWER_BASE_PLAN.y + POWER_BASE_PLAN.d - 8,
        POWER_BASE_TOP + 0.3,
      ],
      P,
    ),
    segment([-430, -20, POWER_BASE_TOP + 0.3], [-430, 30, POWER_BASE_TOP + 0.3], P),
  ].join(''),
}

// -------------------------------------------------------------
// 3. BASE 2: 5G TELECOM & EDGE COMPUTE COMPOUND
// -------------------------------------------------------------
export const EDGE_CAMPUS_ART = {
  // Edge Datacenter Bunker
  bunker: slabOf(EDGE_DC_PLAN, EDGE_BASE_TOP, EDGE_DC_H, P, 4, 1.2),
  bunkerLines: [
    planOutline(EDGE_DC_PLAN, EDGE_BASE_TOP + 20, P),
    // Louver grilles on datacenter side
    sideTicks(-325, -265, 3, 1, -230, EDGE_BASE_TOP + 25, [1.5, 1.5], P, 'y').minor,
    sideTicks(-325, -265, 3, 1, -230, EDGE_BASE_TOP + 25, [1.5, 1.5], P, 'y').major,
    // Vault security entrance
    segment(
      [EDGE_DC_PLAN.x + 25, EDGE_DC_PLAN.y + EDGE_DC_PLAN.d, EDGE_BASE_TOP],
      [EDGE_DC_PLAN.x + 25, EDGE_DC_PLAN.y + EDGE_DC_PLAN.d, EDGE_BASE_TOP + 18],
      P,
    ),
  ].join(''),

  // Rooftop Dual HVAC Chillers
  chiller1: slabOf({ x: -318, y: -285, w: 26, d: 22, r: 1 }, EDGE_BASE_TOP + EDGE_DC_H, 12, P),
  chiller2: slabOf({ x: -284, y: -285, w: 26, d: 22, r: 1 }, EDGE_BASE_TOP + EDGE_DC_H, 12, P),
  chillerFans: [
    knurl(-305, -274, 6, EDGE_BASE_TOP + EDGE_DC_H + 9, EDGE_BASE_TOP + EDGE_DC_H + 12, 6, P),
    knurl(-271, -274, 6, EDGE_BASE_TOP + EDGE_DC_H + 9, EDGE_BASE_TOP + EDGE_DC_H + 12, 6, P),
  ].join(''),

  // Tall 5G Communications Lattice Mast (4 legs, 5 bracing bays)
  mastPillars: [
    segment(
      [MAST_BASE[0] - 12, MAST_BASE[1] - 12, EDGE_BASE_TOP],
      [MAST_BASE[0] - 4, MAST_BASE[1] - 4, MAST_TOP_Z],
      P,
    ),
    segment(
      [MAST_BASE[0] + 12, MAST_BASE[1] - 12, EDGE_BASE_TOP],
      [MAST_BASE[0] + 4, MAST_BASE[1] - 4, MAST_TOP_Z],
      P,
    ),
    segment(
      [MAST_BASE[0] + 12, MAST_BASE[1] + 12, EDGE_BASE_TOP],
      [MAST_BASE[0] + 4, MAST_BASE[1] + 4, MAST_TOP_Z],
      P,
    ),
    segment(
      [MAST_BASE[0] - 12, MAST_BASE[1] + 12, EDGE_BASE_TOP],
      [MAST_BASE[0] - 4, MAST_BASE[1] + 4, MAST_TOP_Z],
      P,
    ),
  ].join(''),

  mastBays: [
    // Bay 1 (z: 40)
    segment(
      [MAST_BASE[0] - 10, MAST_BASE[1] - 10, 40],
      [MAST_BASE[0] + 10, MAST_BASE[1] - 10, 40],
      P,
    ),
    segment(
      [MAST_BASE[0] + 10, MAST_BASE[1] - 10, 40],
      [MAST_BASE[0] + 10, MAST_BASE[1] + 10, 40],
      P,
    ),
    segment(
      [MAST_BASE[0] + 10, MAST_BASE[1] + 10, 40],
      [MAST_BASE[0] - 10, MAST_BASE[1] + 10, 40],
      P,
    ),
    segment(
      [MAST_BASE[0] - 10, MAST_BASE[1] + 10, 40],
      [MAST_BASE[0] - 10, MAST_BASE[1] - 10, 40],
      P,
    ),
    segment(
      [MAST_BASE[0] - 12, MAST_BASE[1] - 12, EDGE_BASE_TOP],
      [MAST_BASE[0] + 10, MAST_BASE[1] + 10, 40],
      P,
    ),

    // Bay 2 (z: 75)
    segment([MAST_BASE[0] - 8, MAST_BASE[1] - 8, 75], [MAST_BASE[0] + 8, MAST_BASE[1] - 8, 75], P),
    segment([MAST_BASE[0] + 8, MAST_BASE[1] - 8, 75], [MAST_BASE[0] + 8, MAST_BASE[1] + 8, 75], P),
    segment([MAST_BASE[0] + 8, MAST_BASE[1] + 8, 75], [MAST_BASE[0] - 8, MAST_BASE[1] + 8, 75], P),
    segment([MAST_BASE[0] - 8, MAST_BASE[1] + 8, 75], [MAST_BASE[0] - 8, MAST_BASE[1] - 8, 75], P),
    segment(
      [MAST_BASE[0] - 10, MAST_BASE[1] - 10, 40],
      [MAST_BASE[0] + 8, MAST_BASE[1] + 8, 75],
      P,
    ),

    // Bay 3 (z: 110)
    segment(
      [MAST_BASE[0] - 6, MAST_BASE[1] - 6, 110],
      [MAST_BASE[0] + 6, MAST_BASE[1] - 6, 110],
      P,
    ),
    segment(
      [MAST_BASE[0] + 6, MAST_BASE[1] - 6, 110],
      [MAST_BASE[0] + 6, MAST_BASE[1] + 6, 110],
      P,
    ),
    segment(
      [MAST_BASE[0] + 6, MAST_BASE[1] + 6, 110],
      [MAST_BASE[0] - 6, MAST_BASE[1] + 6, 110],
      P,
    ),
    segment(
      [MAST_BASE[0] - 6, MAST_BASE[1] + 6, 110],
      [MAST_BASE[0] - 6, MAST_BASE[1] - 6, 110],
      P,
    ),

    // Bay 4 (z: 145)
    segment(
      [MAST_BASE[0] - 5, MAST_BASE[1] - 5, 145],
      [MAST_BASE[0] + 5, MAST_BASE[1] - 5, 145],
      P,
    ),
    segment(
      [MAST_BASE[0] + 5, MAST_BASE[1] - 5, 145],
      [MAST_BASE[0] + 5, MAST_BASE[1] + 5, 145],
      P,
    ),
    segment(
      [MAST_BASE[0] + 5, MAST_BASE[1] + 5, 145],
      [MAST_BASE[0] - 5, MAST_BASE[1] + 5, 145],
      P,
    ),
    segment(
      [MAST_BASE[0] - 5, MAST_BASE[1] + 5, 145],
      [MAST_BASE[0] - 5, MAST_BASE[1] - 5, 145],
      P,
    ),
  ].join(''),

  // 3-Sector 5G MIMO Panels
  mimo1: slabOf({ x: MAST_BASE[0] + 4, y: MAST_BASE[1] - 3, w: 2.5, d: 8, r: 0.5 }, 145, 14, P),
  mimo2: slabOf({ x: MAST_BASE[0] - 3, y: MAST_BASE[1] + 4, w: 8, d: 2.5, r: 0.5 }, 145, 14, P),
  mimo3: slabOf({ x: MAST_BASE[0] - 7, y: MAST_BASE[1] - 6, w: 2.5, d: 8, r: 0.5 }, 145, 14, P),

  // Directional Microwave Drum Backhaul Dishes
  microwaveDish1: cylinder(MAST_BASE[0] + 6, MAST_BASE[1] + 5, 5.5, 130, 5, P, 16, 1),
  microwaveDish2: cylinder(MAST_BASE[0] - 6, MAST_BASE[1] + 5, 4.5, 120, 4, P, 16, 1),
}

// -------------------------------------------------------------
// 4. BASE 3: SMART CITY IOC CIVIC COMMAND SKYSCRAPER
// -------------------------------------------------------------
export const IOC_CAMPUS_ART = {
  // Stepped Skyscraper Stage 1 (Podium)
  stage1: slabOf(IOC_PODIUM_PLAN, IOC_BASE_TOP + 6, 28, P, 4, 1.2),
  stage1Lines: [
    planOutline(IOC_PODIUM_PLAN, IOC_BASE_TOP + 20, P),
    segment(
      [IOC_PODIUM_PLAN.x + 30, IOC_PODIUM_PLAN.y + IOC_PODIUM_PLAN.d, IOC_BASE_TOP + 6],
      [IOC_PODIUM_PLAN.x + 30, IOC_PODIUM_PLAN.y + IOC_PODIUM_PLAN.d, IOC_BASE_TOP + 24],
      P,
    ),
  ].join(''),

  // Stage 2 (Middle Tower)
  stage2: slabOf(IOC_TOWER_STAGE1, IOC_BASE_TOP + 34, 48, P, 4, 1.0),
  stage2Bands: [
    planOutline(IOC_TOWER_STAGE1, IOC_BASE_TOP + 50, P),
    planOutline(IOC_TOWER_STAGE1, IOC_BASE_TOP + 66, P),
  ].join(''),

  // Stage 3 (Executive Penthouse & Command Deck)
  stage3: slabOf(IOC_TOWER_STAGE2, IOC_BASE_TOP + 82, 42, P, 3, 0.8),
  stage3Bands: [
    planOutline(IOC_TOWER_STAGE2, IOC_BASE_TOP + 98, P),
    planOutline(IOC_TOWER_STAGE2, IOC_BASE_TOP + 114, P),
  ].join(''),

  // Vertical Architectural Mullions
  mullions: [
    segment([150, -285, IOC_BASE_TOP + 34], [150, -285, IOC_ROOF_Z], P),
    segment([175, -285, IOC_BASE_TOP + 34], [175, -285, IOC_ROOF_Z], P),
    segment([200, -285, IOC_BASE_TOP + 34], [200, -285, IOC_ROOF_Z], P),
    segment([220, -265, IOC_BASE_TOP + 34], [220, -265, IOC_ROOF_Z], P),
    segment([220, -240, IOC_BASE_TOP + 34], [220, -240, IOC_ROOF_Z], P),
  ].join(''),

  // Rooftop Drone / Helipad Deck
  helipadRing: pathOf(
    circleRing(IOC_HELIPAD_CENTER[0], IOC_HELIPAD_CENTER[1], 15).map((pt) =>
      at([pt[0], pt[1], IOC_ROOF_Z + 0.5]),
    ),
    true,
  ),
  helipadH: [
    segment(
      [IOC_HELIPAD_CENTER[0] - 5, IOC_HELIPAD_CENTER[1] - 5, IOC_ROOF_Z + 0.6],
      [IOC_HELIPAD_CENTER[0] - 5, IOC_HELIPAD_CENTER[1] + 5, IOC_ROOF_Z + 0.6],
      P,
    ),
    segment(
      [IOC_HELIPAD_CENTER[0] + 5, IOC_HELIPAD_CENTER[1] - 5, IOC_ROOF_Z + 0.6],
      [IOC_HELIPAD_CENTER[0] + 5, IOC_HELIPAD_CENTER[1] + 5, IOC_ROOF_Z + 0.6],
      P,
    ),
    segment(
      [IOC_HELIPAD_CENTER[0] - 5, IOC_HELIPAD_CENTER[1], IOC_ROOF_Z + 0.6],
      [IOC_HELIPAD_CENTER[0] + 5, IOC_HELIPAD_CENTER[1], IOC_ROOF_Z + 0.6],
      P,
    ),
  ].join(''),

  // Parabolic Satellite Ground Station Dishes
  dish1Pedestal: cylinder(153, -258, 3, IOC_ROOF_Z, 8, P),
  dish1Bowl: cylinder(153, -258, 7, IOC_ROOF_Z + 8, 4, P, 16, 1),
  dish2Pedestal: cylinder(201, -258, 2.5, IOC_ROOF_Z, 6, P),
  dish2Bowl: cylinder(201, -258, 5.5, IOC_ROOF_Z + 6, 3.5, P, 16, 1),

  // Rooftop Telemetry Communications Spire
  telemetrySpire: [
    segment([177, -220, IOC_ROOF_Z], [177, -220, 172], P),
    segment([171, -220, 162], [183, -220, 162], P),
    segment([173, -220, 154], [181, -220, 154], P),
  ].join(''),
}

// -------------------------------------------------------------
// 5. BASE 4: MUNICIPAL WATER PURIFICATION & RESERVOIR WORKS
// -------------------------------------------------------------
export const WATER_CAMPUS_ART = {
  // Elevated Potable Water Reservoir Tank
  tankPedestal: cylinder(WATER_TANK_CENTER[0], WATER_TANK_CENTER[1], 16, WATER_BASE_TOP, 24, P, 24),
  tankDrum: cylinder(
    WATER_TANK_CENTER[0],
    WATER_TANK_CENTER[1],
    WATER_TANK_RADIUS,
    WATER_BASE_TOP + 24,
    42,
    P,
    32,
    2,
  ),
  tankDome: cylinder(
    WATER_TANK_CENTER[0],
    WATER_TANK_CENTER[1],
    WATER_TANK_RADIUS - 3,
    WATER_BASE_TOP + 66,
    5,
    P,
    32,
    1,
  ),
  tankSeam: ringSeam(
    circleRing(WATER_TANK_CENTER[0], WATER_TANK_CENTER[1], WATER_TANK_RADIUS),
    WATER_BASE_TOP + 45,
    P,
  ),
  tankLadder: [
    segment(
      [WATER_TANK_CENTER[0] + WATER_TANK_RADIUS, WATER_TANK_CENTER[1], WATER_BASE_TOP],
      [WATER_TANK_CENTER[0] + WATER_TANK_RADIUS, WATER_TANK_CENTER[1], WATER_BASE_TOP + 66],
      P,
    ),
    segment(
      [WATER_TANK_CENTER[0] + WATER_TANK_RADIUS + 2, WATER_TANK_CENTER[1], WATER_BASE_TOP],
      [WATER_TANK_CENTER[0] + WATER_TANK_RADIUS + 2, WATER_TANK_CENTER[1], WATER_BASE_TOP + 66],
      P,
    ),
  ].join(''),

  // 3 Vertical Sand & Carbon Clarifier Cylinders
  filter1: cylinder(330, -60, 8.5, WATER_BASE_TOP, 24, P, 16),
  filter2: cylinder(355, -60, 8.5, WATER_BASE_TOP, 24, P, 16),
  filter3: cylinder(380, -60, 8.5, WATER_BASE_TOP, 24, P, 16),

  // Interconnecting High-Pressure Manifold Piping
  pipingManifold: [
    segment([330, -60, WATER_BASE_TOP + 26], [380, -60, WATER_BASE_TOP + 26], P),
    segment([355, -60, WATER_BASE_TOP + 26], [355, -25, WATER_BASE_TOP + 26], P),
    segment(
      [355, -25, WATER_BASE_TOP + 26],
      [WATER_TANK_CENTER[0], WATER_TANK_CENTER[1], WATER_BASE_TOP + 26],
      P,
    ),
  ].join(''),

  // Automated Chemical Injection & Pump Shed
  pumpShed: slabOf({ x: 325, y: 0, w: 42, d: 32, r: 2 }, WATER_BASE_TOP, 16, P, 2),
}

// -------------------------------------------------------------
// 6. BASE 5: REGIONAL TRAUMA HOSPITAL MEDICAL CAMPUS
// -------------------------------------------------------------
export const HOSP_CAMPUS_ART = {
  // Main Hospital Ward Wing
  mainWard: slabOf(HOSP_MAIN_PLAN, HOSP_BASE_TOP, HOSP_MAIN_H, P, 6, 1.4),
  floorBands: [
    planOutline(HOSP_MAIN_PLAN, HOSP_BASE_TOP + 18, P),
    planOutline(HOSP_MAIN_PLAN, HOSP_BASE_TOP + 36, P),
    planOutline(HOSP_MAIN_PLAN, HOSP_BASE_TOP + 54, P),
  ].join(''),

  // Emergency Trauma Intake Wing & Covered Bay
  emergencyWing: slabOf(HOSP_EMG_PLAN, HOSP_BASE_TOP, 28, P, 4, 1.0),
  ambulanceCanopy: slabOf({ x: 220, y: 215, w: 32, d: 30, r: 2 }, HOSP_BASE_TOP + 14, 3, P),
  canopyPillars: [
    segment([223, 242, HOSP_BASE_TOP], [223, 242, HOSP_BASE_TOP + 14], P),
    segment([249, 242, HOSP_BASE_TOP], [249, 242, HOSP_BASE_TOP + 14], P),
  ].join(''),

  // 3D Emergency Ambulance Vehicle
  ambulanceBody: slabOf({ x: 225, y: 220, w: 18, d: 24, r: 2 }, HOSP_BASE_TOP, 12, P, 2),
  ambulanceBeacon: cylinder(234, 228, 1.5, HOSP_BASE_TOP + 12, 2.5, P, 8),

  // Rooftop Trauma Helipad & Medical Cross Symbol
  helipadRing: pathOf(
    circleRing(HOSP_HELIPAD_CENTER[0], HOSP_HELIPAD_CENTER[1], 16).map((pt) =>
      at([pt[0], pt[1], HOSP_ROOF_Z + 0.5]),
    ),
    true,
  ),
  crossSymbol: [
    // Vertical arm
    segment(
      [HOSP_HELIPAD_CENTER[0], HOSP_HELIPAD_CENTER[1] - 8, HOSP_ROOF_Z + 0.6],
      [HOSP_HELIPAD_CENTER[0], HOSP_HELIPAD_CENTER[1] + 8, HOSP_ROOF_Z + 0.6],
      P,
    ),
    // Horizontal arm
    segment(
      [HOSP_HELIPAD_CENTER[0] - 8, HOSP_HELIPAD_CENTER[1], HOSP_ROOF_Z + 0.6],
      [HOSP_HELIPAD_CENTER[0] + 8, HOSP_HELIPAD_CENTER[1], HOSP_ROOF_Z + 0.6],
      P,
    ),
  ].join(''),

  // Cryogenic Medical Oxygen Storage Tank (Sphere on Legs)
  oxygenTank: cylinder(130, 225, 8, HOSP_BASE_TOP + 4, 16, P, 16, 2),
  oxygenPipes: segment([130, 225, HOSP_BASE_TOP + 12], [150, 210, HOSP_BASE_TOP + 12], P),

  // Emergency Backup Diesel Generator Pod
  generatorPod: slabOf({ x: 150, y: 225, w: 28, d: 22, r: 1 }, HOSP_BASE_TOP, 14, P),
}

// -------------------------------------------------------------
// 7. BASE 6: SMART TRANSIT & EV FLEET MOBILITY HUB
// -------------------------------------------------------------
export const TRANSIT_CAMPUS_ART = {
  // Passenger Terminal Concourse
  terminal: slabOf(TRANSIT_TERMINAL_PLAN, TRANSIT_BASE_TOP, 24, P, 4, 1.0),
  terminalRoofLines: planOutline(TRANSIT_TERMINAL_PLAN, TRANSIT_BASE_TOP + 16, P),

  // Autonomous EV Bus
  busBody: slabOf(EV_BUS_PLAN, TRANSIT_BASE_TOP, 16, P, 3, 1.2),
  busWindows: planOutline(insetPlan(EV_BUS_PLAN, 1.5), TRANSIT_BASE_TOP + 10, P),
  busWheels: [
    cylinder(EV_BUS_PLAN.x + 2, EV_BUS_PLAN.y + 10, 2.5, TRANSIT_BASE_TOP, 4, P, 8),
    cylinder(EV_BUS_PLAN.x + 2, EV_BUS_PLAN.y + 35, 2.5, TRANSIT_BASE_TOP, 4, P, 8),
  ],

  // Overhead Fast-Charging Inverted Pantograph Arm
  chargingArm: [
    segment(
      [TRANSIT_BASE_PLAN.x + 40, TRANSIT_BASE_PLAN.y + 80, TRANSIT_BASE_TOP],
      [TRANSIT_BASE_PLAN.x + 40, TRANSIT_BASE_PLAN.y + 80, TRANSIT_BASE_TOP + 28],
      P,
    ),
    segment(
      [TRANSIT_BASE_PLAN.x + 40, TRANSIT_BASE_PLAN.y + 80, TRANSIT_BASE_TOP + 28],
      [TRANSIT_BASE_PLAN.x + 55, TRANSIT_BASE_PLAN.y + 80, TRANSIT_BASE_TOP + 24],
      P,
    ),
  ].join(''),

  // EV Fast-Charging Pedestals
  chargers: [
    slabOf({ x: -325, y: 185, w: 5, d: 5, r: 1 }, TRANSIT_BASE_TOP, 12, P),
    slabOf({ x: -325, y: 205, w: 5, d: 5, r: 1 }, TRANSIT_BASE_TOP, 12, P),
  ],
}

// -------------------------------------------------------------
// 8. INTER-ISLAND INFRASTRUCTURE: SKY-TRAIN VIADUCT & BRIDGES
// -------------------------------------------------------------
export const INTERCONNECT_ART = {
  // Elevated Sky-Train Concrete Viaduct Piers (carrying track between bases)
  viaductPiers: [
    cylinder(-310, 95, 5, -8, VIADUCT_Z + 8, P, 16),
    cylinder(-190, 70, 5, -8, VIADUCT_Z + 8, P, 16),
    cylinder(-70, 45, 5, -8, VIADUCT_Z + 8, P, 16),
    cylinder(50, 20, 5, -8, VIADUCT_Z + 8, P, 16),
    cylinder(170, 10, 5, -8, VIADUCT_Z + 8, P, 16),
    cylinder(290, 5, 5, -8, VIADUCT_Z + 8, P, 16),
  ],

  // Viaduct Continuous Guideway Girder
  viaductBeam: slabOf({ x: -340, y: 30, w: 660, d: 14, r: 2 }, VIADUCT_Z, 6, P),
  viaductRails: [
    segment([-340, 34, VIADUCT_Z + 6.3], [320, 34, VIADUCT_Z + 6.3], P),
    segment([-340, 40, VIADUCT_Z + 6.3], [320, 40, VIADUCT_Z + 6.3], P),
  ].join(''),

  // 2-Car Driverless Sky-Train Trainset
  trainLead: slabOf({ x: -80, y: 33, w: 58, d: 8, r: 2.5 }, VIADUCT_Z + 7, 14, P, 3, 0.8),
  trainTrail: slabOf({ x: -15, y: 33, w: 58, d: 8, r: 2.5 }, VIADUCT_Z + 7, 14, P, 3, 0.8),
  trainWindows: [
    planOutline({ x: -78, y: 33.5, w: 54, d: 7, r: 1 }, VIADUCT_Z + 15, P),
    planOutline({ x: -13, y: 33.5, w: 54, d: 7, r: 1 }, VIADUCT_Z + 15, P),
  ].join(''),

  // ─── Physical Sky-Bridges With Concrete Trusses & Walkways ───

  // Bridge 1: Power Base <-> Transit Base (South-West span)
  bridgePowerTransit: [
    segment([-350, 50, 8], [-350, 110, 8], P),
    segment([-350, 50, 14], [-350, 110, 14], P),
    segment([-335, 50, 8], [-335, 110, 8], P),
    segment([-335, 50, 14], [-335, 110, 14], P),
  ].join(''),

  // Bridge 2: Power Base <-> Edge Compound (North-West span)
  bridgePowerEdge: [
    segment([-340, -90, 8], [-340, -185, 8], P),
    segment([-340, -90, 14], [-340, -185, 14], P),
    segment([-325, -90, 8], [-325, -185, 8], P),
    segment([-325, -90, 14], [-325, -185, 14], P),
  ].join(''),

  // Bridge 3: Edge Compound <-> IOC Civic Plaza (North bridge)
  bridgeEdgeIoc: [
    segment([-185, -230, 10], [80, -230, 10], P),
    segment([-185, -230, 16], [80, -230, 16], P),
    segment([-185, -215, 10], [80, -215, 10], P),
    segment([-185, -215, 16], [80, -215, 16], P),
  ].join(''),

  // Bridge 4: IOC Civic Plaza <-> Water Works (East bridge)
  bridgeIocWater: [
    segment([275, -200, 10], [310, -200, 10], P),
    segment([310, -200, 10], [310, -85, 10], P),
    segment([275, -200, 16], [310, -200, 16], P),
    segment([310, -200, 16], [310, -85, 16], P),
  ].join(''),

  // Bridge 5: Water Works <-> Hospital Campus (South-East bridge)
  bridgeWaterHosp: [
    segment([350, 45, 10], [350, 100, 10], P),
    segment([350, 45, 16], [350, 100, 16], P),
    segment([335, 45, 10], [335, 100, 10], P),
    segment([335, 45, 16], [335, 100, 16], P),
  ].join(''),

  // Subterranean Global Coordinate Alignment Grid
  subGrid: [
    segment([-520, -350, -10], [520, -350, -10], P),
    segment([-520, -170, -10], [520, -170, -10], P),
    segment([-520, 10, -10], [520, 10, -10], P),
    segment([-520, 190, -10], [520, 190, -10], P),
    segment([-520, 300, -10], [520, 300, -10], P),
    segment([-440, -370, -10], [-440, 320, -10], P),
    segment([-230, -370, -10], [-230, 320, -10], P),
    segment([0, -370, -10], [0, 320, -10], P),
    segment([230, -370, -10], [230, 320, -10], P),
    segment([440, -370, -10], [440, 320, -10], P),
  ].join(''),

  // ─── Underground Cable Pull Boxes / Junction Manhole Markers at Turn Points ───
  junctionBoxes: [
    // Power -> IOC grid turns
    cylinder(-140, -45, 5, -8, 10, P, 10),
    cylinder(-140, -240, 5, -8, 10, P, 10),
    // Power -> Hospital grid turns
    cylinder(-140, 0, 5, -8, 10, P, 10),
    cylinder(-140, 180, 5, -8, 10, P, 10),
    // Power -> Transit grid turn
    cylinder(-390, 175, 5, -8, 10, P, 10),
    // Power -> Edge grid turn
    cylinder(-390, -185, 5, -8, 10, P, 10),
    // IOC -> Water Works grid turn
    cylinder(385, -240, 5, -8, 10, P, 10),
    // Water Works -> Hospital grid turn
    cylinder(385, 180, 5, -8, 10, P, 10),
    // Edge -> IOC fiber turns
    cylinder(-60, -245, 4, -8, 10, P, 10),
    cylinder(-60, -270, 4, -8, 10, P, 10),
    // IOC -> Water fiber turn
    cylinder(340, -270, 4, -8, 10, P, 10),
    // Water -> Hospital fiber turn
    cylinder(340, 130, 4, -8, 10, P, 10),
    // Edge -> Power fiber turns
    cylinder(-260, -140, 4, -8, 10, P, 10),
    cylinder(-305, -140, 4, -8, 10, P, 10),
    // Hospital -> Transit fiber turns
    cylinder(200, 290, 4, -8, 10, P, 10),
    cylinder(-250, 290, 4, -8, 10, P, 10),
  ],
}

// -------------------------------------------------------------
// 9. CYBER-PHYSICAL TELEMETRY & ENERGY PULSE OVERLAYS
// (ENGINEERED ORTHOGONAL ROUTING WITH CLEAN 90° CORRIDOR TURNS)
// -------------------------------------------------------------
export const PULSE_NETWORKS = {
  // Cyan Fiber Optic Inter-Island Backbone — routed with clean 90° turns
  fiber: [
    // Trunk 1: Edge Compound -> IOC Civic Center (East -> North -> East)
    routed([
      [-185, -245, 12],
      [-60, -245, 12],
      [-60, -270, 12],
      [80, -270, 12],
    ]),
    // Trunk 2: IOC Civic Center -> Water Works (East -> South)
    routed([
      [275, -270, 12],
      [340, -270, 12],
      [340, -85, 12],
    ]),
    // Trunk 3: Water Works -> Trauma Hospital (South -> West)
    routed([
      [340, 45, 12],
      [340, 130, 12],
      [305, 130, 12],
    ]),
    // Trunk 4: Edge Compound -> Power Substation (South -> West -> South)
    routed([
      [-260, -185, 12],
      [-260, -140, 12],
      [-305, -140, 12],
      [-305, -70, 12],
    ]),
    // Trunk 5: Hospital -> Transit Hub (Southern Optical Duct: South -> West -> North)
    routed([
      [200, 255, 12],
      [200, 290, 12],
      [-250, 290, 12],
      [-250, 245, 12],
    ]),
  ].join(''),

  // Amber High-Voltage Microgrid Intertie — routed with clean 90° turns along municipal utility corridors
  powerGrid: [
    // Feeder 1: Power Substation -> IOC Command Plaza (East -> North -> East)
    routed([
      [-305, -45, 8],
      [-140, -45, 8],
      [-140, -240, 8],
      [80, -240, 8],
    ]),

    // Feeder 2: Power Substation -> Regional Hospital Complex (East -> South -> East)
    routed([
      [-305, 0, 8],
      [-140, 0, 8],
      [-140, 180, 8],
      [100, 180, 8],
    ]),

    // Feeder 3: Power Substation -> Smart Transit EV Depot (South -> East)
    routed([
      [-390, 50, 8],
      [-390, 175, 8],
      [-340, 175, 8],
    ]),

    // Feeder 4: Power Substation -> 5G Edge Datacenter (North -> East)
    routed([
      [-390, -90, 8],
      [-390, -185, 8],
      [-340, -185, 8],
    ]),

    // Feeder 5: IOC Civic Center -> Water Purification Works (East -> South)
    routed([
      [275, -240, 8],
      [385, -240, 8],
      [385, -85, 8],
    ]),

    // Feeder 6: Water Purification Works -> Hospital Medical Campus (South -> West)
    routed([
      [385, 45, 8],
      [385, 180, 8],
      [305, 180, 8],
    ]),
  ].join(''),

  // 5G Wireless Radio Arcs
  wirelessWaves: [
    sideArc(MAST_BASE[0], MAST_BASE[1], 40, 145, P),
    sideArc(MAST_BASE[0], MAST_BASE[1], 65, 145, P),
    sideArc(MAST_BASE[0], MAST_BASE[1], 90, 145, P),
  ].join(''),
}
