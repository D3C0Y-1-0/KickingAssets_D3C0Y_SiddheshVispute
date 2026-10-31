import {
  fitProjection,
  iso,
  type Flat,
  type Plan,
  type Point3,
  type Projection,
} from "../iso/iso-kit";

export const WIDTH = 1340;
export const HEIGHT = 860;
const PAD = 48;
export const AZIMUTH = 48;
export const ELEVATION = 30;

// -------------------------------------------------------------
// 1. DISTINCT MODULAR BASES — SPREAD OUT WITH MORE GAP
// -------------------------------------------------------------

// BASE 1: Bulk Electricity Power Plant & Substation Campus (West)
export const POWER_BASE_PLAN: Plan = { x: -480, y: -90, w: 175, d: 140, r: 10 };
export const POWER_BASE_Z0 = -4;
export const POWER_BASE_H = 12;
export const POWER_BASE_TOP = POWER_BASE_Z0 + POWER_BASE_H;

// BASE 2: 5G Telecom & Edge Compute Compound (North-West)
export const EDGE_BASE_PLAN: Plan = { x: -340, y: -310, w: 155, d: 125, r: 10 };
export const EDGE_BASE_Z0 = -2;
export const EDGE_BASE_H = 12;
export const EDGE_BASE_TOP = EDGE_BASE_Z0 + EDGE_BASE_H;

// BASE 3: Smart City IOC Command & Civic Plaza (North-East)
export const IOC_BASE_PLAN: Plan = { x: 80, y: -320, w: 195, d: 150, r: 12 };
export const IOC_BASE_Z0 = 0;
export const IOC_BASE_H = 14;
export const IOC_BASE_TOP = IOC_BASE_Z0 + IOC_BASE_H;

// BASE 4: Municipal Water Purification & Reservoir (East)
export const WATER_BASE_PLAN: Plan = { x: 310, y: -85, w: 155, d: 130, r: 10 };
export const WATER_BASE_Z0 = -4;
export const WATER_BASE_H = 12;
export const WATER_BASE_TOP = WATER_BASE_Z0 + WATER_BASE_H;

// BASE 5: Regional Trauma Hospital & Medical Campus (South-East)
export const HOSP_BASE_PLAN: Plan = { x: 100, y: 100, w: 205, d: 155, r: 12 };
export const HOSP_BASE_Z0 = 2;
export const HOSP_BASE_H = 12;
export const HOSP_BASE_TOP = HOSP_BASE_Z0 + HOSP_BASE_H;

// BASE 6: Smart Transit & EV Mobility Hub (South-West)
export const TRANSIT_BASE_PLAN: Plan = { x: -340, y: 110, w: 170, d: 135, r: 10 };
export const TRANSIT_BASE_Z0 = 0;
export const TRANSIT_BASE_H = 12;
export const TRANSIT_BASE_TOP = TRANSIT_BASE_Z0 + TRANSIT_BASE_H;

// -------------------------------------------------------------
// KEY EQUIPMENT DIMENSIONS & ROOFTOP HEIGHTS
// -------------------------------------------------------------

// Power Substation Equipment (relative to POWER base)
export const TR_TANK_PLAN: Plan = { x: -445, y: -65, w: 55, d: 45, r: 4 };
export const TR_TANK_Z = POWER_BASE_TOP;
export const TR_TANK_H = 42;
export const BESS_POD_1: Plan = { x: -375, y: -80, w: 28, d: 46, r: 2 };
export const BESS_POD_2: Plan = { x: -340, y: -80, w: 28, d: 46, r: 2 };
export const SOLAR_CANOPY_PLAN: Plan = { x: -465, y: 0, w: 90, d: 40, r: 2 };

// Edge Datacenter & Mast
export const EDGE_DC_PLAN: Plan = { x: -325, y: -295, w: 80, d: 68, r: 4 };
export const EDGE_DC_Z = EDGE_BASE_TOP;
export const EDGE_DC_H = 40;
export const MAST_BASE: Point3 = [-220, -250, EDGE_BASE_TOP];
export const MAST_TOP_Z = 165;

