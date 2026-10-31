import { useState } from 'react'
import { ArrowRight, Route } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLatestRun } from '../../hooks/queries'
import { ProvenanceNotice, SimulationRequired } from '../../components/Simulation'
import { PageHeading, Panel, QueryState, RiskBadge, SectorBadge } from '../../components/ui'
import { percent } from '../../lib/risk'

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
      <div className="split-layout">
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
                    <span className="mono">{a.asset_id}</span> · {a.profile.label}
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
                {active.profile.label} ({active.profile.vendors.join(', ')}
                {active.profile.product_filters.length
                  ? `; ${active.profile.product_filters.join(', ')}`
                  : ''}
                ). {active.profile.rationale} The real CVEs below are candidates for that family;
                versions are not matched.
              </div>
              <h3 className="section-label">Why this score</h3>
              <ul className="list-plain">
                {(active.risk.factors ?? []).map((f) => (
                  <li key={f.name}>
                    <strong>{f.name}</strong> ({f.contribution.toFixed(2)}): {f.explanation}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
          <Panel
            title="Vulnerabilities fetched for this asset"
            aside={
              <span className="subtle-label">
                {active.candidate_count} candidates · {active.known_exploited_count} CISA-KEV-listed
              </span>
            }
            className="spaced-panel"
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>CVE</th>
                    <th>STATUS</th>
                    <th>ML RANK</th>
                    <th>EPSS PCT</th>
                    <th>CVSS</th>
                    <th>WHY (TOP DRIVERS)</th>
                  </tr>
                </thead>
                <tbody>
                  {active.top_vulnerabilities.map((v) => (
                    <tr key={v.cve_id}>
                      <td className="mono">{v.cve_id}</td>
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
                          : 'Known exploited: no model score needed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-footnote">
              ML rank = position among all not-yet-listed CVEs at {run.as_of}. Contributions are
              exact TreeSHAP values from the trained model.
            </div>
          </Panel>
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
