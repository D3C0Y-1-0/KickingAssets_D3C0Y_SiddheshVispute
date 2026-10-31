import {
  fitProjection,
  iso,
  type Flat,
  type Plan,
  type Point3,
  type Projection,
} from '../iso/iso-kit'

export const WIDTH = 1200
export const HEIGHT = 780
const PAD = 42
export const AZIMUTH = 45
export const ELEVATION = 30

// Main Foundation Platform
export const WATER_SITE_PLAN: Plan = { x: -280, y: -220, w: 560, d: 440, r: 12 }
export const WATER_SITE_Z0 = -8
export const WATER_SITE_H = 12
export const WATER_SITE_TOP = WATER_SITE_Z0 + WATER_SITE_H

// Helper to compute bounding corners for projection fit
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

// Optimal isometric projection tightly framing the water treatment works
export const P: Projection = fitProjection(
  [...boxCorners(WATER_SITE_PLAN, WATER_SITE_Z0, WATER_SITE_TOP + 120), [0, 0, 140]],
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
