import {
  fitProjection,
  iso,
  type Flat,
  type Plan,
  type Point3,
  type Projection,
} from '../iso/iso-kit'

export const WIDTH = 920
export const HEIGHT = 580
const PAD = 28
export const AZIMUTH = 48
export const ELEVATION = 30

// Foundation and yard boundaries
export const YARD_PLAN: Plan = { x: -225, y: -135, w: 450, d: 270, r: 12 }
export const PAD_PLAN: Plan = { x: -195, y: -115, w: 390, d: 230, r: 8 }

// Plinths
export const TR_PLINTH: Plan = { x: -150, y: -45, w: 125, d: 95, r: 4 }
export const CB_PLINTH: Plan = { x: 30, y: -75, w: 75, d: 55, r: 3 }
export const DS_PLINTH: Plan = { x: 130, y: -75, w: 60, d: 55, r: 3 }
export const LA_PLINTH: Plan = { x: 30, y: 15, w: 60, d: 45, r: 3 }
export const CP_PLINTH: Plan = { x: -125, y: 70, w: 80, d: 48, r: 3 }

// Transformer dimensions
export const TANK_PLAN: Plan = { x: -135, y: -35, w: 85, d: 68, r: 6 }
export const TANK_Z = 8
export const TANK_H = 62
export const TANK_TOP = TANK_Z + TANK_H

// Gantry structural coordinates
export const GANTRY_Z = 8
export const GANTRY_TOP = 142
export const GANTRY_BUSBAR_Z = 120

// Corners helper for bounding box fit
const boxCorners = ({ x, y, w, d }: Plan, z0: number, z1: number): Point3[] => {
  const pts: Point3[] = []
  for (const px of [x, x + w]) {
    for (const py of [y, y + d]) {
      for (const pz of [z0, z1]) {
        pts.push([px, py, pz])
      }
    }
  }
  return pts
}

// Projection fit calculation
export const P: Projection = fitProjection(
  [
    ...boxCorners(YARD_PLAN, -12, 0),
    ...boxCorners(PAD_PLAN, -4, 8),
    ...boxCorners(TANK_PLAN, TANK_Z, TANK_TOP + 35),
    [-170, -35, GANTRY_TOP + 10],
    [170, -35, GANTRY_TOP + 10],
    [170, 75, GANTRY_TOP + 10],
    [-170, 75, GANTRY_TOP + 10],
    [DS_PLINTH.x + DS_PLINTH.w, DS_PLINTH.y + DS_PLINTH.d, 90],
    [CP_PLINTH.x, CP_PLINTH.y + CP_PLINTH.d, 70],
  ],
  WIDTH,
  HEIGHT,
  { pad: PAD, azimuth: AZIMUTH, elevation: ELEVATION },
)

export const at = (point: Point3): Flat => iso(point, P)

const ORIGIN = at([0, 0, 0])
const minus = (a: Flat, b: Flat): Flat => [a[0] - b[0], a[1] - b[1]]
export const EX = minus(at([1, 0, 0]), ORIGIN)
export const EY = minus(at([0, 1, 0]), ORIGIN)
export const EZ = minus(at([0, 0, 1]), ORIGIN)

const fine = (v: number) => Math.round(v * 100) / 100
export const shift = (x: number, y = 0, z = 0) =>
  `translate(${fine(EX[0] * x + EY[0] * y + EZ[0] * z)} ${fine(EX[1] * x + EY[1] * y + EZ[1] * z)})`
