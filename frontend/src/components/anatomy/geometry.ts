import {
  cylinder,
  dotGrid,
  planOutline,
  insetPlan,
  ring,
  segment,
  sideArc,
  sideTicks,
  slabOf,
  type SolidPaths,
} from "../iso/iso-kit";
import {
  CB_PLINTH,
  CP_PLINTH,
  DS_PLINTH,
  GANTRY_BUSBAR_Z,
  GANTRY_TOP,
  LA_PLINTH,
  P,
  PAD_PLAN,
  TANK_H,
  TANK_PLAN,
  TANK_TOP,
  TANK_Z,
  TR_PLINTH,
  YARD_PLAN,
} from "./view";

// -------------------------------------------------------------
// 1. BASE FOUNDATIONS & GROUNDING GRID
// -------------------------------------------------------------

export const YARD_ART = {
  yard: slabOf(YARD_PLAN, -10, 8, P, 6, 1.2),
  pad: slabOf(PAD_PLAN, -2, 6, P, 6, 0.8),
  padGroove: planOutline(insetPlan(PAD_PLAN, 4), 4, P, 6),
  screws: dotGrid(PAD_PLAN.x + 8, PAD_PLAN.y + 8, 8, 6, 48, 4, P),
};

export const PLINTH_ART = {
  tr: slabOf(TR_PLINTH, 4, 5, P, 4, 0.6),
  cb: slabOf(CB_PLINTH, 4, 5, P, 4, 0.6),
  ds: slabOf(DS_PLINTH, 4, 5, P, 4, 0.6),
  la: slabOf(LA_PLINTH, 4, 5, P, 4, 0.6),
  cp: slabOf(CP_PLINTH, 4, 5, P, 4, 0.6),
  gantryFootings: [
    slabOf({ x: -176, y: -44, w: 18, d: 18, r: 2 }, 4, 6, P),
    slabOf({ x: -176, y: -16, w: 18, d: 18, r: 2 }, 4, 6, P),
    slabOf({ x: 162, y: -44, w: 18, d: 18, r: 2 }, 4, 6, P),
    slabOf({ x: 162, y: -16, w: 18, d: 18, r: 2 }, 4, 6, P),
  ],
};

// Concrete Cable Trench between transformer, breaker and control cabinet
export const TRENCH_ART = {
  slab1: slabOf({ x: -110, y: 40, w: 20, d: 32, r: 1 }, 2, 2.5, P),
  slab2: slabOf({ x: -50, y: 10, w: 90, d: 16, r: 1 }, 2, 2.5, P),
  slab3: slabOf({ x: 55, y: -20, w: 16, d: 30, r: 1 }, 2, 2.5, P),
  grooves: [
    planOutline({ x: -108, y: 42, w: 16, d: 28, r: 0 }, 4.5, P),
    planOutline({ x: -48, y: 12, w: 86, d: 12, r: 0 }, 4.5, P),
    planOutline({ x: 57, y: -18, w: 12, d: 26, r: 0 }, 4.5, P),
  ].join(""),
  joints: [
    segment([-108, 50, 4.5], [-92, 50, 4.5], P),
    segment([-108, 60, 4.5], [-92, 60, 4.5], P),
    segment([-20, 12, 4.5], [-20, 24, 4.5], P),
    segment([10, 12, 4.5], [10, 24, 4.5], P),
  ].join(""),
};

