import type { ReactNode } from 'react'
import { CircleAlert, LoaderCircle, Play, RotateCw } from 'lucide-react'
import { useRunSimulation } from '../hooks/queries'
import { EmptyState } from './ui'

export function RunSimulationButton({
  label,
  variant = 'primary',
}: {
  label?: string
  variant?: 'primary' | 'secondary'
}) {
  const run = useRunSimulation()
  return (
    <>
      <button
        className={`button ${variant} simulation-run`}
        disabled={run.isPending}
        onClick={() => run.mutate()}
      >
        {run.isPending ? (
          <LoaderCircle className="spin" size={16} />
        ) : variant === 'primary' ? (
          <Play size={16} />
        ) : (
          <RotateCw size={15} />
        )}
        {run.isPending ? 'Simulating…' : (label ?? 'Run simulation')}
      </button>
      {run.isError && (
        <span className="run-error" role="alert">
          <CircleAlert size={14} />
          {run.error.message}
        </span>
      )}
    </>
  )
}

/** Shown wherever a result needs a simulation first. Never substitutes a placeholder number. */
export function SimulationRequired({ children }: { children?: ReactNode }) {
  return (
    <EmptyState title="Run the simulation to see results">
      {children ??
        'Nothing is scored until the simulation fetches candidate CVEs for each asset and scores them with the ML model.'}
      <span className="empty-action">
        <RunSimulationButton />
      </span>
    </EmptyState>
  )
}

export function ProvenanceNotice() {
  return (
    <div className="preview-notice">
      <CircleAlert size={16} />
      <span>
        Assets and their configuration are fictional scenario assumptions. CVEs, EPSS and KEV data
        are real; each asset is assumed to run a real product family, so CVEs are candidate
        findings, not confirmed. The risk index is relative, not a probability of an incident.
      </span>
    </div>
  )
}
