import {
  cylinder,
  insetPlan,
  planOutline,
  segment,
  slabOf,
} from "../iso/iso-kit";
import {
  P,
  TRANSIT_SITE_PLAN,
  TRANSIT_SITE_Z0,
  TRANSIT_SITE_H,
  TRANSIT_SITE_TOP,
} from "./view";

// -------------------------------------------------------------
// 1. SITE FOUNDATION & PASSENGER PLAZA
// -------------------------------------------------------------
export const SITE_ART = {
  slab: slabOf(TRANSIT_SITE_PLAN, TRANSIT_SITE_Z0, TRANSIT_SITE_H, P, 8, 1.5),
  curbs: planOutline(insetPlan(TRANSIT_SITE_PLAN, 4), TRANSIT_SITE_TOP + 0.2, P),
  plazaStripes: [
    segment([-220, -180, TRANSIT_SITE_TOP + 0.2], [-80, -180, TRANSIT_SITE_TOP + 0.2], P),
    segment([-220, -160, TRANSIT_SITE_TOP + 0.2], [-80, -160, TRANSIT_SITE_TOP + 0.2], P),
    segment([-220, -140, TRANSIT_SITE_TOP + 0.2], [-80, -140, TRANSIT_SITE_TOP + 0.2], P),
  ].join(""),
};

// -------------------------------------------------------------
// 2. PASSENGER TERMINAL CONCOURSE BUILDING
// -------------------------------------------------------------
export const TERMINAL_ART = {
  // Main Terminal Hall
  podium: slabOf({ x: -160, y: -120, w: 140, d: 90, r: 6 }, TRANSIT_SITE_TOP, 16, P, 4, 1.2),
  hall: slabOf({ x: -145, y: -105, w: 110, d: 65, r: 4 }, TRANSIT_SITE_TOP + 16, 26, P, 3, 1.0),
  canopyRoof: slabOf({ x: -155, y: -115, w: 130, d: 85, r: 6 }, TRANSIT_SITE_TOP + 42, 6, P, 4, 1.4),
  skylightLines: [
    segment([-140, -100, TRANSIT_SITE_TOP + 48], [-35, -100, TRANSIT_SITE_TOP + 48], P),
    segment([-140, -75, TRANSIT_SITE_TOP + 48], [-35, -75, TRANSIT_SITE_TOP + 48], P),
    segment([-140, -50, TRANSIT_SITE_TOP + 48], [-35, -50, TRANSIT_SITE_TOP + 48], P),
  ].join(""),
  // Entrance Portico Columns
  columns: [
    cylinder(-150, -32, 2.5, TRANSIT_SITE_TOP, 16, P, 8),
    cylinder(-120, -32, 2.5, TRANSIT_SITE_TOP, 16, P, 8),
    cylinder(-90, -32, 2.5, TRANSIT_SITE_TOP, 16, P, 8),
    cylinder(-60, -32, 2.5, TRANSIT_SITE_TOP, 16, P, 8),
  ],
};

// -------------------------------------------------------------
// 3. ELEVATED SKY-TRAIN RAIL VIADUCT
// -------------------------------------------------------------
export const VIADUCT_Z = TRANSIT_SITE_TOP + 48;

export const VIADUCT_ART = {
  // Concrete Bridge Piers
  piers: [
    slabOf({ x: -240, y: 35, w: 14, d: 24, r: 2 }, TRANSIT_SITE_TOP, 48, P),
    slabOf({ x: -120, y: 35, w: 14, d: 24, r: 2 }, TRANSIT_SITE_TOP, 48, P),
    slabOf({ x: 0, y: 35, w: 14, d: 24, r: 2 }, TRANSIT_SITE_TOP, 48, P),
    slabOf({ x: 120, y: 35, w: 14, d: 24, r: 2 }, TRANSIT_SITE_TOP, 48, P),
    slabOf({ x: 230, y: 35, w: 14, d: 24, r: 2 }, TRANSIT_SITE_TOP, 48, P),
  ],
  // Continuous Viaduct Guideway Beam
  beam: slabOf({ x: -260, y: 32, w: 510, d: 30, r: 3 }, VIADUCT_Z, 8, P, 4, 1.2),
  // Dual Steel Running Rails
  rails: [
    segment([-260, 38, VIADUCT_Z + 8.2], [250, 38, VIADUCT_Z + 8.2], P),
    segment([-260, 44, VIADUCT_Z + 8.2], [250, 44, VIADUCT_Z + 8.2], P),
    segment([-260, 50, VIADUCT_Z + 8.2], [250, 50, VIADUCT_Z + 8.2], P),
    segment([-260, 56, VIADUCT_Z + 8.2], [250, 56, VIADUCT_Z + 8.2], P),
  ].join(""),
  // Overhead Catenary Electrification Masts
  catenaryMasts: [
    segment([-180, 28, VIADUCT_Z + 8], [-180, 28, VIADUCT_Z + 32], P),
    segment([-180, 28, VIADUCT_Z + 32], [-180, 58, VIADUCT_Z + 32], P),
    segment([60, 28, VIADUCT_Z + 8], [60, 28, VIADUCT_Z + 32], P),
    segment([60, 28, VIADUCT_Z + 32], [60, 58, VIADUCT_Z + 32], P),
  ].join(""),
};

