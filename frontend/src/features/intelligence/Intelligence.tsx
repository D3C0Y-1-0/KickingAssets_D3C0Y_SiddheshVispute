import { ArrowRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLatestRun } from '../../hooks/queries'
import { ProvenanceNotice, SimulationRequired } from '../../components/Simulation'
import {
  EmptyState,
  PageHeading,
  Panel,
  QueryState,
  RiskBadge,
  SectorBadge,
} from '../../components/ui'
import { percent } from '../../lib/risk'
import type { AssetSimulation, SimulationRun } from '../../api/client'

function History({ asset }: { asset: AssetSimulation }) {
  const h = asset.history
  const max = Math.max(...h.by_year.map((y) => y.cves_published), 1)
  return (
    <Panel title="Vulnerability history" className="spaced-panel">
      <div className="panel-padding">
        <div className="mini-bars" aria-label="CVEs published per year">
          {h.by_year.map((y) => (
            <div key={y.year} title={`${y.cves_published} CVEs, ${y.kev_added} added to KEV`}>
              <i
                className={y.kev_added ? 'kev' : ''}
                style={{ height: `${(y.cves_published / max) * 100}%` }}
              />
              <span>{y.year}</span>
              <span className="mono">{y.cves_published}</span>
            </div>
          ))}
        </div>
        <div className="stat-row">
          <div>
            <strong>{h.product_cves_total}</strong>
            <small>Product CVEs</small>
          </div>
          <div>
            <strong>{h.product_kev_listed}</strong>
            <small>KEV-listed</small>
          </div>
          <div>
            <strong>{h.vendor_kev_total}</strong>
            <small>Vendor KEV entries</small>
          </div>
          <div>
            <strong>{h.vendor_kev_last_90d}</strong>
            <small>Vendor KEV, last 90 days</small>
          </div>
        </div>
      </div>
    </Panel>
  )
}

