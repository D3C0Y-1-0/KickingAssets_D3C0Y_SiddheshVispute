import { useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Database,
  Droplets,
  HeartPulse,
  Network,
  ShieldAlert,
  Waypoints,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useAssets, useLatestRun, useServices } from '../../hooks/queries'
import { AssetDrawer } from '../../components/AssetDrawer'
import { ProvenanceNotice, RunSimulationButton } from '../../components/Simulation'
import {
  EmptyState,
  PageHeading,
  Panel,
  QueryState,
  RiskBadge,
  SectorBadge,
  sectorName,
  TextLink,
} from '../../components/ui'
import { categoryLabels } from '../../lib/risk'
import type { Sector } from '../../api/client'
import Station from '../../components/illustration/Station'

const sectorIcons = { power: Zap, water: Droplets, healthcare: HeartPulse }

export default function Overview() {
  const assets = useAssets()
  const services = useServices()
  const latest = useLatestRun()
  const [sector, setSector] = useState<Sector>('power')
  const [selected, setSelected] = useState<string | null>(null)
  if (assets.isPending || assets.isError)
    return <QueryState pending={assets.isPending} error={assets.error} retry={assets.refetch} />
  const rows = assets.data
  const run = latest.data ?? null
  const sectorCount = new Set(rows.map((a) => a.sector)).size
  const counts = Object.fromEntries((run?.category_counts ?? []).map((c) => [c.category, c.count]))
  const distribution = categoryLabels.map((name) => ({ name, value: counts[name] ?? 0 }))
  const index = run?.city_risk.score ?? null
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / COMMAND CENTER"
        title="Command overview"
        description="Simulate, assess with the ML model, then act. Every score below is computed from real vulnerability data."
        actions={
          <>
            <RunSimulationButton label={run ? 'Re-run simulation' : 'Run simulation'} />
            <Link to="/infrastructure" className="button secondary">
              <Network size={16} />
              Explore infrastructure
              <ArrowUpRight size={14} />
            </Link>
          </>
        }
      />
      <div className="workflow-steps">
        <section className={`workflow-step ${run ? 'done' : ''}`}>
          <span className="step-number">STEP 1 · SIMULATE</span>
          <h3>Fetch vulnerabilities for every asset</h3>
          <p>
            Each asset is mapped to a real product family, its recent CVEs are pulled from NVD and
            scored live by the trained model.
          </p>
          <div className="step-actions">
            <RunSimulationButton
              variant={run ? 'secondary' : 'primary'}
              label={run ? 'Re-run' : 'Run simulation'}
            />
            {run && <span className="subtle-label mono">{run.id}</span>}
          </div>
        </section>
        <section className={`workflow-step ${run ? 'done' : ''}`}>
          <span className="step-number">STEP 2 · ASSESS</span>
          <h3>ML-scored risk and its reasons</h3>
          <p>
            Vulnerability signal × exposure × conditional service impact, with the drivers behind
            every CVE.
          </p>
          <div className="step-actions">
            {run ? (
              <Link className="button secondary" to="/intelligence">
                Open risk intelligence <ArrowRight size={14} />
              </Link>
            ) : (
              <span className="subtle-label">Needs step 1</span>
            )}
            <Link className="text-link" to="/ml">
              ML Lab
            </Link>
          </div>
        </section>
        <section className="workflow-step">
          <span className="step-number">STEP 3 · ACT</span>
          <h3>Preventive actions and projected effect</h3>
          <p>
            Patch prioritization, segmentation, access control, monitoring and incident-response
            planning, with a greedy plan.
          </p>
          <div className="step-actions">
            {run ? (
              <>
                <Link className="button secondary" to="/what-if">
                  What-if <ArrowRight size={14} />
                </Link>
                <Link className="button secondary" to="/remediation">
                  Remediation plan <ArrowRight size={14} />
                </Link>
              </>
            ) : (
              <span className="subtle-label">Needs step 1</span>
            )}
          </div>
        </section>
      </div>
      <div className="metric-grid">
        <section className="metric-card city-risk">
          <div className="metric-label">
            City Risk Index
            <ShieldAlert size={16} />
          </div>
          <div className="metric-value">
            {index == null ? '—' : index.toFixed(1)}
            <span>/ 100</span>
            {run?.city_risk.category && (
              <span className={`risk-badge ${run.city_risk.category}`}>
                {run.city_risk.category}
              </span>
            )}
          </div>
          <div className="risk-scale">
            <i style={{ width: `${index ?? 0}%` }} />
          </div>
          <div className="metric-foot">
            {run ? (
              <span>
                Computed · {run.city_risk.scoring_version} · relative index, not a probability
              </span>
            ) : (
              <span>Not simulated yet</span>
            )}
          </div>
        </section>
        <section className="metric-card">
          <div className="metric-label">
            Infrastructure assets
            <Database size={16} />
          </div>
          <div className="metric-value">
            {rows.length.toString().padStart(2, '0')}
            <span className="metric-unit">assets</span>
          </div>
          <div className="metric-foot">
            <span className="mint-dot" />
            {run
              ? `${run.assets.reduce((n, a) => n + a.candidate_count, 0).toLocaleString()} candidate CVE pairs scored`
              : 'Loaded from scenario inventory'}
          </div>
        </section>
        <section className="metric-card">
          <div className="metric-label">
            Connected sectors
            <Waypoints size={16} />
          </div>
          <div className="metric-value">
            {sectorCount.toString().padStart(2, '0')}
            <div className="sector-mini-icons">
              <Zap size={14} />
              <Droplets size={14} />
              <HeartPulse size={14} />
            </div>
          </div>
          <div className="metric-foot">Power, water & healthcare</div>
        </section>
        <section className="metric-card">
          <div className="metric-label">
            Essential services
            <HeartPulse size={16} />
          </div>
          <div className="metric-value">
            {services.data?.length.toString().padStart(2, '0') ?? '—'}
            <span className="metric-unit">defined</span>
          </div>
          <div className="metric-foot">
            {services.isError
              ? 'Service API unavailable'
              : run
                ? `${run.services.filter((s) => s.worst_disruption_fraction > 0).length} with a plausible disruption`
                : 'Not simulated yet'}
          </div>
        </section>
      </div>
      <div className="overview-middle">
        <Panel
          title={
            <>
              <span className="panel-dot" />
              Infrastructure at a glance
            </>
          }
          aside={<span className="subtle-label mono">AURORA / BASELINE V1</span>}
          className="infrastructure-panel"
        >
          <div className="infrastructure-body">
            <div className="infrastructure-copy">
              <div className="eyebrow">ONE CITY. THREE ESSENTIAL SYSTEMS.</div>
              <h3>
                Understand the connections.
                <br />
                <span>Before they become consequences.</span>
              </h3>
              <p>
                Explore the assets behind Aurora City’s essential services, and the relationships
                that connect them.
              </p>
              <div className="sector-tabs" aria-label="Illustration sector focus">
                {(['power', 'water', 'healthcare'] as const).map((s) => {
                  const Icon = sectorIcons[s]
                  return (
                    <button
                      key={s}
                      aria-pressed={sector === s}
                      className={sector === s ? 'selected' : ''}
                      onClick={() => setSector(s)}
                    >
                      <Icon size={15} />
                      {sectorName[s]}
                    </button>
                  )
                })}
              </div>
              <Link to={`/infrastructure?sector=${sector}`} className="text-link">
                Open infrastructure map
                <ArrowRight size={15} />
              </Link>
            </div>
            <Station sector={sector} />
          </div>
          <div className="infrastructure-bottom">
            <span>
              <span className="status-dot" />
              {rows.filter((a) => a.sector === sector).length} {sectorName[sector].toLowerCase()}{' '}
              assets in the scenario
            </span>
            <span>Illustration · no telemetry</span>
          </div>
        </Panel>
        <Panel title="Risk distribution" className="distribution-panel">
          {run ? (
            <>
              <div className="risk-donut">
                <ResponsiveContainer width="100%" height={154}>
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      innerRadius={54}
                      outerRadius={67}
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={5}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {distribution.map((d) => (
                        <Cell key={d.name} fill={`var(--risk-${d.name})`} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                      formatter={(v) => [`${v} assets`, 'Computed']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>{run.assets.length}</strong>
                  <small>ASSETS SCORED</small>
                </div>
              </div>
              <div className="distribution-legend">
                {distribution.map((d) => (
                  <div key={d.name}>
                    <span>
                      <i className={`legend-dot ${d.name}`} />
                      {d.name}
                    </span>
                    <strong className="mono">{d.value.toString().padStart(2, '0')}</strong>
                  </div>
                ))}
              </div>
              <div className="panel-footnote">Bands: critical ≥ 60, high ≥ 40, medium ≥ 20.</div>
            </>
          ) : (
            <EmptyState compact title="No assessment yet">
              Run the simulation to score every asset.
            </EmptyState>
          )}
        </Panel>
      </div>
      <div className="overview-bottom">
        <Panel
          title="Priority assets"
          aside={
            <div className="inline-items">
              <TextLink to="/intelligence">Risk intelligence</TextLink>
            </div>
          }
          className="priority-panel"
        >
          {run ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ASSET / IDENTIFIER</th>
                    <th>SECTOR</th>
                    <th>RISK</th>
                    <th>SCORE</th>
                    <th>MAIN DRIVER</th>
                  </tr>
                </thead>
                <tbody>
                  {run.assets.slice(0, 6).map((asset) => {
                    const category = asset.risk.category
                    const driver = asset.top_vulnerabilities[0]
                    return (
                      <tr key={asset.asset_id}>
                        <td>
                          <button
                            className="asset-name"
                            onClick={() => setSelected(asset.asset_id)}
                          >
                            {asset.name}
                          </button>
                          <small className="mono muted">{asset.asset_id}</small>
                        </td>
                        <td>
                          <SectorBadge sector={asset.sector} />
                        </td>
                        <td>
                          <RiskBadge category={category} />
                        </td>
                        <td>
                          <div className="score-cell">
                            <span className="mono">{asset.risk.score?.toFixed(1)}</span>
                            <span className="score-track">
                              <i
                                style={{
                                  width: `${asset.risk.score ?? 0}%`,
                                  background: `var(--risk-${category})`,
                                }}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="small">
                          {driver ? (
                            <>
                              <span className="mono">{driver.cve_id}</span>
                              <small className="muted">
                                {driver.status === 'kev_listed'
                                  ? ' known exploited (CISA KEV)'
                                  : ` ML top ${(100 - (driver.priority_percentile ?? 0) * 100).toFixed(1)}%`}
                              </small>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState compact title="No ranking yet">
              Assets are ranked by their computed score after a simulation.
            </EmptyState>
          )}
        </Panel>
        <Panel
          title="Essential services"
          aside={<TextLink to="/infrastructure?mode=operational">Dependencies</TextLink>}
        >
          <QueryState
            pending={services.isPending}
            error={services.error}
            retry={services.refetch}
          />
          <div className="services-list">
            {services.data?.map((service) => {
              const Icon = sectorIcons[service.sector]
              const risk = run?.services.find((s) => s.service_id === service.id)
              return (
                <Link
                  className="service-item"
                  key={service.id}
                  to={`/infrastructure?mode=operational&sector=${service.sector}`}
                >
                  <span className={`service-icon ${service.sector}`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{service.name}</strong>
                    <small>
                      {risk
                        ? `Worst plausible disruption ${(risk.worst_disruption_fraction * 100).toFixed(0)}% of 24 h (upper bound)`
                        : `${service.requirements.length} requirement groups · Scenario definition`}
                    </small>
                  </div>
                  <ArrowUpRight size={14} />
                </Link>
              )
            })}
          </div>
          <div className="inset-note small-note">
            Conditional on assumed compromise effects, with redundancy and backups applied; not a
            forecast and not monitored status.
          </div>
        </Panel>
      </div>
      <Panel
        title="Last simulation"
        aside={
          <span className="subtle-label">
            <Clock3 size={13} />
            {run ? new Date(run.created_at).toLocaleString('en-GB') : 'NOT RUN'}
          </span>
        }
        className="history-panel"
      >
        {run ? (
          <ol className="stage-list">
            {run.stages.map((s) => (
              <li key={s.name}>
                <span>
                  <strong>{s.name}</strong>
                  <small>{s.detail}</small>
                </span>
                <span className="mono muted">{s.seconds.toFixed(2)} s</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState compact title="No simulation yet">
            Press Run simulation. The stages and timings of the run will be listed here.
          </EmptyState>
        )}
      </Panel>
      <ProvenanceNotice />
      <AssetDrawer id={selected} onClose={() => setSelected(null)} />
    </>
  )
}
