import {
  cylinder,
  insetPlan,
  knurl,
  planOutline,
  segment,
  slabOf,
} from "../iso/iso-kit";
import {
  P,
  WATER_SITE_PLAN,
  WATER_SITE_Z0,
  WATER_SITE_H,
  WATER_SITE_TOP,
} from "./view";

// -------------------------------------------------------------
// 1. SITE FOUNDATION & CIVIL DRAINAGE
// -------------------------------------------------------------
export const SITE_ART = {
  slab: slabOf(WATER_SITE_PLAN, WATER_SITE_Z0, WATER_SITE_H, P, 8, 1.5),
  curbs: planOutline(insetPlan(WATER_SITE_PLAN, 4), WATER_SITE_TOP + 0.2, P),
  drainLines: [
    segment([-220, -180, WATER_SITE_TOP + 0.2], [-80, -180, WATER_SITE_TOP + 0.2], P),
    segment([-220, -160, WATER_SITE_TOP + 0.2], [-80, -160, WATER_SITE_TOP + 0.2], P),
    segment([-220, -140, WATER_SITE_TOP + 0.2], [-80, -140, WATER_SITE_TOP + 0.2], P),
  ].join(""),
};

// -------------------------------------------------------------
// 2. RAW WATER INTAKE & CASCADE AERATION
// -------------------------------------------------------------
export const INTAKE_ART = {
  // Intake Well Foundation & Pump Plinth
  intakePlinth: slabOf({ x: -240, y: -180, w: 90, d: 70, r: 4 }, WATER_SITE_TOP, 6, P),
  
  // 3 Vertical Turbine Intake Pumps
  pumps: [
    cylinder(-215, -155, 6, WATER_SITE_TOP + 6, 24, P, 10),
    cylinder(-195, -155, 6, WATER_SITE_TOP + 6, 24, P, 10),
    cylinder(-175, -155, 6, WATER_SITE_TOP + 6, 24, P, 10),
  ],
  pumpMotors: [
    cylinder(-215, -155, 4.5, WATER_SITE_TOP + 30, 14, P, 10),
    cylinder(-195, -155, 4.5, WATER_SITE_TOP + 30, 14, P, 10),
    cylinder(-175, -155, 4.5, WATER_SITE_TOP + 30, 14, P, 10),
  ],
  
  // Intake Manifold Pipe
  intakeHeader: segment([-225, -135, WATER_SITE_TOP + 18], [-160, -135, WATER_SITE_TOP + 18], P),
  
  // Stepped Aeration Cascade (Terraces)
  cascade1: slabOf({ x: -240, y: -90, w: 80, d: 65, r: 3 }, WATER_SITE_TOP, 8, P),
  cascade2: slabOf({ x: -230, y: -80, w: 60, d: 45, r: 2 }, WATER_SITE_TOP + 8, 10, P),
  cascade3: slabOf({ x: -220, y: -70, w: 40, d: 25, r: 2 }, WATER_SITE_TOP + 18, 12, P),
};

// -------------------------------------------------------------
// 3. COAGULATION & FLOCCULATION BASIN
// -------------------------------------------------------------
export const COAGULATION_ART = {
  tank: slabOf({ x: -130, y: -180, w: 100, d: 75, r: 4 }, WATER_SITE_TOP, 28, P, 3, 1.2),
  baffles: [
    segment([-100, -180, WATER_SITE_TOP + 28], [-100, -120, WATER_SITE_TOP + 28], P),
    segment([-60, -165, WATER_SITE_TOP + 28], [-60, -105, WATER_SITE_TOP + 28], P),
  ].join(""),
  // Rapid Flash Mixer Motors
  mixers: [
    cylinder(-110, -145, 3.5, WATER_SITE_TOP + 28, 12, P, 8),
    cylinder(-80, -145, 3.5, WATER_SITE_TOP + 28, 12, P, 8),
  ],
};

// -------------------------------------------------------------
// 4. DUAL CIRCULAR SEDIMENTATION CLARIFIERS
// -------------------------------------------------------------
export const CLARIFIER_1 = {
  center: [-170, 70] as [number, number],
  radius: 52,
};
export const CLARIFIER_2 = {
  center: [-40, 70] as [number, number],
  radius: 52,
};

