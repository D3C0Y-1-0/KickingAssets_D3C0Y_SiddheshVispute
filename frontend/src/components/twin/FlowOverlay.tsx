import type { PartLink } from '../../hooks/twinConnections'

export type LinkMode = 'operational' | 'cyber' | 'off'

interface FlowOverlayProps {
  width: number
  height: number
  /** Pin position of every part in this diagram, in diagram pixels. */
  points: Record<string, [number, number]>
  links: PartLink[]
  mode: LinkMode
  /** The selected or hovered part; its links are emphasised, the rest recede. */
  focusId: string | null
}

/**
 * Draws part-to-part connections over a twin. Operational dependencies are dashed
 * provider → dependent arrows; cyber reachability is solid. They are never merged.
 */
export function FlowOverlay({ width, height, points, links, mode, focusId }: FlowOverlayProps) {
  if (mode === 'off') return null
  const visible = links.filter((l) => l.kind === mode && points[l.from] && points[l.to])
  if (!visible.length) return null

  return (
    <svg
      className="flow-overlay"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <defs>
        {(['op', 'cy'] as const).map((k) => (
          <marker
            key={k}
            id={`flow-arrow-${k}`}
            viewBox="0 -5 10 10"
            refX="9"
            refY="0"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,-4L9,0L0,4Z" className={`flow-arrow ${k}`} />
          </marker>
        ))}
      </defs>
      {visible.map((l) => {
        const [x1, y1] = points[l.from]
        const [x2, y2] = points[l.to]
        const dx = x2 - x1
        const dy = y2 - y1
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        // stop short of the pins so the arrowhead is readable
        const sx = x1 + ux * 12
        const sy = y1 + uy * 12
        const ex = x2 - ux * 14
        const ey = y2 - uy * 14
        const bend = Math.min(60, len * 0.18)
        const mx = (sx + ex) / 2 - uy * bend
        const my = (sy + ey) / 2 + ux * bend
        const hot = !!focusId && (l.from === focusId || l.to === focusId)
        const dim = !!focusId && !hot
        const k = l.kind === 'operational' ? 'op' : 'cy'
        return (
          <g key={l.id} className={`flow-link ${k}${hot ? ' hot' : ''}${dim ? ' dim' : ''}`}>
            <path className="flow-hit" d={`M${sx},${sy}Q${mx},${my} ${ex},${ey}`} />
            <path
              className="flow-line"
              d={`M${sx},${sy}Q${mx},${my} ${ex},${ey}`}
              markerEnd={`url(#flow-arrow-${k})`}
            />
            {hot && (
              <text className="flow-label" x={mx} y={my - 6} textAnchor="middle">
                {l.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
