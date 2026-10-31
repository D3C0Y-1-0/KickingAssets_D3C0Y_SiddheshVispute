import { Link } from 'react-router-dom'
import type { Baseline } from './workflow'
import { relativeChange } from './workflow'
import './workflow.css'

export function WorkflowNav({ current }: { current: 'assets' | 'plan' | 'whatif' }) {
  return (
    <nav className="workflow-nav" aria-label="Risk review workflow">
      <Link to="/live">1. Live Simulation</Link>
      <span aria-hidden="true">→</span>
      <Link to="/assets" aria-current={current === 'assets' ? 'step' : undefined}>
        2. Assets &amp; Risk
      </Link>
      <span aria-hidden="true">→</span>
      <Link to="/remediation" aria-current={current === 'plan' ? 'step' : undefined}>
        3. Fix Plan
      </Link>
      <span aria-hidden="true">→</span>
      <Link to="/what-if" aria-current={current === 'whatif' ? 'step' : undefined}>
        4. What-If comparison
      </Link>
    </nav>
  )
}
export function BaselineNotice({
  run,
  refreshing,
  refresh,
}: {
  run: Baseline
  refreshing: boolean
  refresh: () => unknown
}) {
  return (
    <div className="workflow-baseline">
      <div>
        <strong>Simulation baseline · {run.as_of}</strong>
        <small className="mono">
          {run.id} · {run.snapshot_id}
          <span className="workflow-fingerprint">Fingerprint: {run.fingerprint}</span>
        </small>
      </div>
      <button className="button secondary" disabled={refreshing} onClick={() => void refresh()}>
        {refreshing ? 'Checking baseline…' : 'Check baseline'}
      </button>
      <p>Requests name this exact run and fingerprint. Projections never change infrastructure.</p>
    </div>
  )
}
export function Outdated({ subject }: { subject: string }) {
  return (
    <div className="callout warn" role="status">
      <strong>{subject} outdated.</strong> Inputs or simulation baseline changed. Recalculate to see
      a projection for the current selection.
    </div>
  )
}
export function RiskComparison({
  baseline,
  projected,
  effort,
}: {
  baseline: number
  projected: number
  effort: number
}) {
  const absolute = baseline - projected
  const relative = relativeChange(baseline, projected)
  return (
    <div className="workflow-comparison" aria-label="Simulated risk comparison">
      <div>
        <span>Baseline city index</span>
        <strong>{baseline.toFixed(2)}</strong>
      </div>
      <div>
        <span>Projected city index</span>
        <strong>{projected.toFixed(2)}</strong>
      </div>
      <div>
        <span>Index reduction</span>
        <strong>{absolute.toFixed(2)} points</strong>
        <small>
          {relative === null
            ? 'Relative change unavailable: zero baseline'
            : `${relative.toFixed(2)}% relative reduction`}
        </small>
      </div>
      <div>
        <span>Estimated effort</span>
        <strong>{effort} h</strong>
        <small>Planning assumption</small>
      </div>
      <p>
        Simulated projection · not verified. Index change is not a change in incident probability.
      </p>
    </div>
  )
}