export const CLARIFIERS_ART = {
  // Clarifier 1 (West Basin)
  basin1: cylinder(CLARIFIER_1.center[0], CLARIFIER_1.center[1], CLARIFIER_1.radius, WATER_SITE_TOP, 24, P, 24),
  well1: cylinder(CLARIFIER_1.center[0], CLARIFIER_1.center[1], 10, WATER_SITE_TOP + 4, 26, P, 14),
  bridge1: segment(
    [CLARIFIER_1.center[0] - CLARIFIER_1.radius, CLARIFIER_1.center[1], WATER_SITE_TOP + 26],
    [CLARIFIER_1.center[0] + CLARIFIER_1.radius, CLARIFIER_1.center[1], WATER_SITE_TOP + 26],
    P
  ),
  driveMotor1: cylinder(CLARIFIER_1.center[0], CLARIFIER_1.center[1], 4, WATER_SITE_TOP + 26, 8, P, 8),

  // Clarifier 2 (East Basin)
  basin2: cylinder(CLARIFIER_2.center[0], CLARIFIER_2.center[1], CLARIFIER_2.radius, WATER_SITE_TOP, 24, P, 24),
  well2: cylinder(CLARIFIER_2.center[0], CLARIFIER_2.center[1], 10, WATER_SITE_TOP + 4, 26, P, 14),
  bridge2: segment(
    [CLARIFIER_2.center[0] - CLARIFIER_2.radius, CLARIFIER_2.center[1], WATER_SITE_TOP + 26],
    [CLARIFIER_2.center[0] + CLARIFIER_2.radius, CLARIFIER_2.center[1], WATER_SITE_TOP + 26],
    P
  ),
  driveMotor2: cylinder(CLARIFIER_2.center[0], CLARIFIER_2.center[1], 4, WATER_SITE_TOP + 26, 8, P, 8),
};

// -------------------------------------------------------------
// 5. RAPID GRAVITY SAND FILTERS & VALVE GALLERY
// -------------------------------------------------------------
export const FILTRATION_ART = {
  building: slabOf({ x: 90, y: -180, w: 140, d: 85, r: 4 }, WATER_SITE_TOP, 34, P, 4, 1.2),
  filterBays: [
    segment([105, -170, WATER_SITE_TOP + 34], [105, -105, WATER_SITE_TOP + 34], P),
    segment([140, -170, WATER_SITE_TOP + 34], [140, -105, WATER_SITE_TOP + 34], P),
    segment([175, -170, WATER_SITE_TOP + 34], [175, -105, WATER_SITE_TOP + 34], P),
    segment([210, -170, WATER_SITE_TOP + 34], [210, -105, WATER_SITE_TOP + 34], P),
  ].join(""),
  backwashTanks: [
    cylinder(110, -140, 7, WATER_SITE_TOP + 34, 16, P, 10),
    cylinder(150, -140, 7, WATER_SITE_TOP + 34, 16, P, 10),
    cylinder(190, -140, 7, WATER_SITE_TOP + 34, 16, P, 10),
  ],
};

// -------------------------------------------------------------
// 6. CHEMICAL DOSING & CHLORINATION HOUSE
// -------------------------------------------------------------
export const CHEMICAL_ART = {
  building: slabOf({ x: 0, y: -180, w: 75, d: 65, r: 3 }, WATER_SITE_TOP, 24, P, 3, 1.0),
  silos: [
    cylinder(18, -150, 6, WATER_SITE_TOP + 24, 22, P, 10),
    cylinder(38, -150, 6, WATER_SITE_TOP + 24, 22, P, 10),
    cylinder(58, -150, 6, WATER_SITE_TOP + 24, 22, P, 10),
  ],
};

// -------------------------------------------------------------
// 7. HIGH-PRESSURE TREATED WATER BOOSTER PUMP HOUSE
// -------------------------------------------------------------
export const PUMP_HOUSE_ART = {
  building: slabOf({ x: 90, y: -75, w: 140, d: 70, r: 4 }, WATER_SITE_TOP, 28, P, 4, 1.2),
  roofVents: [
    cylinder(125, -40, 4, WATER_SITE_TOP + 28, 8, P, 8),
    cylinder(165, -40, 4, WATER_SITE_TOP + 28, 8, P, 8),
    cylinder(205, -40, 4, WATER_SITE_TOP + 28, 8, P, 8),
  ],
  dischargeHeader: [
    segment([100, -15, WATER_SITE_TOP + 12], [220, -15, WATER_SITE_TOP + 12], P),
    segment([220, -15, WATER_SITE_TOP + 12], [220, 40, WATER_SITE_TOP + 12], P),
  ].join(""),
};

