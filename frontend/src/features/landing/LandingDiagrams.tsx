import type { ReactNode } from 'react'

/**
 * Three blueprint-style diagrams for the intro, drawn in the app's lime
 * shades only. They illustrate real project concepts (two separate graphs,
 * the CVE-to-risk funnel, conditional cascade with backups) and are
 * conceptual figures: no telemetry, no live data.
 */

const A = 'var(--accent)'
const LINE = 'rgb(204 255 0 / 0.55)'
const FAINT = 'rgb(204 255 0 / 0.18)'
const PLATE = 'rgb(204 255 0 / 0.06)'
const FACE_L = '#1b2606'
const FACE_R = '#27350a'
const FACE_T = '#3a4d0e'

function Figure({ label, fig, children }: { label: string; fig: string; children: ReactNode }) {
  return (
    <figure className="landing-diagram" aria-label={label}>
      <svg viewBox="0 0 580 390" role="img">
        <title>{label}</title>
        <text x="16" y="22" className="ld-meta">
          {fig}
        </text>
        <text x="564" y="22" textAnchor="end" className="ld-meta">
          CONCEPTUAL · NO TELEMETRY
        </text>
        {children}
      </svg>
    </figure>
  )
}

/* ---------- 1. Two graphs, one set of assets ---------- */

const S = 40
const iso = (gx: number, gy: number, oy: number): [number, number] => [
  250 + (gx - gy) * S * 0.866,
  oy + (gx + gy) * S * 0.5,
]
const NODES = [
  { id: 'Remote', gx: 0.4, gy: 1.7 },
  { id: 'Control', gx: 1.4, gy: 0.7 },
  { id: 'Substation', gx: 2.8, gy: 0.6 },
  { id: 'Pump', gx: 2.8, gy: 2.5 },
  { id: 'Hospital', gx: 1.4, gy: 2.8 },
]
const CYBER: [number, number][] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [0, 4],
  [1, 4],
]
const OPERATIONAL: [number, number][] = [
  [2, 3],
  [2, 4],
  [3, 4],
]
const EDGE = 3.4

function Plane({
  oy,
  edges,
  dashed,
  title,
}: {
  oy: number
  edges: [number, number][]
  dashed: boolean
  title: string
}) {
  const corners = [iso(0, 0, oy), iso(EDGE, 0, oy), iso(EDGE, EDGE, oy), iso(0, EDGE, oy)]
  const pts = NODES.map((n) => iso(n.gx, n.gy, oy))
  return (
    <g>
      <polygon
        points={corners.map((c) => c.join(',')).join(' ')}
        fill={PLATE}
        stroke={FAINT}
        strokeWidth="1"
      />
      {[1, 2, 3].map((i) => (
        <g key={i} stroke={FAINT} strokeWidth="0.6">
          <line
            x1={iso(i, 0, oy)[0]}
            y1={iso(i, 0, oy)[1]}
            x2={iso(i, EDGE, oy)[0]}
            y2={iso(i, EDGE, oy)[1]}
          />
          <line
            x1={iso(0, i, oy)[0]}
            y1={iso(0, i, oy)[1]}
            x2={iso(EDGE, i, oy)[0]}
            y2={iso(EDGE, i, oy)[1]}
          />
        </g>
      ))}
      {edges.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={pts[a][0]}
          y1={pts[a][1]}
          x2={pts[b][0]}
          y2={pts[b][1]}
          stroke={dashed ? LINE : A}
          strokeWidth={dashed ? 1.4 : 2}
          strokeDasharray={dashed ? '5 5' : undefined}
          markerEnd={dashed ? undefined : 'url(#ld-arrow)'}
        />
      ))}
      {pts.map(([x, y], i) => (
        <g key={NODES[i].id}>
          <ellipse cx={x} cy={y} rx="11" ry="6" fill="#0d1204" stroke={LINE} />
          <ellipse cx={x} cy={y - 6} rx="11" ry="6" fill={FACE_T} stroke={A} strokeWidth="1.2" />
          <text x={x} y={y + 20} textAnchor="middle" className="ld-label">
            {NODES[i].id.toUpperCase()}
          </text>
        </g>
      ))}
      <text x="432" y={oy + 70} className="ld-caption">
        {title}
      </text>
    </g>
  )
}