// -------------------------------------------------------------
// 4. 2-CAR DRIVERLESS SKY-TRAIN TRAINSET
// -------------------------------------------------------------
const TRAIN_Z = VIADUCT_Z + 9;

export const TRAIN_ART = {
  // Lead Car
  leadCar: slabOf({ x: -90, y: 40, w: 75, d: 18, r: 3 }, TRAIN_Z, 20, P, 3, 1.0),
  // Trail Car
  trailCar: slabOf({ x: -170, y: 40, w: 72, d: 18, r: 3 }, TRAIN_Z, 20, P, 3, 1.0),
  // Coupling Gangway Accordion
  gangway: slabOf({ x: -96, y: 42, w: 7, d: 14, r: 1 }, TRAIN_Z + 2, 16, P),
  // Windows & Aerodynamic Nose Detailing
  windows: [
    segment([-85, 58.1, TRAIN_Z + 8], [-20, 58.1, TRAIN_Z + 8], P),
    segment([-85, 58.1, TRAIN_Z + 14], [-20, 58.1, TRAIN_Z + 14], P),
    segment([-165, 58.1, TRAIN_Z + 8], [-102, 58.1, TRAIN_Z + 8], P),
    segment([-165, 58.1, TRAIN_Z + 14], [-102, 58.1, TRAIN_Z + 14], P),
  ].join(""),
  // Rooftop High-Speed Pantograph
  pantograph: [
    segment([-50, 49, TRAIN_Z + 20], [-50, 49, TRAIN_Z + 28], P),
    segment([-50, 49, TRAIN_Z + 28], [-42, 49, TRAIN_Z + 30], P),
  ].join(""),
};

// -------------------------------------------------------------
// 5. AUTONOMOUS ELECTRIC TRANSIT BUSES & EV CHARGING BAY
// -------------------------------------------------------------
export const EV_DEPOT_ART = {
  // Terminal Bus Platform Slab
  platform: slabOf({ x: -220, y: 110, w: 200, d: 90, r: 4 }, TRANSIT_SITE_TOP, 4, P),
  platformStallLines: [
    segment([-200, 115, TRANSIT_SITE_TOP + 4.2], [-140, 115, TRANSIT_SITE_TOP + 4.2], P),
    segment([-120, 115, TRANSIT_SITE_TOP + 4.2], [-60, 115, TRANSIT_SITE_TOP + 4.2], P),
  ].join(""),

  // Electric Bus 1 (Docked)
  bus1: slabOf({ x: -195, y: 125, w: 55, d: 24, r: 3 }, TRANSIT_SITE_TOP + 4, 18, P, 3, 1.0),
  bus1Windows: [
    segment([-190, 149.1, TRANSIT_SITE_TOP + 12], [-145, 149.1, TRANSIT_SITE_TOP + 12], P),
    segment([-190, 149.1, TRANSIT_SITE_TOP + 17], [-145, 149.1, TRANSIT_SITE_TOP + 17], P),
  ].join(""),

  // Electric Bus 2 (Charging)
  bus2: slabOf({ x: -115, y: 125, w: 55, d: 24, r: 3 }, TRANSIT_SITE_TOP + 4, 18, P, 3, 1.0),
  bus2Windows: [
    segment([-110, 149.1, TRANSIT_SITE_TOP + 12], [-65, 149.1, TRANSIT_SITE_TOP + 12], P),
    segment([-110, 149.1, TRANSIT_SITE_TOP + 17], [-65, 149.1, TRANSIT_SITE_TOP + 17], P),
  ].join(""),

  // Overhead Fast-Charging Pantograph Gantries
  chargers: [
    slabOf({ x: -175, y: 155, w: 8, d: 8, r: 1 }, TRANSIT_SITE_TOP + 4, 26, P),
    slabOf({ x: -95, y: 155, w: 8, d: 8, r: 1 }, TRANSIT_SITE_TOP + 4, 26, P),
  ],
  chargerArms: [
    segment([-171, 155, TRANSIT_SITE_TOP + 30], [-171, 140, TRANSIT_SITE_TOP + 30], P),
    segment([-91, 155, TRANSIT_SITE_TOP + 30], [-91, 140, TRANSIT_SITE_TOP + 30], P),
  ].join(""),
};

// -------------------------------------------------------------
// 6. SCADA RAILWAY SIGNALING & DISPATCH TOWER
// -------------------------------------------------------------
export const DISPATCH_TOWER_ART = {
  plinth: slabOf({ x: 120, y: -140, w: 70, d: 70, r: 4 }, TRANSIT_SITE_TOP, 8, P),
  tower: slabOf({ x: 135, y: -125, w: 40, d: 40, r: 2 }, TRANSIT_SITE_TOP + 8, 52, P, 3, 1.0),
  cab: slabOf({ x: 130, y: -130, w: 50, d: 50, r: 4 }, TRANSIT_SITE_TOP + 60, 18, P, 3, 1.4),
  antenna: segment([155, -105, TRANSIT_SITE_TOP + 78], [155, -105, TRANSIT_SITE_TOP + 110], P),
};