// Grounding grid mesh conductors and equipment bonding straps
export const GROUND_ART = {
  perimeter: [
    segment([-185, -105, 4.2], [185, -105, 4.2], P),
    segment([185, -105, 4.2], [185, 105, 4.2], P),
    segment([185, 105, 4.2], [-185, 105, 4.2], P),
    segment([-185, 105, 4.2], [-185, -105, 4.2], P),
  ].join(""),
  meshLines: [
    segment([-185, -40, 4.2], [185, -40, 4.2], P),
    segment([-185, 30, 4.2], [185, 30, 4.2], P),
    segment([-60, -105, 4.2], [-60, 105, 4.2], P),
    segment([60, -105, 4.2], [60, 105, 4.2], P),
  ].join(""),
  risers: [
    // Riser bonding to transformer tank
    segment([-145, -30, 4.2], [-145, -30, 14], P),
    // Riser bonding to circuit breaker frame
    segment([40, -60, 4.2], [40, -60, 16], P),
    // Riser bonding to disconnect switch
    segment([140, -60, 4.2], [140, -60, 16], P),
    // Riser bonding to lightning arresters
    segment([40, 20, 4.2], [40, 20, 14], P),
    // Riser bonding to gantry towers
    segment([-168, -35, 4.2], [-168, -35, 16], P),
    segment([168, -35, 4.2], [168, -35, 16], P),
  ].join(""),
};

// -------------------------------------------------------------
// 2. MAIN POWER TRANSFORMER ASSEMBLY
// -------------------------------------------------------------

export const TRANSFORMER_ART = {
  // Mounting I-beam skids under tank
  skidLeft: slabOf({ x: -142, y: -30, w: 8, d: 58, r: 1 }, 9, 4, P),
  skidRight: slabOf({ x: -62, y: -30, w: 8, d: 58, r: 1 }, 9, 4, P),

  // Main oil tank
  tank: slabOf(TANK_PLAN, TANK_Z + 4, TANK_H - 4, P, 6, 1.2),
  tankFlange: slabOf(insetPlan(TANK_PLAN, -2), TANK_TOP - 2, 3, P, 6, 0.4),
  tankBolts: dotGrid(TANK_PLAN.x + 2, TANK_PLAN.y + 2, 7, 5, 14, TANK_TOP + 1.2, P),
  tankSeams: [
    sideArc(TANK_PLAN.x + TANK_PLAN.w / 2, TANK_PLAN.y + TANK_PLAN.d / 2, 38, TANK_Z + 18, P, 24),
    sideArc(TANK_PLAN.x + TANK_PLAN.w / 2, TANK_PLAN.y + TANK_PLAN.d / 2, 38, TANK_Z + 42, P, 24),
  ].join(""),

  // Marshalling / local terminal cabinet on front tank face
  marshallingBox: slabOf({ x: -118, y: 33, w: 32, d: 7, r: 1 }, 18, 28, P, 3, 0.4),
  marshallingDoor: [
    planOutline({ x: -116, y: 39, w: 28, d: 1, r: 0 }, 19, P),
    segment([-102, 39.5, 19], [-102, 39.5, 45], P), // Split doors line
  ].join(""),

  // Drain valve with wheel handle at bottom
  drainPipe: cylinder(-58, 33, 2.2, 12, 6, P, 16),
  drainWheel: ring(-58, 38, 4.5, 15, P, 20),

  // Oil sight glass on tank side
  sightGlass: [
    segment([-50, 10, 24], [-50, 10, 56], P),
    segment([-49, 10, 24], [-49, 10, 56], P),
  ].join(""),
  sightTicks: sideTicks(28, 52, 6, 2, 10, 56, [1.5, 3], P, "y"),
};

// Forced-Air Radiator Cooling Bank (10 fins across two banks + 4 cooling fans)
const createRadiatorFins = (): SolidPaths[] => {
  const fins: SolidPaths[] = [];
  // Left bank (5 fins on -y side)
  for (let i = 0; i < 5; i++) {
    const yPos = -52 + i * 4.2;
    fins.push(slabOf({ x: -138, y: yPos, w: 76, d: 2.2, r: 0.6 }, 18, 44, P));
  }
  return fins;
};

export const RADIATOR_ART = {
  fins: createRadiatorFins(),
  topHeaderPipe: cylinder(-100, -42, 3.2, 58, 12, P, 16),
  botHeaderPipe: cylinder(-100, -42, 3.2, 22, 12, P, 16),
  fans: [
    cylinder(-122, -42, 6.8, 10, 4, P, 24),
    cylinder(-102, -42, 6.8, 10, 4, P, 24),
    cylinder(-82, -42, 6.8, 10, 4, P, 24),
  ],
  fanGrilles: [
    ring(-122, -42, 5.2, 14, P, 16),
    ring(-102, -42, 5.2, 14, P, 16),
    ring(-82, -42, 5.2, 14, P, 16),
  ].join(""),
};