// IOC Skyscraper
export const IOC_PODIUM_PLAN: Plan = { x: 100, y: -300, w: 155, d: 115, r: 6 };
export const IOC_TOWER_STAGE1: Plan = { x: 120, y: -285, w: 115, d: 85, r: 4 };
export const IOC_TOWER_STAGE2: Plan = { x: 140, y: -265, w: 75, d: 55, r: 3 };
export const IOC_ROOF_Z = 138;
export const IOC_HELIPAD_CENTER: Point3 = [177, -237, IOC_ROOF_Z];

// Water Works
export const WATER_TANK_CENTER: Point3 = [385, -25, WATER_BASE_TOP];
export const WATER_TANK_RADIUS = 26;
export const WATER_TANK_HEIGHT = 72;

// Hospital Complex
export const HOSP_MAIN_PLAN: Plan = { x: 120, y: 120, w: 120, d: 90, r: 6 };
export const HOSP_MAIN_Z = HOSP_BASE_TOP;
export const HOSP_MAIN_H = 68;
export const HOSP_ROOF_Z = HOSP_MAIN_Z + HOSP_MAIN_H;
export const HOSP_EMG_PLAN: Plan = { x: 200, y: 165, w: 65, d: 50, r: 4 };
export const HOSP_HELIPAD_CENTER: Point3 = [180, 165, HOSP_ROOF_Z];

// Transit Hub & Viaduct
export const TRANSIT_TERMINAL_PLAN: Plan = { x: -320, y: 125, w: 85, d: 55, r: 4 };
export const EV_BUS_PLAN: Plan = { x: -290, y: 195, w: 28, d: 45, r: 3 };
export const VIADUCT_Z = 48;

// Helper to compute bounding corners for projection fit
const boxCorners = ({ x, y, w, d }: Plan, z0: number, z1: number): Point3[] => {
  const pts: Point3[] = [];
  for (const px of [x, x + w]) {
    for (const py of [y, y + d]) {
      for (const pz of [z0, z1]) {
        pts.push([px, py, pz]);
      }
    }
  }
  return pts;
};

// Compute optimal isometric projection tightly framing all 6 distinct island bases
export const P: Projection = fitProjection(
  [
    ...boxCorners(POWER_BASE_PLAN, POWER_BASE_Z0, POWER_BASE_TOP + 50),
    ...boxCorners(EDGE_BASE_PLAN, EDGE_BASE_Z0, EDGE_BASE_TOP + 45),
    [-220, -250, MAST_TOP_Z + 10],
    ...boxCorners(IOC_BASE_PLAN, IOC_BASE_Z0, IOC_ROOF_Z + 35),
    ...boxCorners(WATER_BASE_PLAN, WATER_BASE_Z0, WATER_BASE_TOP + WATER_TANK_HEIGHT + 15),
    ...boxCorners(HOSP_BASE_PLAN, HOSP_BASE_Z0, HOSP_ROOF_Z + 15),
    ...boxCorners(TRANSIT_BASE_PLAN, TRANSIT_BASE_Z0, TRANSIT_BASE_TOP + 40),
  ],
  WIDTH,
  HEIGHT,
  { pad: PAD, azimuth: AZIMUTH, elevation: ELEVATION }
);

export const at = (point: Point3): Flat => iso(point, P);

const ORIGIN = at([0, 0, 0]);
const minus = (a: Flat, b: Flat): Flat => [a[0] - b[0], a[1] - b[1]];
export const EX = minus(at([1, 0, 0]), ORIGIN);
export const EY = minus(at([0, 1, 0]), ORIGIN);
export const EZ = minus(at([0, 0, 1]), ORIGIN);

const fine = (v: number) => Math.round(v * 100) / 100;
export const shift = (x: number, y = 0, z = 0) =>
  `translate(${fine(EX[0] * x + EY[0] * y + EZ[0] * z)} ${fine(EX[1] * x + EY[1] * y + EZ[1] * z)})`;
