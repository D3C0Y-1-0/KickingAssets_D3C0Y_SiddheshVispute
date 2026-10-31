/** Scene map, camera path and scroll maths for the GRIDINAL experience. Pure; no DOM, no WebGL. */

export type Vec3 = [number, number, number]

export type SceneId = 'awakens' | 'infrastructure' | 'threat' | 'intelligence' | 'command'

export type SceneInfo = {
  id: SceneId
  number: number
  title: string
  /** Scroll progress (0..1) at which the scene is fully in view; null while the scene is not built. */
  at: number | null
  ready: boolean
}

export const SCENES: SceneInfo[] = [
  { id: 'awakens', number: 1, title: 'GRIDINAL awakens', at: 0, ready: true },
  { id: 'infrastructure', number: 2, title: 'Enter the infrastructure', at: 0.62, ready: true },
  { id: 'threat', number: 3, title: 'Threat emergence', at: null, ready: false },
  { id: 'intelligence', number: 4, title: 'GRIDINAL intelligence', at: null, ready: false },
  { id: 'command', number: 5, title: 'Command center', at: null, ready: false },
]

/** Progress at which scene 2 takes over from scene 1 (camera is mid-approach). */
export const SCENE_2_START = 0.4

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
/** Frame-rate independent exponential smoothing toward a target. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

export function sceneAt(progress: number): SceneInfo {
  return progress < SCENE_2_START ? SCENES[0] : SCENES[1]
}

/** Where the substation sits in the 3D world. The camera path ends here. */
export const SUBSTATION_POS: Vec3 = [-12, 0, 2]

type Key = { p: number; pos: Vec3; look: Vec3 }

const KEYS: Key[] = [
  { p: 0, pos: [3, 10, 66], look: [-26, -1, -8] },
  { p: 0.2, pos: [1, 8, 48], look: [-18, 2, -2] },
  { p: 0.42, pos: [-5, 5.5, 27], look: [-11, 2.5, 3] },
  { p: 0.7, pos: [1.5, 5.2, 20], look: [-9.5, 1.8, 2.4] },
  { p: 1, pos: [4.5, 4.8, 17.5], look: [-8.2, 1.6, 2.2] },
]

/** Cubic Hermite through the keys with finite-difference tangents: continuous velocity, no stops. */
function hermite(values: number[], ps: number[], p: number): number {
  const n = ps.length
  let i = 0
  while (i < n - 2 && p > ps[i + 1]) i++
  const p0 = ps[i]
  const p1 = ps[i + 1]
  const h = p1 - p0
  const t = clamp((p - p0) / h)
  const tangent = (k: number) => {
    if (k === 0) return (values[1] - values[0]) / (ps[1] - ps[0])
    if (k === n - 1) return (values[n - 1] - values[n - 2]) / (ps[n - 1] - ps[n - 2])
    return (values[k + 1] - values[k - 1]) / (ps[k + 1] - ps[k - 1])
  }
  const t2 = t * t
  const t3 = t2 * t
  return (
    (2 * t3 - 3 * t2 + 1) * values[i] +
    (t3 - 2 * t2 + t) * h * tangent(i) +
    (-2 * t3 + 3 * t2) * values[i + 1] +
    (t3 - t2) * h * tangent(i + 1)
  )
}

const KEY_P = KEYS.map((k) => k.p)
const channel = (pick: (k: Key) => number) => KEYS.map(pick)
const CH = {
  px: channel((k) => k.pos[0]),
  py: channel((k) => k.pos[1]),
  pz: channel((k) => k.pos[2]),
  lx: channel((k) => k.look[0]),
  ly: channel((k) => k.look[1]),
  lz: channel((k) => k.look[2]),
}

export function cameraAt(progress: number): { pos: Vec3; look: Vec3 } {
  const p = clamp(progress)
  return {
    pos: [hermite(CH.px, KEY_P, p), hermite(CH.py, KEY_P, p), hermite(CH.pz, KEY_P, p)],
    look: [hermite(CH.lx, KEY_P, p), hermite(CH.ly, KEY_P, p), hermite(CH.lz, KEY_P, p)],
  }
}

export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Progress needed to scroll a track of `trackHeight` px in a viewport of `viewport` px to a target. */
export function scrollTopFor(trackTop: number, trackHeight: number, viewport: number, p: number) {
  return trackTop + clamp(p) * Math.max(0, trackHeight - viewport)
}

/** How visible each layer is at a given progress. Shared by the 3D scene and the HTML overlays. */
export function layers(progress: number) {
  return {
    hero: 1 - smoothstep(0.1, 0.3, progress),
    network: 1 - smoothstep(0.42, 0.7, progress) * 0.88,
    substation: smoothstep(0.34, 0.6, progress),
    markers: smoothstep(0.58, 0.74, progress),
    flows: smoothstep(0.64, 0.8, progress),
    sceneTwoTitle: smoothstep(0.46, 0.58, progress),
  }
}
