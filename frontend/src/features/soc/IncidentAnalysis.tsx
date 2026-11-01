import { Link } from 'react-router-dom'
import { Panel, RiskBadge } from '../../components/ui'
import { useSoc } from './provider'

export default function IncidentAnalysis() {
  const {
    analysis,
    stale,
    retryAnalysis,
    autoOpen,
    setAutoOpen,
    enableNotifications,
    notificationState,
  } = useSoc()
  const data = analysis?.data
  return (
    <Panel title="Automatic incident assessment & projected response">
      <div className="panel-padding soc-stack">
        <div className="soc-controls">
          <label className="soc-checkbox">
            <input
              type="checkbox"
              checked={autoOpen}
              onChange={(e) => setAutoOpen(e.target.checked)}
            />
            Open calculated What-If automatically from SOC Overview
          </label>
          <button className="button secondary" onClick={() => void enableNotifications()}>
            Enable desktop alerts
          </button>
          <span role="status">{notificationState}</span>
        </div>
        <p className="small muted">
          New node alerts prepare analysis automatically. The first analysis creates a model
          baseline if none exists. Live evidence stays separate from the model's simulated product
          assumptions. Controls are recommendations; no infrastructure changes execute
          automatically.
        </p>
        {!analysis ? (
          <p>
            Waiting for a new node-service alert. Historical events do not trigger notification
            storms.
          </p>
        ) : analysis.pending ? (
          <p role="status">
            Analysing event #{analysis.event.id} · {analysis.event.asset_id} using the existing
            model and action engine…
          </p>
        ) : analysis.error || stale ? (
          <div role="alert" className="run-error">
            {stale
              ? 'The baseline changed. This incident projection is stale; reassess against the current run.'
              : analysis.error}
            <button className="button secondary" onClick={retryAnalysis}>
              Retry incident assessment
            </button>
          </div>
        ) : (
          data && (
            <>
              <p>
                <strong>
                  {data.asset.asset_id} · {data.asset.name}
                </strong>{' '}
                · event #{data.event_id} · {data.event.outcome}
              </p>
              <p>
                Existing ML-backed scenario risk: <RiskBadge category={data.asset.risk.category} />{' '}
                <strong>{data.asset.risk.score?.toFixed(1) ?? 'Unavailable'}</strong> / 100. This is
                a relative priority, not a probability of compromise or a score learned from this
                request.
              </p>
              <p className="small muted">
                Model {data.model_version} · reference as of {data.model_as_of} · run {data.run_id}{' '}
                · fingerprint {data.baseline_fingerprint}
              </p>
              {data.projection ? (
                <p>
                  Projected city risk index:{' '}
                  <strong>
                    {data.projection.current_city_index.toFixed(2)} →{' '}
                    {data.projection.projected_city_index.toFixed(2)}
                  </strong>
                  . Calculated from supported scenario controls; not a verified repair.
                </p>
              ) : (
                <p>
                  No applicable modelled action is available. Recommendations remain visible below.
                </p>
              )}
              <ul>
                {data.options.map((o) => (
                  <li key={o.action_type}>
                    <strong>{o.name}</strong> ·{' '}
                    {o.applicable
                      ? o.modelled
                        ? 'Modelled'
                        : 'Recommendation only'
                      : 'Not applicable'}{' '}
                    · {o.effort_hours} h. {o.justification}
                  </li>
                ))}
              </ul>
              <div className="soc-controls">
                <Link
                  className="button secondary"
                  to={`/infrastructure?focus=${data.asset.asset_id}`}
                >
                  Inspect live map evidence
                </Link>
                <Link className="button primary" to={`/what-if?soc_event=${data.event_id}`}>
                  Open calculated What-If
                </Link>
              </div>
              <details>
                <summary>Evidence and modelling limitations</summary>
                <ul>
                  {data.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
              <details>
                <summary>Why this asset has its modelled risk</summary>
                <ul>
                  {(data.asset.risk.factors ?? []).map((f) => (
                    <li key={f.name}>
                      <strong>{f.name}</strong>: {f.explanation}
                    </li>
                  ))}
                </ul>
                {!data.asset.top_vulnerabilities.length ? (
                  <p>No supported top CVE evidence is available.</p>
                ) : (
                  <ul>
                    {data.asset.top_vulnerabilities.slice(0, 3).map((v) => (
                      <li key={v.cve_id}>
                        {v.cve_id} · {v.applicability} ·{' '}
                        {v.status === 'kev_listed'
                          ? 'Known KEV at reference date'
                          : `CVE priority percentile ${v.priority_percentile == null ? 'unavailable' : (v.priority_percentile * 100).toFixed(1)}`}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </>
          )
        )}
      </div>
    </Panel>
  )
}
