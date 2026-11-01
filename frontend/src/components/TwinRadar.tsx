import type { TwinRisk } from '../hooks/twinRisk'

/** Blinking radar rings over a twin part whose linked asset is high or critical. */
export function RadarPing({ risk }: { risk?: TwinRisk }) {
  if (!risk || (risk.category !== 'critical' && risk.category !== 'high')) return null
  return (
    <span
      key={risk.runId}
      className={`twin-radar twin-radar-pop ${risk.category}`}
      style={{ ['--pop-delay' as string]: `${Math.min(risk.rank, 14) * 150}ms` }}
      aria-hidden
    >
      <i />
      <i />
      <i />
      <b />
    </span>
  )
}

export function RiskLine({ risk }: { risk?: TwinRisk }) {
  if (!risk) return null
  return (
    <div
      className="text-[10px] font-mono mt-1"
      style={{
        color:
          risk.category === 'critical'
            ? '#ff3344'
            : risk.category === 'high'
              ? '#ff9a2e'
              : '#9aa4b8',
      }}
    >
      Calculated risk {risk.score.toFixed(1)} · {(risk.category ?? '').toUpperCase()} ·{' '}
      {risk.assetId}
    </div>
  )
}
