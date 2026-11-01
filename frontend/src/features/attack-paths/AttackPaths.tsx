import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError, type Models, type SimulationRun } from '../../api/client'
import { useLatestRun } from '../../hooks/queries'
import { SimulationRequired } from '../../components/Simulation'
import { EmptyState, PageHeading, Panel, QueryState } from '../../components/ui'
import { BaselineNotice } from '../actions/WorkflowUI'
import './attack-paths.css'

function pathKey(path: Models['AttackPath']) {
  return path.nodes.join('>')
}

export default function AttackPaths() {
  const latest = useLatestRun()
  if (latest.isPending || latest.isError)
    return <QueryState pending={latest.isPending} error={latest.error} retry={latest.refetch} />
  return (
    <div className="attack-page">
      <PageHeading
        title="Attack paths"
        description="Inspect potential cyber routes, their evidence and conditional service consequences. No attacks are executed."
        actions={
          <Link to="/remediation" className="button primary">
            Continue to Fix Plan
          </Link>
        }
      />
      {!latest.data ? (
        <SimulationRequired />
      ) : (
        <>
          <BaselineNotice
            run={latest.data}
            refresh={latest.refetch}
            refreshing={latest.isFetching}
          />
          <PathWorkspace
            key={`${latest.data.scenario_id}:${latest.data.snapshot_id}`}
            run={latest.data}
          />
        </>
      )}
    </div>
  )
}

