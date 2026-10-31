import { Link } from 'react-router-dom'
import { Check, CircleDashed, Loader2, Play, TriangleAlert } from 'lucide-react'
import { api } from '../../api/client'
import { PageHeading, Panel, SampleBadge } from '../../components/ui'
import { useLiveSimulation, type LiveStep } from '../../hooks/liveSimulation'
import '../insights/insights.css'
import './live.css'

function StepIcon({ status }: { status: LiveStep['status'] }) {
  if (status === 'running') return <Loader2 size={20} className="spin" aria-label="Running" />
  if (status === 'done') return <Check size={20} aria-label="Done" />
  if (status === 'error') return <TriangleAlert size={20} aria-label="Failed" />
  return <CircleDashed size={20} aria-label="Waiting" />
}

export default function LiveSimulation() {
  const { steps, results, running, log, start, context } = useLiveSimulation()
  const { run, activity, chokepoints, vendors, plan } = results
  const finished = steps.every((s) => s.status === 'done')
  const failed = steps.some((s) => s.status === 'error')
  const weak = chokepoints?.chokepoints.filter((c) => c.is_chokepoint).slice(0, 5) ?? []
  const topAssets = [...(run?.assets ?? [])]
    .filter((a) => a.risk.score != null)
    .sort((a, b) => (b.risk.score ?? 0) - (a.risk.score ?? 0))
    .slice(0, 5)
  const topVendors = vendors?.vendors.slice(0, 4) ?? []
  const odd = activity?.assets.filter((a) => a.anomaly > 0).slice(0, 5) ?? []

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / LIVE"
        title="Live simulation"
        description="Press start and watch every part of the system do its job, one step at a time. Each step calls the real server."
        actions={
          <button className="button primary" onClick={() => void start()} disabled={running}>
            {running ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
            {running ? 'Running…' : finished ? 'Run again' : 'Start simulation'}
          </button>
        }
      />
      <div className="live-grid">
        <Panel title="What is happening" aside={<SampleBadge>Simulated city</SampleBadge>}>
          <ol className="live-steps" aria-live="polite">
            {steps.map((s, i) => (
              <li key={s.id} className={`live-step ${s.status}`}>
                <span className="live-icon">
                  <StepIcon status={s.status} />
                </span>
                <div>
                  <div className="live-title">
                    {i + 1}. {s.label}
                    {s.ms !== undefined && (
                      <span className="live-time">{(s.ms / 1000).toFixed(1)} s</span>
                    )}
                  </div>
                  <div className="live-explain">{s.explain}</div>
                  {s.summary && <div className="live-result">{s.summary}</div>}
                </div>
              </li>
            ))}
          </ol>
          {failed && (
            <p className="live-warning">
              A step failed, so the run stopped. The server may still be waking up; try again in a
              minute.
            </p>
          )}
        </Panel>
        <Panel title="Server log" aside={<span className="subtle-label">live</span>}>
          <pre className="live-log" aria-label="Server log">
            {log.length ? log.join('\n') : 'Nothing yet. Press Start simulation.'}
          </pre>
          <p className="ins-note">
            The first run on a cold server can take about a minute. Later runs take around ten
            seconds.
          </p>
        </Panel>
      </div>

      {run && (
        <div className="ins-grid">
          <Panel title="Riskiest assets">
            <ul className="live-list">
              {topAssets.map((a) => (
                <li key={a.asset_id}>
                  <Link className="text-link" to="/assets">
                    {a.asset_id}
                  </Link>
                  <span className="mono">{a.risk.score?.toFixed(1)}</span>
                  <span className={`badge ${a.risk.category === 'critical' ? 'sample' : 'neutral'}`}>
                    {a.risk.category}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          {odd.length > 0 && (
            <Panel
              title="Assets behaving oddly"
              aside={<SampleBadge>Simulated traffic</SampleBadge>}
            >
              <ul className="live-list">
                {odd.map((a) => (
                  <li key={a.asset_id}>
                    <span>{a.asset_name}</span>
                    <span className="mono">{Math.round(a.anomaly * 100)}% unusual</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
      {(weak.length > 0 || topVendors.length > 0) && (
        <div className="ins-grid">
          <Panel title="Single points of failure">
            <ul className="live-list">
              {weak.map((c) => (
                <li key={c.asset_id}>
                  <span>{c.asset_name}</span>
                  <span className="muted">
                    {c.worst?.services_fully_disrupted.length ?? 0} service(s) stop
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Riskiest suppliers" aside={<SampleBadge>Assumed what-if</SampleBadge>}>
            <ul className="live-list">
              {topVendors.map((v) => (
                <li key={v.vendor}>
                  <span>{v.vendor}</span>
                  <span className="muted">{v.assets.length} assets</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
      {plan && (
        <div style={{ marginTop: 16 }}>
          <Panel title="Suggested fixes (estimates, not checked)">
            <ul className="live-list">
              {plan.steps.slice(0, 5).map((s) => (
                <li key={s.rank}>
                  <span>
                    {s.rank}. {s.name} on {s.asset_name}
                  </span>
                  <span className="muted">
                    {s.effort_hours} h · risk after {s.city_index_after.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
      {finished && (
        <p className="live-done">
          Done.{' '}
          <a
            className="text-link"
            href={api.briefUrl('html', context)}
            target="_blank"
            rel="noreferrer"
          >
            Open the report
          </a>{' '}
          or see the details on{' '}
          <Link className="text-link" to="/posture">
            Trends &amp; Activity
          </Link>
          ,{' '}
          <Link className="text-link" to="/resilience">
            Weak Points
          </Link>{' '}
          and{' '}
          <Link className="text-link" to="/remediation">
            Fix Plan
          </Link>
          .
        </p>
      )}
    </>
  )
}