// Conservator Tank, Buchholz Relay and Silica Gel Breather
export const CONSERVATOR_ART = {
  // Diagonal A-frame support brackets
  brackets: [
    segment([-120, -10, TANK_TOP], [-115, -10, 92], P),
    segment([-75, -10, TANK_TOP], [-80, -10, 92], P),
    segment([-120, 10, TANK_TOP], [-115, 10, 92], P),
    segment([-75, 10, TANK_TOP], [-80, 10, 92], P),
  ].join(""),

  // Cylindrical oil expansion vessel (horizontal)
  body: cylinder(-96, -2, 11, 90, 46, P, 28, 0.8),
  endCap: sideArc(-96, -2, 11, 90, P, 24),

  // Connecting pipe to main tank with Buchholz relay capsule
  pipeDown: [
    segment([-96, 0, 90], [-96, 0, TANK_TOP], P),
  ].join(""),
  buchholz: cylinder(-96, 0, 4.2, 76, 6, P, 16),

  // Dehydrating silica gel breather pipe and glass canister
  breatherPipe: [
    segment([-68, -2, 98], [-54, -2, 98], P),
    segment([-54, -2, 98], [-54, -2, 50], P),
  ].join(""),
  silicaCanister: cylinder(-54, -2, 3.6, 38, 14, P, 16),
  canisterRing: ring(-54, -2, 3.8, 45, P, 16),
};

// High-Voltage & Low-Voltage Transformer Bushings
export const BUSHING_ART = {
  // 3 High-Voltage 33kV Porcelain Bushings on lid
  hvTurrets: [
    cylinder(-122, -18, 5.2, TANK_TOP, 3, P, 16),
    cylinder(-94, -18, 5.2, TANK_TOP, 3, P, 16),
    cylinder(-66, -18, 5.2, TANK_TOP, 3, P, 16),
  ],
  hvColumns: [
    cylinder(-122, -18, 2.4, TANK_TOP + 3, 28, P, 16),
    cylinder(-94, -18, 2.4, TANK_TOP + 3, 28, P, 16),
    cylinder(-66, -18, 2.4, TANK_TOP + 3, 28, P, 16),
  ],
  // 4 Stepped Porcelain Shed Skirts per Bushing
  hvSheds: [
    // Phase A
    cylinder(-122, -18, 5.8, TANK_TOP + 7, 1.8, P, 20),
    cylinder(-122, -18, 5.4, TANK_TOP + 13, 1.8, P, 20),
    cylinder(-122, -18, 5.0, TANK_TOP + 19, 1.8, P, 20),
    cylinder(-122, -18, 4.6, TANK_TOP + 25, 1.8, P, 20),
    // Phase B
    cylinder(-94, -18, 5.8, TANK_TOP + 7, 1.8, P, 20),
    cylinder(-94, -18, 5.4, TANK_TOP + 13, 1.8, P, 20),
    cylinder(-94, -18, 5.0, TANK_TOP + 19, 1.8, P, 20),
    cylinder(-94, -18, 4.6, TANK_TOP + 25, 1.8, P, 20),
    // Phase C
    cylinder(-66, -18, 5.8, TANK_TOP + 7, 1.8, P, 20),
    cylinder(-66, -18, 5.4, TANK_TOP + 13, 1.8, P, 20),
    cylinder(-66, -18, 5.0, TANK_TOP + 19, 1.8, P, 20),
    cylinder(-66, -18, 4.6, TANK_TOP + 25, 1.8, P, 20),
  ],
  hvTerminals: [
    cylinder(-122, -18, 1.6, TANK_TOP + 31, 4.5, P, 12),
    cylinder(-94, -18, 1.6, TANK_TOP + 31, 4.5, P, 12),
    cylinder(-66, -18, 1.6, TANK_TOP + 31, 4.5, P, 12),
  ],

  // 4 Low-Voltage 11kV Bushings on front side
  lvBushings: [
    cylinder(-124, 18, 2.6, TANK_TOP, 14, P, 14),
    cylinder(-104, 18, 2.6, TANK_TOP, 14, P, 14),
    cylinder(-84, 18, 2.6, TANK_TOP, 14, P, 14),
    cylinder(-64, 18, 2.6, TANK_TOP, 14, P, 14),
  ],
};

