import {
  cylinder,
  insetPlan,
  planOutline,
  segment,
  slabOf,
} from "../iso/iso-kit";
import {
  P,
  HOSP_SITE_PLAN,
  HOSP_SITE_Z0,
  HOSP_SITE_H,
  HOSP_SITE_TOP,
} from "./view";

// -------------------------------------------------------------
// 1. SITE FOUNDATION & EMERGENCY RAMP
// -------------------------------------------------------------
export const SITE_ART = {
  slab: slabOf(HOSP_SITE_PLAN, HOSP_SITE_Z0, HOSP_SITE_H, P, 8, 1.5),
  curbs: planOutline(insetPlan(HOSP_SITE_PLAN, 4), HOSP_SITE_TOP + 0.2, P),
  emergencyDrive: [
    segment([-220, 110, HOSP_SITE_TOP + 0.2], [-60, 110, HOSP_SITE_TOP + 0.2], P),
    segment([-220, 150, HOSP_SITE_TOP + 0.2], [-60, 150, HOSP_SITE_TOP + 0.2], P),
  ].join(""),
};

// -------------------------------------------------------------
// 2. MAIN CLINICAL & SURGICAL INPATIENT TOWER
// -------------------------------------------------------------
export const TOWER_Z0 = HOSP_SITE_TOP;
export const TOWER_H = 76;
export const TOWER_ROOF_Z = TOWER_Z0 + TOWER_H;

export const TOWER_ART = {
  podium: slabOf({ x: -140, y: -140, w: 180, d: 130, r: 6 }, TOWER_Z0, 24, P, 4, 1.2),
  tower: slabOf({ x: -120, y: -125, w: 140, d: 100, r: 4 }, TOWER_Z0 + 24, TOWER_H - 24, P, 4, 1.0),
  // Floor-by-floor Architectural Ribbon Window Bands
  windowBands: [
    segment([-115, -24.8, TOWER_Z0 + 34], [15, -24.8, TOWER_Z0 + 34], P),
    segment([-115, -24.8, TOWER_Z0 + 46], [15, -24.8, TOWER_Z0 + 46], P),
    segment([-115, -24.8, TOWER_Z0 + 58], [15, -24.8, TOWER_Z0 + 58], P),
    segment([-115, -24.8, TOWER_Z0 + 70], [15, -24.8, TOWER_Z0 + 70], P),
  ].join(""),
  // Rooftop Bio-Containment HVAC Air Scrubbers
  hvacChillers: [
    slabOf({ x: -105, y: -110, w: 32, d: 24, r: 2 }, TOWER_ROOF_Z, 14, P),
    slabOf({ x: -65, y: -110, w: 32, d: 24, r: 2 }, TOWER_ROOF_Z, 14, P),
  ],
};

// -------------------------------------------------------------
// 3. ILLUMINATED ROOFTOP EMERGENCY HELIPAD
// -------------------------------------------------------------
export const HELIPAD_CENTER = [-50, -75] as [number, number];

export const HELIPAD_ART = {
  deck: cylinder(HELIPAD_CENTER[0], HELIPAD_CENTER[1], 36, TOWER_ROOF_Z, 5, P, 24),
  outerRing: [
    segment([HELIPAD_CENTER[0] - 28, HELIPAD_CENTER[1], TOWER_ROOF_Z + 5.2], [HELIPAD_CENTER[0] + 28, HELIPAD_CENTER[1], TOWER_ROOF_Z + 5.2], P),
    segment([HELIPAD_CENTER[0], HELIPAD_CENTER[1] - 28, TOWER_ROOF_Z + 5.2], [HELIPAD_CENTER[0], HELIPAD_CENTER[1] + 28, TOWER_ROOF_Z + 5.2], P),
  ].join(""),
  // "H" Marking
  hMarking: [
    segment([HELIPAD_CENTER[0] - 10, HELIPAD_CENTER[1] - 12, TOWER_ROOF_Z + 5.3], [HELIPAD_CENTER[0] - 10, HELIPAD_CENTER[1] + 12, TOWER_ROOF_Z + 5.3], P),
    segment([HELIPAD_CENTER[0] + 10, HELIPAD_CENTER[1] - 12, TOWER_ROOF_Z + 5.3], [HELIPAD_CENTER[0] + 10, HELIPAD_CENTER[1] + 12, TOWER_ROOF_Z + 5.3], P),
    segment([HELIPAD_CENTER[0] - 10, HELIPAD_CENTER[1], TOWER_ROOF_Z + 5.3], [HELIPAD_CENTER[0] + 10, HELIPAD_CENTER[1], TOWER_ROOF_Z + 5.3], P),
  ].join(""),
  beacon: segment([HELIPAD_CENTER[0] + 32, HELIPAD_CENTER[1] - 25, TOWER_ROOF_Z + 5], [HELIPAD_CENTER[0] + 32, HELIPAD_CENTER[1] - 25, TOWER_ROOF_Z + 22], P),
};

