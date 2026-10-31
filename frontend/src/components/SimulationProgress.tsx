import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleAlert, LoaderCircle, X } from 'lucide-react'
import { useSimulationProgress } from '../hooks/queries'
import type { SimulationRun } from '../api/client'

type Step = {
  name: string
  detail: string
  seconds: number | null
  status: 'pending' | 'active' | 'done'
}

const REVEAL_MS = 420
const CLOSE_MS = 900

/**
 * Live view of a simulation run. Steps and timings come from the backend as it finishes each one.
 * Reveal is paced so that fast steps stay readable; nothing is shown as done before the server did it.
 */
export function SimulationProgressPanel({
  running,
  run,
  error,
  onClose,
}: {
  running: boolean
  run: SimulationRun | undefined
  error: string | null
  onClose: () => void
}) {
  const progress = useSimulationProgress(running)
  const [shown, setShown] = useState(0)

  const steps: Step[] =
    run && !running
      ? run.stages.map((s) => ({ ...s, status: 'done' as const }))
      : progress.data?.status === 'running'
        ? progress.data.steps
        : []
  const doneCount = steps.filter((s) => s.status === 'done').length
  const total = progress.data?.steps.length || steps.length || 7

  useEffect(() => {
    if (shown >= doneCount) return
    const id = window.setTimeout(() => setShown((n) => n + 1), REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [shown, doneCount])

  const finished = !!run && !running && shown >= steps.length
  useEffect(() => {
    if (!finished) return
    const id = window.setTimeout(onClose, CLOSE_MS)
    return () => window.clearTimeout(id)
  }, [finished, onClose])

  const rows =
    steps.length > 0
      ? steps
      : Array.from({ length: total }, (_, i) => ({
          name: progress.data?.steps[i]?.name ?? '…',
          detail: '',
          seconds: null,
          status: (i === 0 ? 'active' : 'pending') as Step['status'],
        }))
  const visibleStatus = (index: number): Step['status'] =>
    index < shown ? 'done' : index === shown && !finished ? 'active' : 'pending'
  const percent = Math.round((Math.min(shown, total) / total) * 100)

  return createPortal(
    <div className="sim-overlay" role="dialog" aria-modal="true" aria-label="Simulation progress">
      <div className="sim-panel">
        <header>
          <div>
            <span className="subtle-label">SIMULATION</span>
            <h2>
              {error
                ? 'Simulation failed'
                : finished
                  ? 'Simulation complete'
                  : 'Running simulation'}
            </h2>
          </div>
          {(error || finished) && (
            <button className="icon-button" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          )}
        </header>
        <div className="sim-bar" aria-hidden>
          <i style={{ width: `${error ? 100 : percent}%` }} className={error ? 'bad' : ''} />
        </div>
        <ol className="sim-steps">
          {rows.map((step, i) => {
            const status = visibleStatus(i)
            return (
              <li key={step.name + i} className={status}>
                <span className="sim-mark">
                  {status === 'done' ? (
                    <Check size={14} />
                  ) : status === 'active' ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : null}
                </span>
                <span>
                  <strong>{step.name}</strong>
                  <small>
                    {status === 'done' && step.detail}
                    {status === 'active' && (progress.data?.note ?? 'Working…')}
                  </small>
                </span>
                <span className="mono sim-time">
                  {status === 'done' && step.seconds != null ? `${step.seconds.toFixed(2)} s` : ''}
                </span>
              </li>
            )
          })}
        </ol>
        {error && (
          <div className="callout warn" role="alert">
            <CircleAlert size={14} /> {error}
          </div>
        )}
        {finished && run && (
          <footer className="sim-summary">
            City index <strong className="mono">{run.city_risk.score?.toFixed(1) ?? '—'}</strong> ·{' '}
            {run.assets.filter((a) => a.risk.category === 'critical').length} critical assets
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