// -------------------------------------------------------------
// 3. HIGH-VOLTAGE SF6 CIRCUIT BREAKER ASSEMBLY
// -------------------------------------------------------------

export const BREAKER_ART = {
  // Support stand legs & diagonal bracing
  legs: [
    segment([38, -70, 9], [38, -70, 32], P),
    segment([38, -44, 9], [38, -44, 32], P),
    segment([92, -70, 9], [92, -70, 32], P),
    segment([92, -44, 9], [92, -44, 32], P),
    // Cross bracing
    segment([38, -70, 10], [92, -70, 30], P),
    segment([92, -70, 10], [38, -70, 30], P),
    segment([38, -44, 10], [92, -44, 30], P),
    segment([92, -44, 10], [38, -44, 30], P),
  ].join(""),

  // Operating mechanism cabinet (stainless steel)
  mechanismBox: slabOf({ x: 42, y: -64, w: 46, d: 24, r: 2 }, 32, 22, P, 4, 0.6),
  gaugeRing: ring(54, -40, 3.8, 44, P, 18),
  gaugePointer: segment([54, -40, 44], [56, -40, 46], P),
  manualHandle: slabOf({ x: 74, y: -40, w: 4, d: 2, r: 0.5 }, 40, 6, P),

  // 3 Vertical SF6 Interrupter Insulator Poles
  poles: [
    cylinder(50, -52, 3.8, 54, 42, P, 20),
    cylinder(65, -52, 3.8, 54, 42, P, 20),
    cylinder(80, -52, 3.8, 54, 42, P, 20),
  ],
  poleShedRings: [
    // Shed lines on pole insulators
    sideArc(50, -52, 4.4, 62, P, 18),
    sideArc(50, -52, 4.4, 72, P, 18),
    sideArc(50, -52, 4.4, 82, P, 18),
    sideArc(65, -52, 4.4, 62, P, 18),
    sideArc(65, -52, 4.4, 72, P, 18),
    sideArc(65, -52, 4.4, 82, P, 18),
    sideArc(80, -52, 4.4, 62, P, 18),
    sideArc(80, -52, 4.4, 72, P, 18),
    sideArc(80, -52, 4.4, 82, P, 18),
  ].join(""),

  // Top horizontal interrupter heads with gas piping
  heads: [
    cylinder(50, -52, 5.2, 96, 6, P, 18),
    cylinder(65, -52, 5.2, 96, 6, P, 18),
    cylinder(80, -52, 5.2, 96, 6, P, 18),
  ],
  terminals: [
    cylinder(50, -52, 2.0, 102, 4, P, 12),
    cylinder(65, -52, 2.0, 102, 4, P, 12),
    cylinder(80, -52, 2.0, 102, 4, P, 12),
  ],
};

// -------------------------------------------------------------
// 4. MOTORIZED DISCONNECT SWITCH / ISOLATOR
// -------------------------------------------------------------