// -------------------------------------------------------------
// 4. EMERGENCY TRAUMA RECEPTION & AMBULANCE BAY
// -------------------------------------------------------------
export const TRAUMA_ART = {
  wing: slabOf({ x: -220, y: 0, w: 90, d: 75, r: 4 }, HOSP_SITE_TOP, 28, P, 3, 1.2),
  canopy: slabOf({ x: -230, y: 75, w: 110, d: 35, r: 3 }, HOSP_SITE_TOP + 20, 4, P, 3, 1.4),
  canopyPillars: [
    cylinder(-225, 105, 2, HOSP_SITE_TOP, 20, P, 8),
    cylinder(-125, 105, 2, HOSP_SITE_TOP, 20, P, 8),
  ],
  // Ambulance Vehicle 1
  ambulance1: slabOf({ x: -210, y: 80, w: 32, d: 18, r: 2 }, HOSP_SITE_TOP, 16, P, 2, 0.8),
  // Ambulance Vehicle 2
  ambulance2: slabOf({ x: -160, y: 80, w: 32, d: 18, r: 2 }, HOSP_SITE_TOP, 16, P, 2, 0.8),
  // Red Cross Insignia Lines on Wing Facade
  crossLines: [
    segment([-175, -0.1, HOSP_SITE_TOP + 12], [-175, -0.1, HOSP_SITE_TOP + 22], P),
    segment([-180, -0.1, HOSP_SITE_TOP + 17], [-170, -0.1, HOSP_SITE_TOP + 17], P),
  ].join(""),
};

// -------------------------------------------------------------
// 5. CRYOGENIC LIQUID MEDICAL OXYGEN (O2) BULK TANK FARM
// -------------------------------------------------------------
export const OXYGEN_ART = {
  plinth: slabOf({ x: 90, y: -140, w: 85, d: 70, r: 3 }, HOSP_SITE_TOP, 5, P),
  // 2 Massive Vertical Vacuum Insulated Cryo-Tanks
  tank1: cylinder(115, -110, 14, HOSP_SITE_TOP + 5, 52, P, 18),
  tank2: cylinder(150, -110, 14, HOSP_SITE_TOP + 5, 52, P, 18),
  tankCaps: [
    cylinder(115, -110, 13, HOSP_SITE_TOP + 57, 5, P, 16),
    cylinder(150, -110, 13, HOSP_SITE_TOP + 57, 5, P, 16),
  ],
  // Ambient Atmospheric Vaporizer Towers
  vaporizers: [
    segment([100, -80, HOSP_SITE_TOP + 5], [100, -80, HOSP_SITE_TOP + 32], P),
    segment([108, -80, HOSP_SITE_TOP + 5], [108, -80, HOSP_SITE_TOP + 32], P),
    segment([116, -80, HOSP_SITE_TOP + 5], [116, -80, HOSP_SITE_TOP + 32], P),
  ].join(""),
};

// -------------------------------------------------------------
// 6. EMERGENCY BACKUP DIESEL GENERATION PLANT
// -------------------------------------------------------------
export const GEN_PLANT_ART = {
  plinth: slabOf({ x: 90, y: -30, w: 95, d: 85, r: 4 }, HOSP_SITE_TOP, 5, P),
  gen1: slabOf({ x: 105, y: -15, w: 32, d: 55, r: 2 }, HOSP_SITE_TOP + 5, 22, P, 3, 1.0),
  gen2: slabOf({ x: 145, y: -15, w: 32, d: 55, r: 2 }, HOSP_SITE_TOP + 5, 22, P, 3, 1.0),
  // Vertical Silencer Exhaust Stacks
  exhaustStacks: [
    cylinder(121, 25, 3, HOSP_SITE_TOP + 27, 24, P, 10),
    cylinder(161, 25, 3, HOSP_SITE_TOP + 27, 24, P, 10),
  ],
};
