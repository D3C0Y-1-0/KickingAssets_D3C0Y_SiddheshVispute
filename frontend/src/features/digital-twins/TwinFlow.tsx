import { Link, useNavigate } from 'react-router-dom'
import type { Asset, Models, SimulationRun } from '../../api/client'
import type { TwinRisk } from '../../hooks/twinRisk'
import { makeHandoff } from '../actions/workflow'

type OperationalEdge = Models['OperationalDependencyEdge']

/**
 * What a finished simulation means for the diagram: the flagged parts in risk order, what each one
 * feeds in the operational graph, and the next step for each (inspect it, test a fix). It is derived
 * from the latest run and the scenario graph only; nothing here is a prediction of an incident.
 */
export function TwinFlow({
  run,
  parts,
  assets,
  edges,
}: {
  run: SimulationRun
  parts: [string, TwinRisk][]
  assets: Asset[]
  edges: OperationalEdge[]
}) {
  const navigate = useNavigate()
  const name = new Map(assets.map((a) => [a.id, a.name]))
  const seen = new Set<string>()
  const rows = parts
    .filter(([, r]) => r.category === 'critical' || r.category === 'high')
    .filter(([, r]) => !seen.has(r.assetId) && !!seen.add(r.assetId))
    .sort((a, b) => a[1].rank - b[1].rank)
  if (!rows.length) return null
  return (
    <section className="twin-flow" aria-label="Simulation results on this diagram" key={run.id}>
      <header>
        <strong>From the simulation to action</strong>
        <span>
          Run {run.id} · city risk {run.city_risk.score?.toFixed(1) ?? 'n/a'}
        </span>
      </header>
      <ol>
        {rows.map(([part, r], index) => {
          const feeds = edges
            .filter((e) => e.source_asset_id === r.assetId)
            .map((e) => e.target_asset_id)
          return (
            <li
              key={part}
              className={r.category ?? ''}
              style={{ ['--pop-delay' as string]: `${Math.min(index, 14) * 150}ms` }}
            >
              <span className="twin-flow-score font-mono">{r.score.toFixed(1)}</span>
              <div>
                <strong>
                  {r.assetId} · {name.get(r.assetId) ?? r.name}
                </strong>
                <small>
                  {(r.category ?? '').toUpperCase()} on this diagram part
                  {feeds.length > 0
                    ? ` · feeds ${feeds.map((id) => name.get(id) ?? id).join(', ')}`
                    : ' · no operational dependents in the scenario'}
                </small>
              </div>
              <span className="twin-flow-actions">
                <Link className="text-link" to={`/intelligence?asset=${encodeURIComponent(r.assetId)}`}>
                  Evidence
                </Link>
                <button
                  className="button secondary"
                  onClick={() =>
                    navigate('/what-if', {
                      state: makeHandoff(run, [
                        { asset_id: r.assetId, action_type: 'patch_prioritization' },
                      ]),
                    })
                  }
                >
                  Test a fix
                </button>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