// -------------------------------------------------------------
// 8. MASSIVE MUNICIPAL POTABLE WATER RESERVOIR TANK
// -------------------------------------------------------------
export const RESERVOIR = {
  center: [145, 105] as [number, number],
  radius: 68,
  height: 82,
};

export const RESERVOIR_ART = {
  plinth: slabOf({ x: 65, y: 25, w: 160, d: 160, r: 6 }, WATER_SITE_TOP, 6, P),
  tank: cylinder(RESERVOIR.center[0], RESERVOIR.center[1], RESERVOIR.radius, WATER_SITE_TOP + 6, RESERVOIR.height, P, 28),
  knurlRings: [
    knurl(RESERVOIR.center[0], RESERVOIR.center[1], RESERVOIR.radius + 1, WATER_SITE_TOP + 25, WATER_SITE_TOP + 28, 1, P),
    knurl(RESERVOIR.center[0], RESERVOIR.center[1], RESERVOIR.radius + 1, WATER_SITE_TOP + 55, WATER_SITE_TOP + 58, 1, P),
  ].join(""),
  domeRoof: cylinder(RESERVOIR.center[0], RESERVOIR.center[1], RESERVOIR.radius - 2, WATER_SITE_TOP + 6 + RESERVOIR.height, 8, P, 24),
  accessLadder: segment(
    [RESERVOIR.center[0] - RESERVOIR.radius + 1, RESERVOIR.center[1] + 15, WATER_SITE_TOP + 6],
    [RESERVOIR.center[0] - RESERVOIR.radius + 1, RESERVOIR.center[1] + 15, WATER_SITE_TOP + 6 + RESERVOIR.height + 4],
    P
  ),
  telemetryAntenna: segment(
    [RESERVOIR.center[0], RESERVOIR.center[1], WATER_SITE_TOP + 6 + RESERVOIR.height + 8],
    [RESERVOIR.center[0], RESERVOIR.center[1], WATER_SITE_TOP + 6 + RESERVOIR.height + 28],
    P
  ),
};

// -------------------------------------------------------------
// 9. INTERCONNECTING WATER PROCESS PIPING CORRIDORS
// -------------------------------------------------------------
export const PIPING_ART = {
  // Intake -> Aeration cascade
  pipeIntakeCascade: segment([-195, -135, WATER_SITE_TOP + 12], [-195, -90, WATER_SITE_TOP + 12], P),
  
  // Aeration -> Coagulation basin
  pipeAerationCoag: [
    segment([-160, -60, WATER_SITE_TOP + 12], [-140, -60, WATER_SITE_TOP + 12], P),
    segment([-140, -60, WATER_SITE_TOP + 12], [-140, -140, WATER_SITE_TOP + 12], P),
    segment([-140, -140, WATER_SITE_TOP + 12], [-130, -140, WATER_SITE_TOP + 12], P),
  ].join(""),

  // Coagulation -> Clarifiers manifold
  pipeClarifierFeeder: [
    segment([-30, -140, WATER_SITE_TOP + 10], [-30, 0, WATER_SITE_TOP + 10], P),
    segment([-30, 0, WATER_SITE_TOP + 10], [-170, 0, WATER_SITE_TOP + 10], P),
    segment([-170, 0, WATER_SITE_TOP + 10], [-170, 18, WATER_SITE_TOP + 10], P),
    segment([-30, 0, WATER_SITE_TOP + 10], [-40, 0, WATER_SITE_TOP + 10], P),
    segment([-40, 0, WATER_SITE_TOP + 10], [-40, 18, WATER_SITE_TOP + 10], P),
  ].join(""),

  // Clarifiers -> Sand Filtration building
  pipeClarifierFilters: [
    segment([-170, 122, WATER_SITE_TOP + 8], [-170, 145, WATER_SITE_TOP + 8], P),
    segment([-170, 145, WATER_SITE_TOP + 8], [60, 145, WATER_SITE_TOP + 8], P),
    segment([60, 145, WATER_SITE_TOP + 8], [60, -140, WATER_SITE_TOP + 8], P),
    segment([60, -140, WATER_SITE_TOP + 8], [90, -140, WATER_SITE_TOP + 8], P),
  ].join(""),

  // Filtration -> Booster pumps -> Reservoir
  pipeFiltersPumpReservoir: [
    segment([160, -95, WATER_SITE_TOP + 10], [160, -75, WATER_SITE_TOP + 10], P),
    segment([145, -5, WATER_SITE_TOP + 10], [145, 25, WATER_SITE_TOP + 10], P),
  ].join(""),
};
