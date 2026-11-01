import { useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
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
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useActivity, useAssets, useLatestRun, useServices, useTrend } from '../../hooks/queries'
import { AssetDrawer } from '../../components/AssetDrawer'
import { CyclingEncryptedText } from '../../components/CyclingEncryptedText'
import { AsOfSelect, ProvenanceNotice, RunSimulationButton } from '../../components/Simulation'
import {
  EmptyState,
  Panel,
  QueryState,
  RiskBadge,
  SectorBadge,
  sectorName,
  TextLink,
} from '../../components/ui'
import { categoryLabels } from '../../lib/risk'
import { useCardTilt } from '../../lib/useCardTilt'
import type { Sector } from '../../api/client'
import Station from '../../components/illustration/Station'
import { ActivityHeatmap } from './ActivityHeatmap'
import { RiskArcGauge } from './RiskArcGauge'

const sectorIcons = { power: Zap, water: Droplets, healthcare: HeartPulse }
const heroHeadlines = [
  'See the Risk. Understand the Impact.',
  'Uncover Threats Before They Escalate.',
  'Explore Every Connection. Expose Every Weakness.',
  'Simulate the Future. Strengthen the Defense.',
]

export default function Overview() {
  const assets = useAssets()
  const services = useServices()
  const latest = useLatestRun()
  const trend = useTrend()
  const activity = useActivity()
  const [sector, setSector] = useState<Sector>('power')
  const [selected, setSelected] = useState<string | null>(null)
  const [asOf, setAsOf] = useState('')
  const heroTilt = useCardTilt<HTMLElement>()
  const railTilt = useCardTilt<HTMLElement>()
  const cityRiskTilt = useCardTilt<HTMLElement>()
  const assetsTilt = useCardTilt<HTMLElement>()
  const sectorsTilt = useCardTilt<HTMLElement>()
  const servicesTilt = useCardTilt<HTMLElement>()
  const trendTilt = useCardTilt<HTMLElement>()
  const activityTilt = useCardTilt<HTMLElement>()
  const infraTilt = useCardTilt<HTMLElement>()
  const distributionTilt = useCardTilt<HTMLElement>()
  const priorityTilt = useCardTilt<HTMLElement>()
  const orbTilt = useCardTilt<HTMLDivElement>()
  const gaugeTilt = useCardTilt<HTMLDivElement>()
  const essentialTilt = useCardTilt<HTMLElement>()
  if (assets.isPending || assets.isError)
    return <QueryState pending={assets.isPending} error={assets.error} retry={assets.refetch} />
  const rows = assets.data
  const run = latest.data ?? null
  const sectorCount = new Set(rows.map((a) => a.sector)).size
  const counts = Object.fromEntries((run?.category_counts ?? []).map((c) => [c.category, c.count]))
  const distribution = categoryLabels.map((name) => ({ name, value: counts[name] ?? 0 }))
  const index = run?.city_risk.score ?? null
  const trendPoints = trend.data?.points ?? []
  const trendValues = trendPoints.map((p) => p.city_index).filter((v): v is number => v != null)
  const trendMin = trendValues.length ? Math.min(...trendValues) : 0
  const trendMax = trendValues.length ? Math.max(...trendValues) : 100
  const trendPad = Math.max(2, (trendMax - trendMin) * 0.25)
  const trendStep = 5
  const trendDomain: [number, number] = [
    Math.max(0, Math.floor((trendMin - trendPad) / trendStep) * trendStep),
    Math.min(100, Math.ceil((trendMax + trendPad) / trendStep) * trendStep),
  ]
  const topCritical = run?.assets.filter((a) => a.risk.category === 'critical') ?? []

  return (
    <>
      <div className="ov-hero-row">
        <section
          className="panel glow-card card-fx ov-greeting"
          ref={heroTilt.ref}
          onMouseMove={heroTilt.onMouseMove}
          onMouseLeave={heroTilt.onMouseLeave}
        >
          <div className="ov-greeting-top">
            <div>
              <h1>
                <CyclingEncryptedText
                  lines={heroHeadlines}
                  intervalMs={5000}
                  revealDelayMs={35}
                  flipDelayMs={40}
                  encryptedClassName="ov-greeting-scramble"
                  revealedClassName="ov-greeting-revealed"
                />
              </h1>
              <p>
                See how risky Aurora City is, which assets need attention first, and what to fix.
                Every score below is computed from real vulnerability data, not a mock-up.
              </p>
            </div>
          </div>
          <div className="ov-greeting-actions">
            <AsOfSelect value={asOf} onChange={setAsOf} />
            <RunSimulationButton
              asOf={asOf || undefined}
              label={run ? 'Re-run simulation' : 'Run simulation'}
            />
            <Link to="/infrastructure" className="button secondary">
              <Network size={16} />
              Explore infrastructure
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        <aside
          className="ov-rail glow-card card-fx"
          aria-label="What's next"
          ref={railTilt.ref}
          onMouseMove={railTilt.onMouseMove}
          onMouseLeave={railTilt.onMouseLeave}
        >
          <div className="ov-rail-head">
            <span>{run ? 'Needs attention' : "What's next"}</span>
            <small>{run ? `as of ${run.as_of}` : 'No run yet'}</small>
          </div>
          {!run && (
            <div className="ov-rail-item pending">
              <span className="ov-rail-dot" />
              <div>
                <strong>Run the simulation</strong>
                <small>Scores every asset from real vulnerability data</small>
              </div>
            </div>
          )}
          {run &&
            topCritical.slice(0, 3).map((a) => (
              <button
                key={a.asset_id}
                className="ov-rail-item critical"
                onClick={() => setSelected(a.asset_id)}
              >
                <span className="ov-rail-dot" />
                <div>
                  <strong>{a.name}</strong>
                  <small>
                    {a.asset_id} · {a.risk.score?.toFixed(1)} critical
                  </small>
                </div>
              </button>
            ))}
          {run && topCritical.length === 0 && (
            <div className="ov-rail-item">
              <span className="ov-rail-dot" />
              <div>
                <strong>Nothing critical right now</strong>
                <small>No asset is in the critical band</small>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="metric-grid">
        <section
          className="metric-card glow-card card-fx city-risk"
          ref={cityRiskTilt.ref}
          onMouseMove={cityRiskTilt.onMouseMove}
          onMouseLeave={cityRiskTilt.onMouseLeave}
        >
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
        <section
          className="metric-card glow-card card-fx"
          ref={assetsTilt.ref}
          onMouseMove={assetsTilt.onMouseMove}
          onMouseLeave={assetsTilt.onMouseLeave}
        >
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
        <section
          className="metric-card glow-card card-fx"
          ref={sectorsTilt.ref}
          onMouseMove={sectorsTilt.onMouseMove}
          onMouseLeave={sectorsTilt.onMouseLeave}
        >
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
        <section
          className="metric-card glow-card card-fx"
          ref={servicesTilt.ref}
          onMouseMove={servicesTilt.onMouseMove}
          onMouseLeave={servicesTilt.onMouseLeave}
        >
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
              Risk trend
            </>
          }
          aside={<span className="subtle-label mono">MONTHLY · HELD-OUT TEST</span>}
          className="card-fx ov-trend-panel"
          cardRef={trendTilt.ref}
          onMouseMove={trendTilt.onMouseMove}
          onMouseLeave={trendTilt.onMouseLeave}
        >
          {trendPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <AreaChart data={trendPoints} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="as_of"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(2, 7)}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={trendDomain}
                  ticks={[
                    trendDomain[0],
                    Math.round((trendDomain[0] + trendDomain[1]) / 2),
                    trendDomain[1],
                  ]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as (typeof trendPoints)[number]
                    return (
                      <div className="chart-tip">
                        <strong>{label}</strong>
                        <div className="chart-tip-row">
                          <i style={{ background: 'var(--accent)' }} />
                          City index {p.city_index?.toFixed(1) ?? '—'} · {p.category ?? 'n/a'}
                        </div>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="city_index"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#trendFill)"
                  isAnimationActive={false}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : trend.isError ? (
            <EmptyState compact title="Trend unavailable">
              Posture trend could not be loaded for this scenario.
            </EmptyState>
          ) : (
            <EmptyState compact title="No trend yet">
              Computed once enough historical snapshots are scored.
            </EmptyState>
          )}
          <div className="panel-footnote">
            City risk index over time on held-out test snapshots; a relative index (0-100), not a
            probability of an incident. The axis is zoomed to the observed range ({trendDomain[0]}-
            {trendDomain[1]}) to make real month-to-month movement visible.
          </div>
        </Panel>
        <Panel
          title="Weekly activity"
          aside={<span className="subtle-label mono">14 DAYS</span>}
          className="card-fx"
          cardRef={activityTilt.ref}
          onMouseMove={activityTilt.onMouseMove}
          onMouseLeave={activityTilt.onMouseLeave}
        >
          {activity.data ? (
            <ActivityHeatmap series={activity.data.series} />
          ) : activity.isError ? (
            <EmptyState compact title="Activity unavailable">
              Could not load the simulated network activity signal.
            </EmptyState>
          ) : (
            <EmptyState compact title="Loading activity…">
              Simulated anomaly signal across the scenario window.
            </EmptyState>
          )}
        </Panel>
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
          className="card-fx infrastructure-panel"
          cardRef={infraTilt.ref}
          onMouseMove={infraTilt.onMouseMove}
          onMouseLeave={infraTilt.onMouseLeave}
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
        <Panel
          title="Risk distribution"
          className="card-fx distribution-panel"
          cardRef={distributionTilt.ref}
          onMouseMove={distributionTilt.onMouseMove}
          onMouseLeave={distributionTilt.onMouseLeave}
        >
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
          className="card-fx priority-panel"
          cardRef={priorityTilt.ref}
          onMouseMove={priorityTilt.onMouseMove}
          onMouseLeave={priorityTilt.onMouseLeave}
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
        <div className="ov-side-stack">
          <div
            className="orb-card glow-card card-fx"
            ref={orbTilt.ref}
            onMouseMove={orbTilt.onMouseMove}
            onMouseLeave={orbTilt.onMouseLeave}
          >
            <div className="orb-ring">
              <BrainCircuit size={28} />
            </div>
            <h3>AI risk model</h3>
            <p>See the trained model's accuracy, drivers and limitations.</p>
            <Link className="button primary" to="/ml">
              Open AI model
            </Link>
          </div>
          <div
            className="panel glow-card card-fx"
            style={{ padding: '18px 20px' }}
            ref={gaugeTilt.ref}
            onMouseMove={gaugeTilt.onMouseMove}
            onMouseLeave={gaugeTilt.onMouseLeave}
          >
            <RiskArcGauge value={index} category={run?.city_risk.category ?? null} />
          </div>
        </div>
      </div>

      <div className="overview-bottom">
        <Panel
          title="Essential services"
          aside={<TextLink to="/infrastructure?mode=operational">Dependencies</TextLink>}
          className="card-fx"
          cardRef={essentialTilt.ref}
          onMouseMove={essentialTilt.onMouseMove}
          onMouseLeave={essentialTilt.onMouseLeave}
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

      <details className="stage-details">
        <summary>Technical details of the last run</summary>
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
      </details>

      <details className="how-it-works" open={!run}>
        <summary>How it works in three steps</summary>
        <div className="workflow-steps">
          <section className={`workflow-step ${run ? 'done' : ''}`}>
            <span className="step-number">STEP 1 · SIMULATE</span>
            <h3>Find the weaknesses</h3>
            <p>
              Each asset is assumed to run a real product version. The public list of known flaws
              shows which ones apply, and the trained model scores them.
            </p>
            <div className="step-actions">
              <RunSimulationButton
                asOf={asOf || undefined}
                variant={run ? 'secondary' : 'primary'}
                label={run ? 'Re-run' : 'Run simulation'}
              />
              {run && <span className="subtle-label mono">{run.id}</span>}
            </div>
          </section>
          <section className={`workflow-step ${run ? 'done' : ''}`}>
            <span className="step-number">STEP 2 · ASSESS</span>
            <h3>Score the risk and see why</h3>
            <p>
              How likely a flaw is to be attacked, how exposed the asset is, and how many services
              would stop. Every score shows its reasons.
            </p>
            <div className="step-actions">
              {run ? (
                <Link className="button secondary" to="/intelligence">
                  Open risk ranking <ArrowRight size={14} />
                </Link>
              ) : (
                <span className="subtle-label">Needs step 1</span>
              )}
              <Link className="text-link" to="/ml">
                AI model
              </Link>
            </div>
          </section>
          <section className="workflow-step">
            <span className="step-number">STEP 3 · ACT</span>
            <h3>Plan the fixes</h3>
            <p>
              Which updates and access changes cut the most risk for the least effort. These are
              estimates.
            </p>
            <div className="step-actions">
              {run ? (
                <>
                  <Link className="button secondary" to="/defend">
                    Attack &amp; defend <ArrowRight size={14} />
                  </Link>
                  <Link className="button secondary" to="/what-if">
                    What-if <ArrowRight size={14} />
                  </Link>
                  <Link className="button secondary" to="/remediation">
                    Fix plan <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <span className="subtle-label">Needs step 1</span>
              )}
            </div>
          </section>
        </div>
      </details>
      <ProvenanceNotice />
      <AssetDrawer id={selected} onClose={() => setSelected(null)} />
    </>
  )
}