export function TwoGraphsDiagram() {
  const top = NODES.map((n) => iso(n.gx, n.gy, 30))
  const bottom = NODES.map((n) => iso(n.gx, n.gy, 214))
  return (
    <Figure label="Two separate graphs over the same five assets" fig="FIG. 01 · TWO GRAPHS">
      <defs>
        <marker
          id="ld-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 Z" fill={A} />
        </marker>
      </defs>
      <Plane oy={214} edges={OPERATIONAL} dashed={false} title="OPERATIONAL DEPENDENCIES" />
      {top.map(([x, y], i) => (
        <line
          key={i}
          x1={x}
          y1={y}
          x2={bottom[i][0]}
          y2={bottom[i][1]}
          stroke={FAINT}
          strokeWidth="1"
          strokeDasharray="2 5"
        />
      ))}
      <Plane oy={30} edges={CYBER} dashed title="CYBER ACCESS PATHS" />
    </Figure>
  )
}

/* ---------- 2. Evidence -> model -> ranking ---------- */

const SOURCES = [
  { y: 112, label: 'NVD · CVE' },
  { y: 192, label: 'CISA · KEV' },
  { y: 272, label: 'FIRST · EPSS' },
]
const RANKED = [
  { y: 124, w: 150, o: 1, label: '#1 · HLT-001' },
  { y: 168, w: 118, o: 0.7, label: '#2 · PWR-001' },
  { y: 212, w: 86, o: 0.5, label: '#3 · WTR-001' },
  { y: 256, w: 54, o: 0.32, label: '#4 · …' },
]

function Slab({ cx, cy }: { cx: number; cy: number }) {
  const w = 38
  const h = 19
  return (
    <g>
      <polygon
        points={`${cx - w},${cy} ${cx},${cy + h} ${cx},${cy + h + 9} ${cx - w},${cy + 9}`}
        fill={FACE_L}
        stroke={LINE}
      />
      <polygon
        points={`${cx + w},${cy} ${cx},${cy + h} ${cx},${cy + h + 9} ${cx + w},${cy + 9}`}
        fill={FACE_R}
        stroke={LINE}
      />
      <polygon
        points={`${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}`}
        fill={FACE_T}
        stroke={A}
        strokeWidth="1.2"
      />
    </g>
  )
}

export function SignalDiagram() {
  const cx = 78
  const coreX = 292
  const coreY = 226
  return (
    <Figure
      label="Three real data sources feed an ML model that outputs a ranked list of assets"
      fig="FIG. 02 · SIGNAL"
    >
      <defs>
        <marker
          id="ld-arrow3"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 Z" fill={A} />
        </marker>
      </defs>
      {SOURCES.map((src) => (
        <g key={src.label}>
          <path
            d={`M${cx + 40},${src.y + 6} C${cx + 130},${src.y + 6} ${coreX - 90},${coreY - 40} ${coreX - 40},${coreY - 34}`}
            fill="none"
            stroke={LINE}
            strokeWidth="1.4"
            strokeDasharray="5 5"
          />
          <Slab cx={cx} cy={src.y} />
          <text x={cx} y={src.y + 40} textAnchor="middle" className="ld-label ld-label-strong">
            {src.label}
          </text>
        </g>
      ))}
      <ellipse
        cx={coreX}
        cy={coreY + 3}
        rx="68"
        ry="26"
        fill="none"
        stroke={A}
        strokeOpacity="0.45"
        strokeDasharray="3 4"
      />
      <Cube cx={coreX} cy={coreY} s={46} tone="origin" />
      <text x={coreX} y={coreY + 46} textAnchor="middle" className="ld-label ld-label-strong">
        ML MODEL
      </text>
      <text x={coreX} y={coreY + 60} textAnchor="middle" className="ld-label">
        KEV-SIGNAL-V1
      </text>
      <path
        d={`M${coreX + 52},${coreY - 50} C${coreX + 90},${coreY - 70} ${coreX + 100},${coreY - 90} 384,${RANKED[0].y + 7}`}
        fill="none"
        stroke={A}
        strokeWidth="2"
        markerEnd="url(#ld-arrow3)"
      />
      {RANKED.map((r) => (
        <g key={r.label}>
          <text x="398" y={r.y - 6} className="ld-label ld-label-strong">
            {r.label}
          </text>
          <rect x="398" y={r.y} width={r.w} height="14" rx="3" fill={A} opacity={r.o} />
        </g>
      ))}
      <text x="398" y="296" className="ld-caption">
        RANKED BY RISK
      </text>
      {[
        { x: cx, t: 'EVIDENCE' },
        { x: coreX, t: 'MODEL' },
        { x: 474, t: 'RANKING' },
      ].map((c) => (
        <g key={c.t}>
          <line x1={c.x - 44} y1="346" x2={c.x + 44} y2="346" stroke={FAINT} />
          <text x={c.x} y="364" textAnchor="middle" className="ld-label">
            {c.t}
          </text>
        </g>
      ))}
    </Figure>
  )
}

/* ---------- 3. Conditional cascade with a backup that only covers power ---------- */