function RunBacktest({ run }: { run: SimulationRun }) {
  const b = run.backtest
  if (!b) return null
  return (
    <Panel
      title={`Backtest · ${b.as_of}`}
      aside={<span className={`badge ${b.held_out ? 'ok' : 'sample'}`}>{b.split}</span>}
      className="spaced-panel"
    >
      <div className="panel-padding">
        {b.window_closed ? (
          <>
            <div className="table-scroll">
              <table className="metric-table">
                <thead>
                  <tr>
                    <th>GROUP</th>
                    <th>CVES</th>
                    <th>LATER IN KEV (≤ {b.window_days} DAYS)</th>
                    <th>RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {b.groups.map((g) => (
                    <tr key={g.label}>
                      <td>{g.label}</td>
                      <td className="mono">{g.cves}</td>
                      <td className="mono">{g.hits}</td>
                      <td className="mono">{percent(g.hit_rate, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {b.hits.length > 0 && (
              <ul className="list-plain">
                {b.hits.map((h) => (
                  <li key={h.cve_id}>
                    <span className="mono">{h.cve_id}</span> (assets {h.assets.join(', ')}): model
                    top {(100 - h.priority_percentile * 100).toFixed(1)}%, entered KEV on{' '}
                    {h.kev_added}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </Panel>
  )
}

export default function Intelligence() {
  const latest = useLatestRun()
  const [params, setParams] = useSearchParams()
  const selected = params.get('asset')
  const setSelected = (id: string) => setParams({ asset: id })
  if (latest.isPending || latest.isError)
    return <QueryState pending={latest.isPending} error={latest.error} retry={latest.refetch} />
  const run = latest.data
  if (!run)
    return (
      <>
        <PageHeading
          title="Risk ranking"
          description="Prioritization with a traceable reason behind every result."
        />
        <SimulationRequired />
      </>
    )
  if (!run.assets.length)
    return (
      <EmptyState title="No scored inventory assets">
        The simulation returned no assets. Review the scenario before ranking.
      </EmptyState>
    )
  const active = run.assets.find((a) => a.asset_id === selected) ?? run.assets[0]
  const m = active.matching
  return (
    <>
      <PageHeading
        title="Risk ranking"
        description="Assets ranked by risk, with the reason for each score."
        actions={
          <Link className="button primary" to="/what-if">
            Continue to actions <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="split-layout spaced-panel">
        <Panel title="Ranking">
          <div className="rank-list">
            {run.assets.map((a, i) => (
              <button
                key={a.asset_id}
                className={`rank-item ${a.asset_id === active.asset_id ? 'active' : ''}`}
                onClick={() => setSelected(a.asset_id)}
              >
                <span className="rank-number mono">{(i + 1).toString().padStart(2, '0')}</span>
                <span>
                  <strong>{a.name}</strong>
                  <small>
                    <span className="mono">{a.asset_id}</span>
                  </small>
                </span>
                <RiskBadge category={a.risk.category} />
                <strong className="mono rank-score">{a.risk.score?.toFixed(1) ?? '—'}</strong>
              </button>
            ))}
          </div>
        </Panel>
        <div>
          <Panel
            title={active.name}
            aside={
              <div className="inline-items">
                <SectorBadge sector={active.sector} />
                <RiskBadge category={active.risk.category} />
              </div>
            }
          >
            <div className="panel-padding">
              <div className="mono muted">{active.asset_id}</div>
              <div className="component-grid">
                <div className="score">
                  <strong>{active.risk.score?.toFixed(1) ?? '—'}</strong>
                  <small>Risk score</small>
                </div>
                <div>
                  <strong>{percent(active.vulnerability_signal, 1)}</strong>
                  <small>Vulnerability (S)</small>
                </div>
                <div>
                  <strong>{active.exposure_factor.toFixed(2)}</strong>
                  <small>Exposure (E)</small>
                </div>
                <div>
                  <strong>{active.impact_factor.toFixed(2)}</strong>
                  <small>Impact (I′)</small>
                </div>
              </div>
              <details className="why">
                <summary>Why this score</summary>
                <ul className="list-plain">
                  {(active.risk.factors ?? []).map((f) => (
                    <li key={f.name}>
                      <strong>{f.name}</strong> ({f.contribution.toFixed(2)}): {f.explanation}
                    </li>
                  ))}
                  {active.risk.status !== 'computed' && <li>{active.risk.unavailable_reason}</li>}
                </ul>
              </details>
            </div>
          </Panel>
          <History asset={active} />
          <Panel
            title="Applicable vulnerabilities"
            aside={
              <span className="subtle-label">
                {active.candidate_count} found · {active.known_exploited_count} KEV-listed
              </span>
            }
            className="spaced-panel"
          >
            {active.top_vulnerabilities.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>CVE</th>
                      <th>STATUS</th>
                      <th>ML RANK</th>
                      <th>EPSS</th>
                      <th>CVSS</th>
                      <th>TOP DRIVERS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.top_vulnerabilities.map((v) => (
                      <tr key={v.cve_id}>
                        <td>
                          <span className="mono">{v.cve_id}</span>
                        </td>
                        <td>
                          {v.status === 'kev_listed' ? (
                            <span className="risk-badge critical">KEV {v.kev_added}</span>
                          ) : (
                            <span className="badge neutral">ML scored</span>
                          )}
                        </td>
                        <td className="mono">
                          {v.priority_percentile == null
                            ? '—'
                            : `top ${(100 - v.priority_percentile * 100).toFixed(2)}%`}
                        </td>
                        <td className="mono">{percent(v.epss_percentile, 1)}</td>
                        <td className="mono">{v.cvss_score ?? '—'}</td>
                        <td>
                          {(v.drivers ?? []).length
                            ? (v.drivers ?? []).map((d) => (
                                <span
                                  key={d.feature}
                                  className={`driver-chip ${d.contribution > 0 ? 'up' : ''}`}
                                >
                                  {d.label} {d.contribution > 0 ? '+' : ''}
                                  {d.contribution.toFixed(2)}
                                </span>
                              ))
                            : 'Known exploited'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel-padding">
                <p>
                  No known CVE affects this version.
                  {!m.product_known && ' Product not in the NVD data.'}
                </p>
              </div>
            )}
          </Panel>
          <RunBacktest run={run} />
          <Panel title="Worst case" className="spaced-panel">
            <div className="panel-padding">
              {active.worst_scenario ? (
                <>
                  <p className="route">{active.worst_scenario.path.join(' → ')}</p>
                  <p>
                    <strong>{active.worst_scenario.target_asset_name}</strong>:{' '}
                    {active.worst_scenario.effect.replaceAll('_', ' ')}
                  </p>
                  <ul className="list-plain">
                    {active.worst_scenario.services.map((s) => (
                      <li key={s.service_id}>
                        {s.service_name}: {(s.disruption_fraction * 100).toFixed(0)}% of 24 h down
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>No scenario disrupts a service.</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
      <ProvenanceNotice />
    </>
  )
}