export const DISCONNECT_ART = {
  // Elevated support frame
  legs: [
    segment([140, -70, 9], [140, -70, 42], P),
    segment([140, -44, 9], [140, -44, 42], P),
    segment([180, -70, 9], [180, -70, 42], P),
    segment([180, -44, 9], [180, -44, 42], P),
    segment([140, -70, 20], [180, -70, 20], P),
    segment([140, -44, 20], [180, -44, 20], P),
  ].join(""),

  // Base girder beam
  baseBeam: slabOf({ x: 136, y: -68, w: 48, d: 24, r: 1.5 }, 42, 4, P, 3, 0.4),

  // Drive motor operating mechanism on side
  driveBox: slabOf({ x: 132, y: -58, w: 6, d: 6, r: 1 }, 18, 12, P),
  driveShaft: cylinder(135, -55, 1.2, 8, 36, P, 10),

  // 3 Pairs of Rotating Post Insulators
  insulators: [
    cylinder(146, -60, 2.8, 46, 24, P, 16),
    cylinder(146, -48, 2.8, 46, 24, P, 16),
    cylinder(160, -60, 2.8, 46, 24, P, 16),
    cylinder(160, -48, 2.8, 46, 24, P, 16),
    cylinder(174, -60, 2.8, 46, 24, P, 16),
    cylinder(174, -48, 2.8, 46, 24, P, 16),
  ],
  insulatorRings: [
    sideArc(146, -60, 3.4, 54, P, 16),
    sideArc(146, -60, 3.4, 62, P, 16),
    sideArc(146, -48, 3.4, 54, P, 16),
    sideArc(146, -48, 3.4, 62, P, 16),
    sideArc(160, -60, 3.4, 54, P, 16),
    sideArc(160, -60, 3.4, 62, P, 16),
    sideArc(160, -48, 3.4, 54, P, 16),
    sideArc(160, -48, 3.4, 62, P, 16),
    sideArc(174, -60, 3.4, 54, P, 16),
    sideArc(174, -60, 3.4, 62, P, 16),
    sideArc(174, -48, 3.4, 54, P, 16),
    sideArc(174, -48, 3.4, 62, P, 16),
  ].join(""),

  // Articulated Copper Switch Blades & Jaw Contacts
  blades: [
    segment([146, -60, 70], [146, -48, 70], P),
    segment([160, -60, 70], [160, -48, 70], P),
    segment([174, -60, 70], [174, -48, 70], P),
  ].join(""),
  contacts: [
    cylinder(146, -48, 1.8, 70, 3, P, 12),
    cylinder(160, -48, 1.8, 70, 3, P, 12),
    cylinder(174, -48, 1.8, 70, 3, P, 12),
  ],
};

// -------------------------------------------------------------
// 5. SURGE / LIGHTNING ARRESTER BANK
// -------------------------------------------------------------

export const ARRESTER_ART = {
  // Support pedestals
  stands: [
    cylinder(42, 34, 2.4, 9, 18, P, 14),
    cylinder(60, 34, 2.4, 9, 18, P, 14),
    cylinder(78, 34, 2.4, 9, 18, P, 14),
  ],
  counterBoxes: [
    slabOf({ x: 40, y: 38, w: 4, d: 3, r: 0.6 }, 16, 5, P),
    slabOf({ x: 58, y: 38, w: 4, d: 3, r: 0.6 }, 16, 5, P),
    slabOf({ x: 76, y: 38, w: 4, d: 3, r: 0.6 }, 16, 5, P),
  ],
  // 3 Polymer Surge Columns with shed stacks
  columns: [
    cylinder(42, 34, 3.4, 27, 46, P, 18),
    cylinder(60, 34, 3.4, 27, 46, P, 18),
    cylinder(78, 34, 2.4, 27, 46, P, 18),
  ],
  shedRings: [
    sideArc(42, 34, 4.4, 35, P, 16),
    sideArc(42, 34, 4.4, 45, P, 16),
    sideArc(42, 34, 4.4, 55, P, 16),
    sideArc(42, 34, 4.4, 65, P, 16),
    sideArc(60, 34, 4.4, 35, P, 16),
    sideArc(60, 34, 4.4, 45, P, 16),
    sideArc(60, 34, 4.4, 55, P, 16),
    sideArc(60, 34, 4.4, 65, P, 16),
    sideArc(78, 34, 4.4, 35, P, 16),
    sideArc(78, 34, 4.4, 45, P, 16),
    sideArc(78, 34, 4.4, 55, P, 16),
    sideArc(78, 34, 4.4, 65, P, 16),
  ].join(""),
  terminals: [
    cylinder(42, 34, 1.2, 73, 5, P, 10),
    cylinder(60, 34, 1.2, 73, 5, P, 10),
    cylinder(78, 34, 1.2, 73, 5, P, 10),
  ],
};

