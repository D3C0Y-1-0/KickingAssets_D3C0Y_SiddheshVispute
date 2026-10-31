import { useState, type ReactNode } from 'react'
import { CircleAlert, LoaderCircle, Play, RotateCw } from 'lucide-react'
import { useRunSimulation, useSimulationDates } from '../hooks/queries'
import type { SimulationRun } from '../api/client'
import { EmptyState } from './ui'
import { SimulationProgressPanel } from './SimulationProgress'

export function RunSimulationButton({
  label,
  variant = 'primary',
  asOf,
}: {
  label?: string
  variant?: 'primary' | 'secondary'
  asOf?: string
}) {
  const run = useRunSimulation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className={`button ${variant} simulation-run`}
        disabled={run.isPending}
        onClick={() => {
          setOpen(true)
          run.mutate(asOf)
        }}
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
      {open && (
        <SimulationProgressPanel
          running={run.isPending}
          run={run.data}
          error={run.isError ? run.error.message : null}
          onClose={() => setOpen(false)}
        />
      )}
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
        are real. Each asset is assumed to run a specific real product and version; NVD
        affected-version ranges decide which CVEs apply. Nothing is a scan result, and the risk
        index is relative, not a probability of an incident.
      </span>
    </div>
  )
}

/** Pick the date to simulate as of. Past dates are a time-travel backtest. */
export function AsOfSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const dates = useSimulationDates()
  return (
    <label className="asof-select">
      <span className="subtle-label">AS OF</span>
      <select
        aria-label="Simulate as of date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!dates.data}
      >
        <option value="">Latest data</option>
        {dates.data?.map((d) => (
          <option key={d.as_of} value={d.as_of}>
            {d.as_of} · {d.held_out ? 'held-out' : 'not held-out'}
          </option>
        ))}
      </select>
    </label>
  )
}

export function AsOfBanner({ run }: { run: SimulationRun }) {
  return (
    <div className={`callout ${run.held_out ? '' : 'warn'}`}>
      <strong>Simulated as of {run.as_of}.</strong> CVE publication dates and KEV/EPSS history are
      cutoff-scoped. NVD fields use current records and may include later edits, so this is not a
      fully point-in-time archive.{' '}
      {run.as_of_split.charAt(0).toUpperCase() + run.as_of_split.slice(1)}.
    </div>
  )
}
