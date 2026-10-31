import { useState } from 'react'
import { ArrowRight, Route } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLatestRun } from '../../hooks/queries'
import { ProvenanceNotice, SimulationRequired } from '../../components/Simulation'
import { PageHeading, Panel, QueryState, RiskBadge, SectorBadge } from '../../components/ui'
import { percent } from '../../lib/risk'
import type { AssetSimulation, SimulationRun } from '../../api/client'

function History({ asset }: { asset: AssetSimulation }) {
  const h = asset.history
  const max = Math.max(...h.by_year.map((y) => y.cves_published), 1)
  return (
    <Panel
      title="Real vulnerability history of this product"
      aside={<span className="subtle-label">NVD + CISA KEV, up to the simulated date</span>}
      className="spaced-panel"
    >
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
        <p className="subtle-label">
          Bars: CVEs published per year for the product family (red = KEV additions that year).
        </p>
        <dl className="detail-grid">
          <dt>Product CVEs (all versions)</dt>
          <dd className="mono">{h.product_cves_total}</dd>
          <dt>Of those, KEV-listed</dt>
          <dd className="mono">
            {h.product_kev_listed}
            {h.first_kev_added && ` (first ${h.first_kev_added}, latest ${h.last_kev_added})`}
          </dd>
          <dt>Vendor KEV entries so far</dt>
          <dd className="mono">
            {h.vendor_kev_total} ({h.vendor_kev_last_90d} in the last 90 days)
          </dd>
          <dt>Vendor CVE volume so far</dt>
          <dd className="mono">{h.vendor_cve_total}</dd>
          <dt>Product KEV entries so far</dt>
          <dd className="mono">{h.product_kev_total}</dd>
        </dl>
        <p className="small muted">
          The vendor and product counts are exactly the history features the model was trained on.
        </p>
      </div>
    </Panel>
  )
}

function RunBacktest({ run }: { run: SimulationRun }) {
  const b = run.backtest
  if (!b) return null
  return (
    <Panel
      title={`Backtest at ${b.as_of}: what really happened next`}
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
        <p className="small muted">{b.note}</p>
      </div>
    </Panel>
  )
}

export default function Intelligence() {
  const latest = useLatestRun()
  const [selected, setSelected] = useState<string | null>(null)
  if (latest.isPending || latest.isError)
    return <QueryState pending={latest.isPending} error={latest.error} retry={latest.refetch} />
  const run = latest.data
  if (!run)
    return (
      <>
        <PageHeading
          title="Risk intelligence"
          description="Prioritization with a traceable reason behind every result."
        />
        <SimulationRequired />
      </>
    )
  const active = run.assets.find((a) => a.asset_id === selected) ?? run.assets[0]
  const m = active.matching
  return (
    <>
      <PageHeading
        title="Risk intelligence"
        description="Assets ranked by an ML-driven relative index, with the reason behind every score."
        actions={
          <Link className="button primary" to="/what-if">
            Continue to actions <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="split-layout spaced-panel">
        <Panel
          title="Risk-priority ranking"
          aside={<span className="badge neutral mono">{run.id}</span>}
        >
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
                    <span className="mono">{a.asset_id}</span> · {a.product.label}
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
                <div>
                  <strong>{percent(active.vulnerability_signal, 1)}</strong>
                  <small>S · ML vulnerability signal</small>
                </div>
                <div>
                  <strong>{active.exposure_factor.toFixed(2)}</strong>
                  <small>E · exposure factor</small>
                </div>
                <div>
                  <strong>{active.impact_factor.toFixed(2)}</strong>
                  <small>I′ · conditional impact</small>
                </div>
                <div>
                  <strong>{active.risk.score?.toFixed(1) ?? '—'}</strong>
                  <small>100 × S × E × I′</small>
                </div>
              </div>
              <div className="callout">
                <strong>Scenario assumption.</strong> This fictional asset is assumed to run{' '}
                <strong>{active.product.label}</strong> ({active.product.role}). Real NVD
                affected-version ranges were applied to that version:{' '}
                <strong>{m.version_confirmed}</strong> CVEs include it,{' '}
                <strong>{m.version_unknown}</strong> match the product but cannot be evaluated by
                version, and <strong>{m.excluded_by_version}</strong> were excluded because their
                ranges do not include it.
              </div>
              <h3 className="section-label">Why this score</h3>
              <ul className="list-plain">
                {(active.risk.factors ?? []).map((f) => (
                  <li key={f.name}>
                    <strong>{f.name}</strong> ({f.contribution.toFixed(2)}): {f.explanation}
                  </li>
                ))}
                {active.risk.status !== 'computed' && <li>{active.risk.unavailable_reason}</li>}
              </ul>
            </div>
          </Panel>
          <History asset={active} />
          <Panel
            title="Vulnerabilities that apply to this product version"
            aside={
              <span className="subtle-label">
                {active.candidate_count} applicable · {active.known_exploited_count} CISA-KEV-listed
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
                      <th>EPSS PCT</th>
                      <th>CVSS</th>
                      <th>WHAT HAPPENED NEXT</th>
                      <th>WHY (TOP DRIVERS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.top_vulnerabilities.map((v) => (
                      <tr key={v.cve_id}>
                        <td>
                          <span className="mono">{v.cve_id}</span>
                          <small className="muted">
                            {v.applicability === 'version_confirmed'
                              ? 'version in affected range'
                              : 'version not evaluable'}
                          </small>
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
                        <td className="small">
                          {v.outcome === 'added_to_kev'
                            ? `entered KEV ${v.outcome_date}`
                            : v.outcome === 'not_added_in_window'
                              ? 'not added within 180 days'
                              : v.outcome === 'window_open'
                                ? 'outcome not known yet'
                                : '—'}
                        </td>
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
                            : 'Known exploited: no model score needed'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel-padding">
                <p>
                  No CVE in the NVD data has an affected range that includes this version at this
                  date.
                  {!m.product_known && ' The product itself is not present in the NVD data.'}
                </p>
              </div>
            )}
            <div className="panel-footnote">
              ML rank = position among all not-yet-listed CVEs at {run.as_of}. Contributions are
              exact TreeSHAP values from the trained model.
            </div>
          </Panel>
          <RunBacktest run={run} />
          <Panel
            title="Worst plausible consequence"
            aside={<Route size={16} className="muted" />}
            className="spaced-panel"
          >
            <div className="panel-padding">
              {active.worst_scenario ? (
                <>
                  <p className="route">
                    Route: {active.worst_scenario.path.join(' → ')} (configured cyber reachability)
                  </p>
                  <p>
                    If {active.worst_scenario.target_asset_name} (
                    <span className="mono">{active.worst_scenario.target_asset_id}</span>) were
                    compromised with{' '}
                    <strong>{active.worst_scenario.effect.replaceAll('_', ' ')}</strong>, the
                    dependency model shows:
                  </p>
                  <ul className="list-plain">
                    {active.worst_scenario.services.map((s) => (
                      <li key={s.service_id}>
                        {s.service_name}: unsatisfied for {(s.disruption_fraction * 100).toFixed(0)}
                        % of a 24 h horizon
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>No reachable scenario disrupts a modelled service.</p>
              )}
              <p className="subtle-label">
                Reachability is a configured route, not a successful compromise. The effect is an
                assumption and results are an upper bound with respect to backups.
              </p>
            </div>
          </Panel>
        </div>
      </div>
      <div className="inset-note spaced-panel">{run.formula}</div>
      <ProvenanceNotice />
    </>
  )
}