// -------------------------------------------------------------
// 6. STRUCTURAL STEEL GANTRY & 33kV OVERHEAD BUSBARS
// -------------------------------------------------------------

export const GANTRY_ART = {
  // Left lattice tower legs and lacing
  leftTower: [
    segment([-172, -40, 10], [-172, -40, GANTRY_TOP], P),
    segment([-172, -20, 10], [-172, -20, GANTRY_TOP], P),
    segment([-160, -40, 10], [-160, -40, GANTRY_TOP], P),
    segment([-160, -20, 10], [-160, -20, GANTRY_TOP], P),
    // Horizontal struts
    segment([-172, -40, 45], [-160, -40, 45], P),
    segment([-172, -20, 45], [-160, -20, 45], P),
    segment([-172, -40, 85], [-160, -40, 85], P),
    segment([-172, -20, 85], [-160, -20, 85], P),
    segment([-172, -40, 125], [-160, -40, 125], P),
    segment([-172, -20, 125], [-160, -20, 125], P),
    // Diagonal lacing
    segment([-172, -40, 10], [-160, -40, 45], P),
    segment([-160, -40, 45], [-172, -40, 85], P),
    segment([-172, -40, 85], [-160, -40, 125], P),
  ].join(""),

  // Right lattice tower legs and lacing
  rightTower: [
    segment([165, -40, 10], [165, -40, GANTRY_TOP], P),
    segment([165, -20, 10], [165, -20, GANTRY_TOP], P),
    segment([177, -40, 10], [177, -40, GANTRY_TOP], P),
    segment([177, -20, 10], [177, -20, GANTRY_TOP], P),
    // Horizontal struts
    segment([165, -40, 45], [177, -40, 45], P),
    segment([165, -20, 45], [177, -20, 45], P),
    segment([165, -40, 85], [177, -40, 85], P),
    segment([165, -20, 85], [177, -20, 85], P),
    segment([165, -40, 125], [177, -40, 125], P),
    segment([165, -20, 125], [177, -20, 125], P),
    // Diagonal lacing
    segment([165, -40, 10], [177, -40, 45], P),
    segment([177, -40, 45], [165, -40, 85], P),
    segment([165, -40, 85], [177, -40, 125], P),
  ].join(""),

  // Overhead horizontal cross-arm bridge spanning from left to right
  bridge: [
    segment([-172, -30, GANTRY_TOP - 6], [177, -30, GANTRY_TOP - 6], P),
    segment([-172, -30, GANTRY_TOP], [177, -30, GANTRY_TOP], P),
    segment([-172, -18, GANTRY_TOP - 6], [177, -18, GANTRY_TOP - 6], P),
    segment([-172, -18, GANTRY_TOP], [177, -18, GANTRY_TOP], P),
    // Cross bridge diagonal lattice
    segment([-120, -30, GANTRY_TOP - 6], [-80, -30, GANTRY_TOP], P),
    segment([-80, -30, GANTRY_TOP], [-40, -30, GANTRY_TOP - 6], P),
    segment([-40, -30, GANTRY_TOP - 6], [0, -30, GANTRY_TOP], P),
    segment([0, -30, GANTRY_TOP], [40, -30, GANTRY_TOP - 6], P),
    segment([40, -30, GANTRY_TOP - 6], [80, -30, GANTRY_TOP], P),
    segment([80, -30, GANTRY_TOP], [120, -30, GANTRY_TOP - 6], P),
  ].join(""),

  // 3 Strain Insulator Disc Suspension Strings hanging from bridge
  insulators: [
    cylinder(-100, -24, 2.2, GANTRY_BUSBAR_Z, 12, P, 14),
    cylinder(0, -24, 2.2, GANTRY_BUSBAR_Z, 12, P, 14),
    cylinder(100, -24, 2.2, GANTRY_BUSBAR_Z, 12, P, 14),
  ],

  // 3 Rigid Aluminum Tubular Busbars spanning across yard (Phase A, B, C)
  busbarA: segment([-180, -38, GANTRY_BUSBAR_Z], [185, -38, GANTRY_BUSBAR_Z], P),
  busbarB: segment([-180, -24, GANTRY_BUSBAR_Z], [185, -24, GANTRY_BUSBAR_Z], P),
  busbarC: segment([-180, -10, GANTRY_BUSBAR_Z], [185, -10, GANTRY_BUSBAR_Z], P),

  // Flexible Dropper Jumper Cables (Power Flow Catenary Lines)
  // Droppers from Busbars down to Disconnect Switch
  dropperToDS: [
    segment([146, -38, GANTRY_BUSBAR_Z], [146, -48, 73], P),
    segment([160, -24, GANTRY_BUSBAR_Z], [160, -48, 73], P),
    segment([174, -10, GANTRY_BUSBAR_Z], [174, -48, 73], P),
  ].join(""),

  // Droppers from Disconnect Switch to Circuit Breaker
  dropperDSToCB: [
    segment([146, -60, 72], [80, -52, 102], P),
    segment([160, -60, 72], [65, -52, 102], P),
    segment([174, -60, 72], [50, -52, 102], P),
  ].join(""),

  // Droppers from Circuit Breaker to Transformer HV Bushings
  dropperCBToTR: [
    segment([50, -52, 106], [-66, -18, TANK_TOP + 35], P),
    segment([65, -52, 106], [-94, -18, TANK_TOP + 35], P),
    segment([80, -52, 106], [-122, -18, TANK_TOP + 35], P),
  ].join(""),

  // Jumpers from Transformer Bushings to Lightning Arresters
  jumperTRToLA: [
    segment([-66, -18, TANK_TOP + 35], [42, 34, 78], P),
    segment([-94, -18, TANK_TOP + 35], [60, 34, 78], P),
    segment([-122, -18, TANK_TOP + 35], [78, 34, 78], P),
  ].join(""),
};

