import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Asset, Models } from '../../api/client'
import { Panel } from '../../components/ui'
import { ForceGraph, type ForceEdge, type ForceGraphHandle } from '../infrastructure/ForceGraph'
import { contains, eventsFor, type Outcome } from './model'

export function Replay({
  outcome,
  nodes,
  edges,
  names,
  label,
}: {
  outcome: Outcome
  nodes: Asset[]
  edges: ForceEdge[]
  names: Map<string, string>
  label: string
}) {
  const [minute, setMinute] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const graph = useRef<ForceGraphHandle>(null)
  const events = useMemo(() => eventsFor(outcome), [outcome])
  const stops = useMemo(() => [...new Set(events.map((e) => e.minute))], [events])
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(
      () =>
        setMinute((current) => {
          const next = stops.find((t) => t > current)
          if (next === undefined) {
            setPlaying(false)
            return current
          }
          return next
        }),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [playing, stops])
  const down = useMemo(
    () =>
      new Set(
        outcome.asset_outages
          .filter((a) => contains(a.intervals, minute, outcome.horizon_minutes))
          .map((a) => a.asset_id),
      ),
    [outcome, minute],
  )
  const activeBackups = new Set(
    outcome.standbys
      .filter((b) => contains(b.available_intervals, minute, outcome.horizon_minutes))
      .flatMap((b) => b.backup_asset_ids),
  )
  const ended = new Set(
    outcome.asset_outages
      .filter(
        (a) =>
          !down.has(a.asset_id) &&
          a.intervals.some(
            (i) => i.end_minutes <= minute && i.end_minutes < outcome.horizon_minutes,
          ),
      )
      .map((a) => a.asset_id),
  )
  const colorOf = useCallback(
    (asset: Asset) => {
      const token = down.has(asset.id)
        ? '--risk-critical'
        : activeBackups.has(asset.id)
          ? '--sector-water'
          : ended.has(asset.id)
            ? '--risk-low'
            : '--text-secondary'
      return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
      // Sets derive only from API intervals, and this updates colour without relaying out D3.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [outcome, minute],
  )
  const active = outcome.asset_outages.find((a) => a.asset_id === selected)
  return (
    <Panel title={`${label} · operational replay`}>
      <div className="panel-padding planner-stack">
        <p>
          Projected events only. The clock steps between API interval boundaries; simultaneous
          events remain simultaneous. Graph layout motion is not failure propagation.
        </p>
        <div className="planner-controls">
          <button
            className="button secondary"
            onClick={() => {
              if (minute === outcome.horizon_minutes) setMinute(0)
              setPlaying(!playing)
            }}
          >
            {playing ? 'Pause replay' : 'Play replay'}
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setMinute(0)
              setPlaying(true)
            }}
          >
            Replay from start
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setPlaying(false)
              setMinute(stops.find((t) => t > minute) ?? minute)
            }}
            disabled={minute === outcome.horizon_minutes}
          >
            Next event
          </button>
          <button className="button secondary" onClick={() => graph.current?.fit()}>
            Fit operational graph
          </button>
        </div>
        <label>
          Replay minute:{' '}
          <strong>
            {minute} / {outcome.horizon_minutes}
          </strong>
          <input
            aria-label="Replay minute"
            type="range"
            min="0"
            max={outcome.horizon_minutes}
            step="1"
            value={minute}
            onChange={(e) => {
              setPlaying(false)
              setMinute(Number(e.target.value))
            }}
          />
        </label>
        <p className="small muted">
          Red: modelled outage · green: an outage interval ended · blue: usable standby output ·
          grey: no reported outage at this time. Horizon-truncated outages remain failed.
        </p>
        <div
          className="planner-graph"
          role="group"
          aria-label="Resilience operational dependency graph"
        >
          <ForceGraph
            ref={graph}
            nodes={nodes}
            edges={edges}
            mode="operational"
            selected={selected}
            colorOf={colorOf}
            onSelect={setSelected}
          />
        </div>
        <label>
          Inspect replay asset
          <select
            value={selected ?? ''}
            onChange={(e) => {
              setSelected(e.target.value || null)
              graph.current?.focus(e.target.value)
            }}
          >
            <option value="">Choose an asset…</option>
            {nodes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.name}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <p>
            {selected} ·{' '}
            {down.has(selected)
              ? 'Modelled outage at this minute'
              : activeBackups.has(selected)
                ? 'Usable standby output'
                : ended.has(selected)
                  ? 'Outage ended in this projection'
                  : 'No reported outage at this minute'}
            .
            {active && (
              <>
                {' '}
                Causal event IDs: {active.failure_ids.join(', ')}. Operational edge IDs reported
                across its outage history: {active.dependency_edge_ids.join(', ') || 'direct event'}
                .
              </>
            )}
          </p>
        )}
        <div className="table-scroll">
          <table>
            <caption>Essential services at minute {minute}</caption>
            <thead>
              <tr>
                <th>Service</th>
                <th>Current replay state</th>
                <th>Total disrupted minutes</th>
              </tr>
            </thead>
            <tbody>
              {outcome.services.map((s) => (
                <tr key={s.service_id}>
                  <td>{names.get(s.service_id) ?? s.service_id}</td>
                  <td>
                    {contains(s.intervals, minute, outcome.horizon_minutes)
                      ? 'Disrupted (modelled)'
                      : 'No modelled disruption'}
                  </td>
                  <td>{s.disrupted_minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary>Standby evidence and windows</summary>
          {outcome.standbys.map((b) => (
            <p key={`${b.service_id}:${b.requirement_id}`}>
              <strong>{b.backup_asset_ids.join(', ')}</strong>: scheduled{' '}
              {b.activation_minutes ?? 'not needed'} → {b.exhaustion_minutes ?? 'not needed'} min;
              usable duration {b.usable_duration_minutes} min. Usable intervals:{' '}
              {b.available_intervals
                .map((i) => `[${i.start_minutes}, ${i.end_minutes})`)
                .join(', ') || 'none'}
              . {b.activation_condition}
            </p>
          ))}
        </details>
        <details open>
          <summary>Recorded events</summary>
          <ol className="planner-events" aria-label="API-supported timeline events">
            {events.map((e, i) => (
              <li key={i} aria-current={e.minute === minute ? 'step' : undefined}>
                <button
                  className="text-link"
                  onClick={() => {
                    setPlaying(false)
                    setMinute(e.minute)
                  }}
                >
                  Minute {e.minute}
                </button>{' '}
                · {e.label}
              </li>
            ))}
          </ol>
        </details>
      </div>
    </Panel>
  )
}

export function ServiceComparison({
  comparison,
  names,
}: {
  comparison: Models['Comparison']
  names: Map<string, string>
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption>Modelled service disruption · minutes</caption>
        <thead>
          <tr>
            <th>Service</th>
            <th>Before</th>
            <th>After</th>
            <th>Residual impact</th>
          </tr>
        </thead>
        <tbody>
          {comparison.after.services.map((s) => (
            <tr key={s.service_id}>
              <td>{names.get(s.service_id) ?? s.service_id}</td>
              <td>
                {comparison.before.services.find((b) => b.service_id === s.service_id)
                  ?.disrupted_minutes ?? 'Unavailable'}
              </td>
              <td>{s.disrupted_minutes}</td>
              <td>
                {s.disruption_fraction.toLocaleString(undefined, {
                  style: 'percent',
                  maximumFractionDigits: 1,
                })}{' '}
                of horizon
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
