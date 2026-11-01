import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Asset, Models } from '../../api/client'
import { Panel, QueryState } from '../../components/ui'
import { ForceGraph, type ForceEdge, type ForceGraphHandle } from '../infrastructure/ForceGraph'
import { contains, eventsFor, replayScope, type Outcome } from './model'

const noIds: string[] = []

export function Replay({
  outcome,
  nodes,
  edges,
  names,
  label,
  directIds = noIds,
  cyber,
  capacities = [],
  failedBackupIds = noIds,
}: {
  outcome: Outcome
  nodes: Asset[]
  edges: ForceEdge[]
  names: Map<string, string>
  label: string
  directIds?: string[]
  cyber?: { data?: Models['CyberGraph']; pending: boolean; error: Error | null; retry: () => void }
  capacities?: Models['Capacity'][]
  failedBackupIds?: string[]
}) {
  const [minute, setMinute] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [scope, setScope] = useState<'full' | 'affected'>('full')
  const [mode, setMode] = useState<'operational' | 'cyber'>('operational')
  const graph = useRef<ForceGraphHandle>(null)
  const events = useMemo(() => eventsFor(outcome), [outcome])
  const stops = useMemo(() => [...new Set(events.map((e) => e.minute))], [events])
  const evidence = useMemo(
    () => replayScope(outcome, edges, directIds),
    [outcome, edges, directIds],
  )
  const initiatingIds = useMemo(() => new Set(directIds), [directIds])
  const shownNodes = useMemo(
    () => nodes.filter((a) => scope === 'full' || evidence.affected.has(a.id)),
    [nodes, scope, evidence],
  )
  const shownEdges = useMemo<ForceEdge[]>(() => {
    const ids = new Set(shownNodes.map((a) => a.id))
    return (mode === 'operational' ? edges : (cyber?.data?.edges ?? [])).filter(
      (e) => ids.has(e.source_asset_id) && ids.has(e.target_asset_id),
    )
  }, [shownNodes, edges, mode, cyber?.data])
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
  const describe = (a: Asset) =>
    `${directIds.includes(a.id) ? 'Direct assumed failure' : outcome.asset_outages.some((o) => o.asset_id === a.id) ? 'Indirect affected asset' : evidence.standby.has(a.id) ? 'Declared standby' : 'No reported outage'} · ${down.has(a.id) ? 'outage now' : activeBackups.has(a.id) ? 'usable standby output now' : ended.has(a.id) ? 'outage interval ended' : 'no outage reported now'}`
  return (
    <Panel title={`${label} · ${mode === 'operational' ? 'operational replay' : 'cyber context'}`}>
      <div className="panel-padding planner-stack">
        <p>
          Projected events only. The clock steps between API interval boundaries; simultaneous
          events remain simultaneous. Graph layout motion is not failure propagation.
        </p>
        <div className="planner-controls" role="group" aria-label="Replay graph scope">
          <button
            className="button secondary"
            aria-pressed={scope === 'full'}
            onClick={() => setScope('full')}
          >
            Full Infrastructure
          </button>
          <button
            className="button secondary"
            aria-pressed={scope === 'affected'}
            onClick={() => setScope('affected')}
          >
            Affected Dependencies
          </button>
        </div>
        <div className="planner-controls" role="group" aria-label="Replay connection type">
          <button
            className="button secondary"
            aria-pressed={mode === 'operational'}
            onClick={() => setMode('operational')}
          >
            Operational Dependencies
          </button>
          <button
            className="button secondary"
            aria-pressed={mode === 'cyber'}
            onClick={() => setMode('cyber')}
          >
            Cyber Connections (context only)
          </button>
        </div>
        <p className="small muted">
          {mode === 'operational'
            ? 'Dashed arrows: direct provider → dependent relationships. Dotted arrows: declared standby. Indirect effects follow dependency chains; highlighted edges are aggregate API-reported causal evidence, not timed edge transitions.'
            : 'Solid arrows: configured cyber access directions, not evidence of compromise. Asset outage colors come from the separate operational result; cyber links do not explain those outages.'}{' '}
          Direct failure assets: {directIds.join(', ') || 'not supplied'}. Unaffected assets are
          dimmed. Affected Dependencies includes reported outages, initiating assets and triggered
          standby relationships only.
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
          grey: no reported outage at this time. Horizon-truncated outages remain failed. Heavy node
          outline: direct initiating failure; other reported outages are indirect effects.
        </p>
        {mode === 'cyber' && !cyber?.data ? (
          cyber?.pending || cyber?.error ? (
            <QueryState pending={cyber.pending} error={cyber.error} retry={cyber.retry} />
          ) : (
            <p role="alert">
              Cyber graph is unavailable or does not match this scenario/snapshot. Operational
              replay remains available.
            </p>
          )
        ) : (
          <div
            className="planner-graph"
            role="group"
            aria-label={
              mode === 'operational'
                ? 'Resilience operational dependency graph'
                : 'Resilience cyber context graph'
            }
          >
            <ForceGraph
              ref={graph}
              nodes={shownNodes}
              edges={shownEdges}
              mode={mode}
              selected={selected}
              colorOf={colorOf}
              onSelect={setSelected}
              emphasizedIds={evidence.affected}
              reportedEdgeIds={mode === 'operational' ? evidence.reportedEdges : undefined}
              nodeDescription={describe}
              initiatingIds={initiatingIds}
            />
          </div>
        )}
        <p role="status" aria-live="polite">
          Minute {minute}: {down.size} asset(s) in modelled outage; {activeBackups.size} standby
          asset(s) with usable output. Showing {shownNodes.length} assets / {shownEdges.length}{' '}
          {mode} connections.
        </p>
        <p>
          {events
            .filter((e) => e.minute === minute)
            .map((e) => e.label)
            .join(' · ') || 'Between API-reported event boundaries; no new transition is inferred.'}
        </p>
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
            {directIds.includes(selected)
              ? 'Direct assumed failure'
              : active
                ? 'Indirect affected asset'
                : 'Context asset'}{' '}
            ·{' '}
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
        <details>
          <summary>Declared relationships and propagation evidence</summary>
          <ul>
            {shownEdges.map((e) => (
              <li key={e.id}>
                {e.source_asset_id} → {e.target_asset_id} ·{' '}
                {mode === 'cyber'
                  ? `${e.protocol} / ${e.access} · access assumption only`
                  : `${e.dependency} / ${e.requirement} · ${evidence.reportedEdges.has(e.id) ? 'reported propagation evidence' : e.requirement === 'backup' ? 'declared standby relationship' : 'topology only; no effect inferred'}`}
              </li>
            ))}
          </ul>
          {!shownEdges.length && (
            <p>No connections in this view. No links are invented to join isolated assets.</p>
          )}
        </details>
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
        <section aria-label="Modelled standby availability" className="planner-stack">
          <h3>Backup availability and limits</h3>
          {!outcome.standbys.length && <p>No standby is reported by this API result.</p>}
          {outcome.standbys.map((b) => (
            <div className="planner-backup" key={`${b.service_id}:${b.requirement_id}`}>
              <strong>
                {b.backup_asset_ids.map((id) => `${id} · ${names.get(id) ?? id}`).join(', ')}
              </strong>
              <p>
                {names.get(b.service_id) ?? b.service_id} · {b.requirement_id}
              </p>
              <p>
                Scheduled activation / delay from onset: {b.activation_minutes ?? 'not triggered'}{' '}
                min · exhaustion: {b.exhaustion_minutes ?? 'not triggered'} min · usable energy
                duration: {b.usable_duration_minutes} min.
              </p>
              <p>
                At minute {minute}:{' '}
                {contains(b.available_intervals, minute, outcome.horizon_minutes)
                  ? 'usable output available'
                  : 'no usable output reported'}
                .
                {b.backup_asset_ids.some((id) => failedBackupIds.includes(id)) &&
                  ' Stress assumption: named backup forced unavailable.'}
                {capacities
                  .filter((c) => b.backup_asset_ids.includes(c.backup_asset_id))
                  .map((c) => ` Submitted energy fraction: ${c.usable_energy_fraction}.`)}
              </p>
              <div
                className="planner-backup-window"
                role="img"
                aria-label={`${b.backup_asset_ids.join(', ')} usable output intervals over ${outcome.horizon_minutes} minutes`}
              >
                {b.available_intervals.map((i) => (
                  <span
                    key={i.start_minutes}
                    style={{
                      left: `${(100 * i.start_minutes) / outcome.horizon_minutes}%`,
                      width: `${(100 * (i.end_minutes - i.start_minutes)) / outcome.horizon_minutes}%`,
                    }}
                  />
                ))}
              </div>
              <p>
                Usable intervals:{' '}
                {b.available_intervals
                  .map((i) => `[${i.start_minutes}, ${i.end_minutes})`)
                  .join(', ') || 'none'}
                . {b.activation_condition}
              </p>
              <p>
                Declared backup edges:{' '}
                {edges
                  .filter(
                    (e) =>
                      e.requirement === 'backup' && b.backup_asset_ids.includes(e.source_asset_id),
                  )
                  .map((e) => `${e.source_asset_id} → ${e.target_asset_id} (${e.id})`)
                  .join('; ') ||
                  'none supplied; service substitution does not imply a device-to-device link'}
                .
              </p>
            </div>
          ))}
        </section>
        <details open>
          <summary>Failure, standby and recovery timeline</summary>
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

export function DisruptionChart({
  before,
  after,
  stress,
}: {
  before: number
  after?: number
  stress?: number
}) {
  const max = Math.max(1, before, after ?? 0, stress ?? 0)
  return (
    <div
      className="planner-comparison"
      role="group"
      aria-label="Modelled service-minute comparison"
    >
      <p>
        Modelled service-disruption minutes · lower is better. Same base failure and horizon; the
        stress column adds its stated assumptions. Unavailable results are not zero.
      </p>
      {(
        [
          ['Before Protection', before],
          ['After Protection', after],
          ['Backup Stress Test', stress],
        ] as const
      ).map(([label, value]) => (
        <div key={label}>
          <span>{label}</span> <strong>{value ?? 'Not calculated'}</strong>
          <div className="planner-comparison-track" aria-hidden="true">
            <span style={{ width: value === undefined ? '0%' : `${(100 * value) / max}%` }} />
          </div>
        </div>
      ))}
    </div>
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