// -------------------------------------------------------------
// 7. SUBSTATION PROTECTION & CONTROL CABINET (RTU & RELAYS)
// -------------------------------------------------------------

export const CABINET_ART = {
  // Weather-sealed stainless steel enclosure
  enclosure: slabOf({ x: -118, y: 76, w: 66, d: 36, r: 2 }, 8, 54, P, 4, 0.8),
  canopy: slabOf({ x: -121, y: 74, w: 72, d: 40, r: 2 }, 62, 4, P, 4, 0.6),

  // Double doors line and handles
  doorSplit: segment([-85, 112, 12], [-85, 112, 60], P),
  leftHandle: slabOf({ x: -89, y: 112.5, w: 2, d: 1.5, r: 0.4 }, 34, 6, P),
  rightHandle: slabOf({ x: -83, y: 112.5, w: 2, d: 1.5, r: 0.4 }, 34, 6, P),

  // Louver vents on cabinet side
  louvers: [
    segment([-118.5, 84, 46], [-118.5, 104, 46], P),
    segment([-118.5, 84, 49], [-118.5, 104, 49], P),
    segment([-118.5, 84, 52], [-118.5, 104, 52], P),
  ].join(""),

  // Status Warning Strobe Beacon on top
  beaconStem: cylinder(-85, 94, 1.8, 66, 3, P, 12),
  beaconLens: cylinder(-85, 94, 3.2, 69, 5, P, 16),

  // Visualized internal digital protection relay panels (SEL-487E / SEL-351)
  relays: [
    slabOf({ x: -110, y: 111, w: 22, d: 1, r: 0.5 }, 36, 16, P),
    slabOf({ x: -82, y: 111, w: 22, d: 1, r: 0.5 }, 36, 16, P),
  ],
  relayScreens: [
    planOutline({ x: -108, y: 111.5, w: 10, d: 0.5, r: 0.2 }, 44, P),
    planOutline({ x: -80, y: 111.5, w: 10, d: 0.5, r: 0.2 }, 44, P),
  ].join(""),
  relayLeds: [
    ...dotGrid(-96, 111.5, 2, 4, 2, 44, P),
    ...dotGrid(-68, 111.5, 2, 4, 2, 44, P),
  ],
};
