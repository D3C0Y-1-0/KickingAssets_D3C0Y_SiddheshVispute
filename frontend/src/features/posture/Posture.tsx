import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState, PageHeading, Panel, QueryState, SampleBadge } from '../../components/ui'
import { useActivity, useAssetActivity, useTrend } from '../../hooks/queries'
import '../insights/insights.css'

const axis = { fontSize: 11, fill: 'var(--text-muted)' }
const grid = 'var(--border-soft)'
const tooltipStyle = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
}
const monthLabel = (day: string) => day.slice(0, 7)
const dayLabel = (day: string) => day.slice(5)

function dotFor(props: { cx?: number; cy?: number; payload?: { anomalous?: boolean } }) {
  if (!props.payload?.anomalous || props.cx === undefined || props.cy === undefined) {
    return <g key={`${props.cx}-${props.cy}`} />
  }
  return (
    <circle
      key={`${props.cx}-${props.cy}`}
      cx={props.cx}
      cy={props.cy}
      r={3.5}
      fill="var(--risk-critical)"
    />
  )
}

function TrendPanels() {
  const trend = useTrend()
  const data = trend.data
  if (trend.isPending || trend.error) {
    return <QueryState pending={trend.isPending} error={trend.error} retry={trend.refetch} />
  }
  if (!data || data.status !== 'computed' || !data.points?.length) {
    return (
      <Panel title="City risk over time (monthly replay)">
        <EmptyState title="Trend not built" compact>
          {data?.unavailable_reason ?? 'No trend is available.'}
        </EmptyState>
      </Panel>
    )
  }
  const points = (data.points ?? []).map((p) => ({ ...p, month: monthLabel(p.as_of) }))
  const first = points[0]
  const last = points[points.length - 1]
  return (
    <>
      <div className="ins-grid">
        <Panel
          title="City risk over time (monthly replay)"
          aside={<span className="subtle-label mono">{data.scoring_version}</span>}
        >
          <div className="ins-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="month" tick={axis} interval={2} />
                <YAxis domain={[0, 100]} tick={axis} width={34} />
                <ReferenceLine y={60} stroke="var(--risk-critical)" strokeDasharray="3 4" />
                <ReferenceLine y={40} stroke="var(--risk-high)" strokeDasharray="3 4" />
                <ReferenceLine y={20} stroke="var(--risk-medium)" strokeDasharray="3 4" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [Number(value).toFixed(1), 'City index']}
                  labelFormatter={(label) => `As of ${label}-01`}
                />
                <Line
                  type="monotone"
                  dataKey="city_index"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: 'var(--accent)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="ins-note">
            {first.city_index} in {first.month} to {last.city_index} in {last.month}. Dashed lines
            mark the medium, high and critical bands. Full 0 to 100 scale, so movement is not
            exaggerated.
          </p>
        </Panel>
        <Panel title="Assets by band">
          <div className="ins-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="month" tick={axis} interval={2} />
                <YAxis tick={axis} width={34} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="critical" stackId="b" fill="var(--risk-critical)" name="Critical" />
                <Bar dataKey="high" stackId="b" fill="var(--risk-high)" name="High" />
                <Bar dataKey="medium" stackId="b" fill="var(--risk-medium)" name="Medium" />
                <Bar dataKey="low" stackId="b" fill="var(--risk-low)" name="Low" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="ins-note">
            Each month replays dated KEV/EPSS history with current NVD fields that may include later
            edits. Assets, assumed products and configuration are held fixed, so this shows the
            public vulnerability landscape moving against the estate, not changes to the estate.
            Model {data.model_version}; 2025 onward is the model&apos;s held-out period.
          </p>
        </Panel>
      </div>
    </>
  )
}

