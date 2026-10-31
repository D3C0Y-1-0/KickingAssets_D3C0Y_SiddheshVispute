import { SUBSTATION_POS, type Vec3 } from './scenes'

export type WorldNode = {
  pos: Vec3
  /** 0..1: when this node lights up during the opening, spreading outward from the substation. */
  delay: number
  kind: 'substation' | 'power' | 'data'
}
export type WorldEdge = { a: number; b: number; delay: number }

/** Small deterministic PRNG so the world is identical on every load. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * An illustrative network around the substation. It is a visual device for the opening: positions are
 * generated, not read from the scenario. The real scenario graph is shown in the command center.
 */
export function buildWorld(count = 64, seed = 7): { nodes: WorldNode[]; edges: WorldEdge[] } {
  const rand = mulberry32(seed)
  const raw: { pos: Vec3; kind: WorldNode['kind'] }[] = [
    { pos: SUBSTATION_POS, kind: 'substation' },
  ]
  for (let i = 1; i < count; i++) {
    const angle = rand() * Math.PI * 2
    const radius = 8 + Math.sqrt(rand()) * 46
    raw.push({
      pos: [
        SUBSTATION_POS[0] + Math.cos(angle) * radius * 1.25,
        0.6 + rand() * 13,
        SUBSTATION_POS[2] + Math.sin(angle) * radius * 0.8 - 14,
      ],
      kind: rand() < 0.28 ? 'power' : 'data',
    })
  }
  const hub = raw[0].pos
  const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const order = raw.map((_, i) => i).sort((i, j) => dist(raw[i].pos, hub) - dist(raw[j].pos, hub))
  const rank = new Array<number>(count)
  order.forEach((nodeIndex, r) => (rank[nodeIndex] = r / (count - 1)))
  const nodes: WorldNode[] = raw.map((n, i) => ({ ...n, delay: rank[i] * 0.85 }))

  const seen = new Set<string>()
  const edges: WorldEdge[] = []
  const add = (a: number, b: number) => {
    if (a === b) return
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ a, b, delay: Math.max(nodes[a].delay, nodes[b].delay) })
  }
  for (let i = 0; i < count; i++) {
    const nearest = raw
      .map((n, j) => ({ j, d: i === j ? Infinity : dist(raw[i].pos, n.pos) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, i === 0 ? 7 : 2)
    nearest.forEach(({ j }) => add(i, j))
  }
  return { nodes, edges }
}
