/**
 * Semicircular gauge of the city risk index (0-100), lime gradient on dark.
 * A relative index, not a probability — the label below the number says so.
 */
export function RiskArcGauge({
  value,
  category,
}: {
  value: number | null
  category: 'low' | 'medium' | 'high' | 'critical' | null
}) {
  const segments = 12
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100
  const filled = Math.round(pct * segments)
  const radius = 64
  const cx = 90
  const cy = 86

  const bars = Array.from({ length: segments }, (_, i) => {
    const angle = Math.PI - (i / (segments - 1)) * Math.PI
    const x1 = cx + Math.cos(angle) * (radius - 10)
    const y1 = cy - Math.sin(angle) * (radius - 10)
    const x2 = cx + Math.cos(angle) * radius
    const y2 = cy - Math.sin(angle) * radius
    const on = i < filled
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={on ? 'var(--accent)' : 'var(--track)'}
        strokeWidth={6}
        strokeLinecap="round"
        opacity={on ? 1 - i * 0.015 : 1}
      />
    )
  })

  return (
    <div className="arc-gauge">
      <svg width="180" height="100" viewBox="0 0 180 100" role="img" aria-label="City risk gauge">
        {bars}
      </svg>
      <div className="arc-gauge-value">
        <strong>{value == null ? '—' : value.toFixed(1)}</strong>
        <small>{category ? `${category} · of 100` : 'not simulated'}</small>
      </div>
    </div>
  )
}