function PathWorkspace({ run }: { run: SimulationRun }) {
  const [params, setParams] = useSearchParams()
  const target = params.get('target') ?? ''
  const focus = params.get('asset') ?? ''
  const [isolated, setIsolated] = useState<string[]>([])
  const [isolateId, setIsolateId] = useState('')
  const [limit, setLimit] = useState(5)
  const [selected, setSelected] = useState('')
  const report = useQuery({
    queryKey: ['attack-paths', run.id, run.fingerprint, [...isolated].sort(), limit],
    queryFn: async ({ signal }) => {
      const data = await api.attackPaths(run, isolated, limit, signal)
      if (
        data.run_id !== run.id ||
        data.baseline_fingerprint !== run.fingerprint ||
        data.scenario_id !== run.scenario_id ||
        data.snapshot_id !== run.snapshot_id
      )
        throw new ApiError(
          409,
          'Attack-path results belong to another baseline. Check the latest simulation and retry.',
          'baseline_mismatch',
        )
      return data
    },
    retry: false,
  })
  const data = report.data
  const paths = (data?.paths ?? []).filter(
    (path) => (!target || path.target === target) && (!focus || path.nodes.includes(focus)),
  )
  const active = paths.find((path) => pathKey(path) === selected) ?? paths[0]
  const names = new Map(run.assets.map((asset) => [asset.asset_id, asset.name]))
  const services = new Map(run.services.map((service) => [service.service_id, service.name]))
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }
  return (
    <>
      <div className="callout warn">
        <strong>Candidate routes, not confirmed compromises.</strong> Only cyber edges are
        traversed. Operational dependencies report consequences afterward. KEV/ML summaries do not
        establish a CVE's attack vector; authentication and protocol judgments are coarse scenario
        assumptions. The ordinal ranking aid is not a probability.
      </div>
      <Panel title="Inspect routes and hypothetical isolation">
        <div className="panel-padding attack-controls">
          <label>
            Target
            <select
              aria-label="Attack-path target"
              value={target}
              onChange={(e) => filter('target', e.target.value)}
            >
              <option value="">All analysed targets</option>
              {data?.targets.map((id) => (
                <option value={id} key={id}>
                  {id} · {names.get(id) ?? id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Paths containing asset
            <select
              aria-label="Paths containing asset"
              value={focus}
              onChange={(e) => filter('asset', e.target.value)}
            >
              <option value="">Any asset</option>
              {run.assets.map((asset) => (
                <option value={asset.asset_id} key={asset.asset_id}>
                  {asset.asset_id} · {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Paths per target
            <select
              aria-label="Maximum paths per target"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[1, 3, 5, 10].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Isolate asset
            <select
              aria-label="Hypothetical isolated asset"
              value={isolateId}
              onChange={(e) => setIsolateId(e.target.value)}
            >
              <option value="">Choose an asset…</option>
              {run.assets.map((asset) => (
                <option value={asset.asset_id} key={asset.asset_id}>
                  {asset.asset_id} · {asset.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            disabled={!isolateId || isolated.includes(isolateId)}
            onClick={() => setIsolated([...isolated, isolateId])}
          >
            Add isolation
          </button>
          <div className="attack-isolations">
            {isolated.length ? (
              isolated.map((id) => (
                <span className="workflow-chip" key={id}>
                  {id}
                  <button
                    className="button secondary"
                    aria-label={`Remove isolation ${id}`}
                    onClick={() => setIsolated(isolated.filter((item) => item !== id))}
                  >
                    Remove
                  </button>
                </span>
              ))
            ) : (
              <span className="small muted">No hypothetical isolation</span>
            )}
          </div>
          <p className="small muted">
            Isolation removes cyber access through the asset in this analysis only. It does not
            execute segmentation or change operational dependencies.
          </p>
        </div>
      </Panel>
      <QueryState pending={report.isPending} error={report.error} retry={report.refetch} />
      {data && !report.isError && (
        <>
          <p className="callout">
            <strong>
              {data.state === 'projected' ? 'SIMULATED ISOLATION' : 'CURRENT BASELINE'}
            </strong>{' '}
            · {data.method_version} · {data.paths.length} reported paths across{' '}
            {data.targets.length} targets.
            <br />
            Entry points with declared internet exposure: {data.entry_points.join(', ') || 'none'}.
            Unknown exposure: {data.unknown_exposure_assets.join(', ') || 'none listed'}.
          </p>
          <div className="attack-layout">
            <Panel title={`Candidate paths (${paths.length})`}>
              {!paths.length ? (
                <EmptyState title="No reported path matches this view">
                  Review filters and isolation. No supported path is not proof that an asset is
                  secure.
                  <button className="button secondary" onClick={() => setParams({})}>
                    Clear route filters
                  </button>
                </EmptyState>
              ) : (
                <div className="attack-list">
                  {paths.map((path) => (
                    <button
                      className={`attack-path ${pathKey(active) === pathKey(path) ? 'selected' : ''}`}
                      key={pathKey(path)}
                      aria-pressed={pathKey(active) === pathKey(path)}
                      onClick={() => setSelected(pathKey(path))}
                    >
                      <strong>
                        #{path.rank} · {path.entry_point} → {path.target}
                      </strong>
                      <span>
                        {path.status.replaceAll('_', ' ')} · ordinal aid{' '}
                        {path.ranking_score.toFixed(4)}
                      </span>
                      <small>{path.nodes.join(' → ')}</small>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
            {active && (
              <div>
                <Panel title="Path evidence">
                  <div className="panel-padding">
                    <div className="attack-route">internet → {active.nodes.join(' → ')}</div>
                    <p>{active.explanation}</p>
                    <p className="small muted">
                      Weakest step: {active.weakest_hop + 1}. An unknown-evidence step never becomes
                      an observed compromise.
                    </p>
                    <ol className="attack-hops">
                      {active.hops.map((hop, index) => (
                        <li key={`${hop.edge_id ?? 'initial'}:${index}`}>
                          <strong>
                            {hop.source} → {hop.target}: {hop.status.replaceAll('_', ' ')}
                          </strong>
                          <p>{hop.explanation}</p>
                          <small>
                            {hop.edge_id
                              ? `Cyber edge ${hop.edge_id} · ${hop.protocol} · ${hop.access}`
                              : 'Initial internet access assumption'}{' '}
                            · basis: {hop.basis.join(', ') || 'no supporting basis'}
                          </small>
                          <Link
                            className="text-link"
                            to={`/intelligence?asset=${encodeURIComponent(hop.target)}`}
                          >
                            Inspect {hop.target} vulnerability evidence and risk
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                </Panel>
                <Panel title="Conditional operational impact" className="spaced-panel">
                  <div className="panel-padding">
                    {active.consequence ? (
                      <>
                        <p>
                          If {active.target} suffers{' '}
                          <strong>{active.consequence.effect.replaceAll('_', ' ')}</strong>, the
                          operational dependency model calculates:
                        </p>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>ESSENTIAL SERVICE</th>
                                <th>CONDITIONAL DISRUPTION</th>
                              </tr>
                            </thead>
                            <tbody>
                              {active.consequence.services.map((service) => (
                                <tr key={service.service_id}>
                                  <td>{services.get(service.service_id) ?? service.service_id}</td>
                                  <td>{(service.disruption_fraction * 100).toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p>
                        Operational consequence unavailable for this path. No zero impact is
                        assumed.
                      </p>
                    )}
                    <p className="small muted">
                      An explicit compromise effect and existing backup/recovery assumptions are
                      required. Consequences are an upper bound, not an outage forecast.
                    </p>
                    <div className="workflow-buttons">
                      <Link
                        className="button secondary"
                        to={`/infrastructure?mode=operational&focus=${active.target}`}
                      >
                        Inspect operational dependencies
                      </Link>
                      <Link className="button primary" to="/remediation">
                        Plan preventive actions
                      </Link>
                    </div>
                  </div>
                </Panel>
              </div>
            )}
          </div>
          <Panel title="Reachability, choke points and analysis limits" className="spaced-panel">
            <div className="panel-padding">
              <details>
                <summary>Target reachability ({data.target_reachability.length})</summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>TARGET</th>
                        <th>CONNECTED</th>
                        <th>REPORTED PATHS</th>
                        <th>VERDICT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.target_reachability.map((item) => (
                        <tr key={item.target}>
                          <td>{item.target}</td>
                          <td>{item.reachable ? 'Yes' : 'No'}</td>
                          <td>{item.supported_paths}</td>
                          <td>{item.verdict.replaceAll('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <details>
                <summary>Cyber choke points ({data.chokepoints.length})</summary>
                <ul>
                  {data.chokepoints.map((point) => (
                    <li key={point.asset_id}>
                      {point.asset_id} · {point.name}: {point.paths_through} reported paths; removal
                      cuts analysed routes to {point.targets_cut.join(', ') || 'no target'}.
                    </li>
                  ))}
                </ul>
              </details>
              <ul>
                {data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p className="small muted">
                Simple paths are bounded by the engine's hop/candidate caps. The vulnerability
                summary is coarse; no exploit is attempted and no success probability is estimated.
              </p>
            </div>
          </Panel>
        </>
      )}
    </>
  )
}