function Cube({
  cx,
  cy,
  s,
  tone,
}: {
  cx: number
  cy: number
  s: number
  tone: 'origin' | 'dependent' | 'backup'
}) {
  const a = s * 0.866
  const b = s * 0.5
  const h = s * 0.9
  const hot = tone === 'origin'
  const dim = tone === 'dependent'
  return (
    <g opacity={dim ? 0.82 : 1}>
      <polygon
        points={`${cx},${cy} ${cx - a},${cy - b} ${cx - a},${cy - b - h} ${cx},${cy - h}`}
        fill={FACE_L}
        stroke={LINE}
      />
      <polygon
        points={`${cx},${cy} ${cx + a},${cy - b} ${cx + a},${cy - b - h} ${cx},${cy - h}`}
        fill={FACE_R}
        stroke={LINE}
      />
      <polygon
        points={`${cx},${cy - h} ${cx - a},${cy - b - h} ${cx},${cy - 2 * b - h} ${cx + a},${cy - b - h}`}
        fill={hot ? A : FACE_T}
        fillOpacity={hot ? 0.9 : 1}
        stroke={A}
        strokeWidth="1.2"
        strokeDasharray={dim ? '4 3' : undefined}
      />
    </g>
  )
}

export function CascadeDiagram() {
  const xs = [140, 290, 440]
  const cy = 218
  const flowY = cy - 62
  return (
    <Figure
      label="Cascade from a compromised substation to a pump station and a hospital, with a backup that covers power only"
      fig="FIG. 03 · CASCADE"
    >
      <defs>
        <marker
          id="ld-arrow2"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 Z" fill={A} />
        </marker>
      </defs>
      <ellipse
        cx={xs[0]}
        cy={cy + 2}
        rx="62"
        ry="24"
        fill="none"
        stroke={A}
        strokeOpacity="0.5"
        strokeDasharray="3 4"
      />
      <path
        d={`M${xs[0] + 48},${flowY} Q${(xs[0] + xs[1]) / 2},${flowY - 34} ${xs[1] - 48},${flowY}`}
        fill="none"
        stroke={A}
        strokeWidth="2"
        markerEnd="url(#ld-arrow2)"
      />
      <path
        d={`M${xs[1] + 48},${flowY} Q${(xs[1] + xs[2]) / 2},${flowY - 34} ${xs[2] - 48},${flowY}`}
        fill="none"
        stroke={LINE}
        strokeWidth="1.6"
        strokeDasharray="6 5"
        markerEnd="url(#ld-arrow2)"
      />
      <text x={(xs[0] + xs[1]) / 2} y={flowY - 36} textAnchor="middle" className="ld-label">
        POWER FEED
      </text>
      <text x={(xs[1] + xs[2]) / 2} y={flowY - 36} textAnchor="middle" className="ld-label">
        WATER SUPPLY
      </text>
      <Cube cx={xs[0]} cy={cy} s={46} tone="origin" />
      <Cube cx={xs[1]} cy={cy} s={46} tone="dependent" />
      <Cube cx={xs[2]} cy={cy} s={46} tone="dependent" />
      <text x={xs[0]} y={cy + 40} textAnchor="middle" className="ld-label ld-label-strong">
        SUBSTATION
      </text>
      <text x={xs[0]} y={cy + 54} textAnchor="middle" className="ld-label">
        ASSUMED COMPROMISED
      </text>
      <text x={xs[1]} y={cy + 40} textAnchor="middle" className="ld-label ld-label-strong">
        PUMP STATION
      </text>
      <text x={xs[1]} y={cy + 54} textAnchor="middle" className="ld-label">
        LOSES POWER
      </text>
      <text x={xs[2]} y={cy + 40} textAnchor="middle" className="ld-label ld-label-strong">
        HOSPITAL
      </text>
      <text x={xs[2]} y={cy + 54} textAnchor="middle" className="ld-label">
        NEEDS WATER + POWER
      </text>
      <line x1={xs[2]} y1={cy + 62} x2={xs[2]} y2={334} stroke={LINE} strokeDasharray="3 4" />
      <Cube cx={xs[2]} cy={354} s={20} tone="backup" />
      <text x={xs[2] - 36} y={350} textAnchor="end" className="ld-label">
        BACKUP COVERS
      </text>
      <text x={xs[2] - 36} y={363} textAnchor="end" className="ld-label">
        POWER ONLY
      </text>
      {[
        { x: 64, w: 150, o: 1 },
        { x: 116, w: 120, o: 0.6 },
        { x: 168, w: 90, o: 0.35 },
      ].map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={322 + i * 11}
          width={bar.w}
          height="5"
          rx="2.5"
          fill={A}
          opacity={bar.o}
        />
      ))}
      <text x="64" y="316" className="ld-label">
        DELAY → DURATION
      </text>
    </Figure>
  )
}