function AssetDetail({ id }: { id: string }) {
  const query = useAssetActivity(id)
  if (query.isPending || query.error) {
    return <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
  }
  const data = query.data
  return (
    <Panel
      title={`Metric detail: ${data.asset_name}`}
      aside={<SampleBadge>Simulated telemetry</SampleBadge>}
    >
      <div className="ins-grid" style={{ margin: 0, padding: 12 }}>
        {data.series.map((s) => (
          <div key={s.metric}>
            <div className="subtle-label" style={{ padding: '0 8px' }}>
              {s.label}
            </div>
            <div className="ins-chart small">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.points} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="day" tick={axis} tickFormatter={dayLabel} interval={6} />
                  <YAxis tick={axis} width={38} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [Number(value).toLocaleString(), String(name)]}
                  />
                  <Line
                    dataKey="baseline"
                    name="Baseline"
                    stroke="var(--text-muted)"
                    strokeDasharray="4 3"
                    dot={false}
                    strokeWidth={1.25}
                  />
                  <Line
                    dataKey="value"
                    name="Observed (simulated)"
                    stroke="var(--accent)"
                    strokeWidth={1.75}
                    dot={dotFor}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
      <p className="ins-note">
        Dashed line is the asset&apos;s own trailing 28-day median. Red points are days the detector
        flagged (z at or above 3.5).
      </p>
    </Panel>
  )
}

export default function Posture() {
  const activity = useActivity()
  const [selected, setSelected] = useState<string | null>(null)
  const report = activity.data
  useEffect(() => {
    if (report && selected === null) {
      const top = report.assets.find((a) => a.anomaly > 0)
      setSelected((top ?? report.assets[0])?.asset_id ?? null)
    }
  }, [report, selected])

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / TRENDS"
        title="Trends and activity"
        description="How the city risk index moves against the public vulnerability record, and which assets deviate from their own network baseline."
        actions={<SampleBadge>Simulated telemetry</SampleBadge>}
      />
      <TrendPanels />
      <QueryState pending={activity.isPending} error={activity.error} retry={activity.refetch} />
      {report && (
        <>
          <div className="ins-metrics">
            <div className="ins-metric">
              <div className="label">Activity index</div>
              <div className="value">{report.latest.index.toFixed(1)}</div>
              <div className="foot">
                <span className={`band-chip ${report.latest.band}`}>{report.latest.band}</span> on{' '}
                {report.latest.day}
              </div>
            </div>
            <div className="ins-metric">
              <div className="label">Assets off baseline</div>
              <div className="value">{report.latest.anomalous_assets}</div>
              <div className="foot">of {report.assets.length} with simulated telemetry</div>
            </div>
            <div className="ins-metric">
              <div className="label">Detector</div>
              <div className="value" style={{ fontSize: 16, paddingTop: 8 }}>
                {report.detector_version}
              </div>
              <div className="foot">robust z-score, 28-day baseline</div>
            </div>
            <div className="ins-metric">
              <div className="label">Urgency</div>
              <div className="value" style={{ fontSize: 16, paddingTop: 8 }}>
                {report.urgency_available ? 'Available' : 'Needs a simulation'}
              </div>
              <div className="foot">risk x (1 + 0.5 x anomaly)</div>
            </div>
          </div>
          <div className="ins-grid">
            <Panel title="Simulated network activity index, daily">
              <div className="ins-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={report.series}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="day" tick={axis} tickFormatter={dayLabel} interval={4} />
                    <YAxis domain={[0, 100]} tick={axis} width={34} />
                    <ReferenceLine y={40} stroke="var(--risk-critical)" strokeDasharray="3 4" />
                    <ReferenceLine y={15} stroke="var(--risk-medium)" strokeDasharray="3 4" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [Number(value).toFixed(1), 'Activity index']}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="index"
                      stroke="var(--risk-high)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="ins-note">
                Dashed lines: elevated at 15, active at 40. The index combines asset anomaly scores,
                scaled by criticality, so one strongly anomalous essential asset can raise it.
              </p>
            </Panel>
            <Panel title="Authored scenario events">
              <ul className="ins-events">
                {report.events.map((e) => (
                  <li key={e.id}>
                    <strong>{e.title}</strong>{' '}
                    <span className={`ins-tag ${e.benign ? 'benign' : 'hot'}`}>
                      {e.benign ? 'benign' : 'malicious'}
                    </span>
                    <div className="when">
                      {e.asset_id} · {e.start === e.end ? e.start : `${e.start} to ${e.end}`}
                    </div>
                    <span className="ins-sub">{e.description}</span>
                  </li>
                ))}
              </ul>
              <p className="ins-note">
                These events are part of the simulation, written to exercise the detector. The
                benign one shows that statistical detection also flags planned changes.
              </p>
            </Panel>
          </div>
          <div className="ins-grid single">
            <Panel
              title="Assets deviating from their own baseline"
              aside={<span className="subtle-label">as of {report.latest.day}</span>}
            >
              {report.assets.every((a) => a.anomaly === 0) ? (
                <EmptyState title="No deviations" compact>
                  No asset is off its own baseline on this day.
                </EmptyState>
              ) : (
                <div className="table-scroll">
                  <table className="ins-table">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Anomaly</th>
                        <th>Days</th>
                        <th>Why it was flagged</th>
                        <th className="num">Risk</th>
                        <th className="num">Urgency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.assets
                        .filter((a) => a.anomaly > 0)
                        .map((a) => (
                          <tr
                            key={a.asset_id}
                            className="selectable"
                            aria-selected={selected === a.asset_id}
                            onClick={() => setSelected(a.asset_id)}
                          >
                            <td>
                              <button
                                className="text-link"
                                aria-label={`View activity for ${a.asset_id}`}
                                onClick={() => setSelected(a.asset_id)}
                              >
                                {a.asset_name}
                              </button>
                              <span className="ins-sub mono">{a.asset_id}</span>
                            </td>
                            <td>
                              <span className="ins-bar">
                                <span className="track">
                                  <i
                                    className={a.anomaly >= 0.6 ? 'full' : ''}
                                    style={{ width: `${a.anomaly * 100}%` }}
                                  />
                                </span>
                                <span className="mono">{a.anomaly.toFixed(2)}</span>
                              </span>
                            </td>
                            <td className="num">{a.consecutive_days}</td>
                            <td>
                              {a.reasons.map((r) => (
                                <span className="ins-sub" key={r.metric} style={{ marginTop: 0 }}>
                                  {r.label}: {r.observed.toLocaleString()} vs{' '}
                                  {Math.round(r.baseline).toLocaleString()} typical (z{' '}
                                  {r.z_score.toFixed(1)})
                                </span>
                              ))}
                            </td>
                            <td className="num">
                              {a.risk_score === null ? 'n/a' : a.risk_score?.toFixed(1)}
                            </td>
                            <td className="num">
                              {a.urgency === null ? 'n/a' : a.urgency?.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="ins-note">{report.urgency_note}</p>
            </Panel>
          </div>
          {selected && (
            <div className="ins-grid single">
              <AssetDetail id={selected} />
            </div>
          )}
          <details className="ins-fine">
            <summary>Assumptions and method</summary>
            <ul>
              {report.assumptions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </>
  )
}
