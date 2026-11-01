import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { BrainCircuit, CircleAlert, LoaderCircle, Search } from 'lucide-react'
import { api } from '../../api/client'
import { useMlOverview, usePooledBacktest } from '../../hooks/queries'
import { EmptyState, PageHeading, Panel, QueryState } from '../../components/ui'
import { percent } from '../../lib/risk'

const prettyName: Record<string, string> = {
  xgboost_with_epss: 'XGBoost + EPSS (deployed)',
  xgboost_no_epss: 'XGBoost without EPSS',
  xgboost_no_kev_history: 'XGBoost without KEV history',
  logistic_with_epss: 'Logistic regression + EPSS',
  epss_percentile_baseline: 'Baseline: EPSS percentile',
  cvss_only_baseline: 'Baseline: CVSS score only',
  vendor_kev_history_baseline: 'Baseline: vendor KEV history',
}

function CveScorer() {
  const [cve, setCve] = useState('CVE-2025-40737')
  const score = useMutation({ mutationFn: (id: string) => api.mlScore(id) })
  const result = score.data
  return (
    <Panel title="Score a CVE with the trained model">
      <div className="panel-padding">
        <form
          className="cve-form"
          onSubmit={(e) => {
            e.preventDefault()
            score.mutate(cve)
          }}
        >
          <input
            aria-label="CVE identifier"
            value={cve}
            onChange={(e) => setCve(e.target.value)}
            placeholder="CVE-2025-40737"
          />
          <button className="button primary" disabled={score.isPending}>
            <Search size={15} />
            {score.isPending ? 'Scoringâ€¦' : 'Score'}
          </button>
        </form>
        {score.isError && (
          <p className="run-error" role="alert">
            <CircleAlert size={14} />
            {score.error.message}
          </p>
        )}
        {result && (
          <div className="spaced-panel">
            <dl className="detail-grid">
              <dt>CVE</dt>
              <dd className="mono">{result.cve_id}</dd>
              <dt>Published</dt>
              <dd>{result.published}</dd>
              <dt>Snapshot</dt>
              <dd>{result.as_of}</dd>
              {result.status === 'already_in_kev' && (
                <>
                  <dt>Status</dt>
                  <dd>Already in CISA KEV since {result.kev_added}; not a prediction target.</dd>
                </>
              )}
              {result.status === 'too_recent' && (
                <>
                  <dt>Status</dt>
                  <dd>Younger than 30 days; the model does not score it yet.</dd>
                </>
              )}
              {result.status === 'scored' && (
                <>
                  <dt>Model score</dt>
                  <dd className="mono">{result.ml_score?.toFixed(4)}</dd>
                  <dt>Priority percentile</dt>
                  <dd>
                    Top {(100 - (result.priority_percentile ?? 0) * 100).toFixed(2)}% of all
                    not-yet-listed CVEs
                  </dd>
                  <dt>EPSS percentile</dt>
                  <dd>{percent(result.epss_percentile, 1)}</dd>
                  <dt>CVSS</dt>
                  <dd>{result.cvss_score ?? 'â€”'}</dd>
                </>
              )}
            </dl>
            {(result.drivers ?? []).length > 0 && (
              <>
                <h3 className="section-label">Why (exact TreeSHAP contributions)</h3>
                {(result.drivers ?? []).map((d) => (
                  <span key={d.feature} className={`driver-chip ${d.contribution > 0 ? 'up' : ''}`}>
                    {d.label} {d.contribution > 0 ? '+' : ''}
                    {d.contribution.toFixed(2)}
                  </span>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}

function PooledBacktestPanel() {
  const query = usePooledBacktest()
  const b = query.data
  return (
    <Panel
      title="Backtest on this city's real products (held-out months)"
      aside={<span className="badge ok">NEVER USED TO TRAIN OR TUNE</span>}
      className="spaced-panel"
    >
      <div className="panel-padding">
        {query.isPending && (
          <p>
            <LoaderCircle className="spin" size={16} /> Scoring every month from January 2025 with
            dated KEV/EPSS history; current NVD fields may contain later editsâ€¦
          </p>
        )}
        {query.isError && <p className="run-error">{query.error.message}</p>}
        {b && (
          <>
            <p>
              For {b.snapshots} monthly snapshots ({b.first_snapshot} to {b.last_snapshot}), every
              CVE that applies to the assumed product versions was scored with that month's KEV/EPSS
              history and current NVD record fields. Of {b.pairs_evaluated.toLocaleString()} (CVE,
              month) pairs, <strong>{b.hit_pairs}</strong> later entered CISA KEV within 180 days,
              from <strong>{b.distinct_hit_cves}</strong> distinct CVEs.
            </p>
            <div className="table-scroll">
              <table className="metric-table">
                <thead>
                  <tr>
                    <th>GROUP</th>
                    <th>PAIRS</th>
                    <th>LATER IN KEV</th>
                    <th>RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {b.groups.map((g) => (
                    <tr key={g.label}>
                      <td>{g.label}</td>
                      <td className="mono">{g.cves.toLocaleString()}</td>
                      <td className="mono">{g.hits}</td>
                      <td className="mono">{percent(g.hit_rate, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-plain">
              {b.hits.map((h) => (
                <li key={h.cve_id}>
                  <span className="mono">{h.cve_id}</span> on {h.assets.join(', ')}: first flagged{' '}
                  {h.first_flagged} (model top {(100 - h.best_priority_percentile * 100).toFixed(1)}
                  %), entered KEV {h.kev_added}
                </li>
              ))}
            </ul>
            <div className="callout warn">
              <strong>Read with care.</strong> Only {b.distinct_hit_cves} distinct CVEs are
              involved, so this is an anecdote, not a statistical proof. {b.note}
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}

export default function MlLab() {
  const query = useMlOverview()
  if (query.isPending || query.isError)
    return <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
  const ml = query.data
  const {
    metrics = [],
    importances = [],
    sources = [],
    not_claimed = [],
    panel: dataPanel = {},
    leakage_controls = [],
    limitations = [],
    features = [],
    ap_by_quarter = {},
    shuffled_label_audit = {},
  } = ml
  const deployed = metrics.find((m) => m.name === 'xgboost_with_epss')
  const epss = metrics.find((m) => m.name === 'epss_percentile_baseline')
  const delta = deployed?.ap_delta_vs_epss_ci95
  const tied = delta ? delta[0] <= 0 && delta[1] >= 0 : null
  const maxAp = Math.max(...metrics.map((m) => m.average_precision_ci95[1]), 0.0001)
  const maxImportance = Math.max(...importances.map((i) => i.mean_abs_contribution), 0.0001)
  const quarters = Object.entries(ap_by_quarter)
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / MACHINE LEARNING"
        title="ML model"
        description="The model, the real data it was trained on, how it was validated, and what it can and cannot claim."
        actions={
          <span className={`badge ${ml.status.ready ? 'neutral' : 'sample'}`}>
            <BrainCircuit size={13} />
            {ml.status.ready ? 'LIVE SCORING READY' : 'LIVE SCORING UNAVAILABLE'}
          </span>
        }
      />
      {!ml.status.ready && (
        <div className="callout warn">
          Live scoring needs local reference data: {ml.status.missing.join('; ')}.
        </div>
      )}
      <div className="two-column spaced-panel">
        <Panel title="What the model does">
          <div className="panel-padding">
            <p>{ml.task}</p>
            <p className="subtle-label">{ml.model_version}</p>
            <h3 className="section-label">It does not claim</h3>
            <ul className="list-plain">
              {not_claimed.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Real data it was trained on">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SOURCE</th>
                  <th>USED FOR</th>
                  <th>FILES</th>
                  <th>SIZE</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.name}>
                    <td>
                      <a className="text-link" href={s.url} target="_blank" rel="noreferrer">
                        {s.name}
                      </a>
                      <small className="muted">{s.note}</small>
                    </td>
                    <td className="small">{s.role}</td>
                    <td className="mono">{s.files}</td>
                    <td className="mono">{s.megabytes} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-footnote">
            Retrieved {ml.manifest_retrieved_at} Â· NVD release {ml.nvd_release_tag} Â· every file's
            SHA-256 is in data/reference/manifest.json. All of this is real data. The simulated part
            is the city, not the training data.
          </div>
        </Panel>
      </div>
      <div className="metric-grid three-metrics">
        {[
          ['Training rows', String(dataPanel.rows?.toLocaleString?.() ?? dataPanel.rows)],
          ['Rows that later entered KEV', String(dataPanel.positive_rows?.toLocaleString?.())],
          ['Distinct KEV-bound CVEs', String(dataPanel.distinct_positive_cves)],
        ].map(([label, value]) => (
          <section className="metric-card" key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
            <div className="metric-foot">
              Monthly snapshots {String(dataPanel.first_snapshot)} to{' '}
              {String(dataPanel.last_snapshot)}, {String(dataPanel.horizon_days)}-day label window
            </div>
          </section>
        ))}
      </div>
      <Panel
        title="Held-out evaluation (test: January 2025 onward)"
        aside={<span className="badge neutral">AP = weighted average precision</span>}
      >
        <div className="table-scroll">
          <table className="metric-table">
            <thead>
              <tr>
                <th>MODEL / BASELINE</th>
                <th>AVG PRECISION (95% CI)</th>
                <th>ROC AUC</th>
                <th>PRECISION @50 / MONTH</th>
                <th>RECALL @50 / MONTH</th>
                <th>AP vs EPSS (95% CI of difference)</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.name} className={m.is_baseline ? 'baseline' : ''}>
                  <td>{prettyName[m.name] ?? m.name}</td>
                  <td className="mono">
                    {m.average_precision.toFixed(4)} [{m.average_precision_ci95[0]},{' '}
                    {m.average_precision_ci95[1]}]
                  </td>
                  <td className="mono">{m.roc_auc.toFixed(3)}</td>
                  <td className="mono">{percent(m.precision_at_50_per_month, 2)}</td>
                  <td className="mono">{percent(m.recall_at_50_per_month, 2)}</td>
                  <td className="mono">
                    {m.ap_delta_vs_epss_ci95
                      ? `[${m.ap_delta_vs_epss_ci95[0]}, ${m.ap_delta_vs_epss_ci95[1]}]`
                      : 'reference'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-padding">
          {metrics.map((m) => (
            <div className="bar-row" key={m.name}>
              <span>{prettyName[m.name] ?? m.name}</span>
              <span className="bar-track">
                <i
                  className={m.is_baseline ? 'baseline' : ''}
                  style={{ width: `${(m.average_precision / maxAp) * 100}%` }}
                />
              </span>
              <span className="mono">{m.average_precision.toFixed(4)}</span>
            </div>
          ))}
          <div className={`callout ${tied ? 'warn' : ''}`}>
            <strong>Honest reading.</strong>{' '}
            {deployed && epss
              ? tied
                ? `The deployed model (AP ${deployed.average_precision}) does not establish a statistically clear AP improvement over the EPSS percentile baseline (AP ${epss.average_precision}): the paired difference interval includes zero. It ranks better overall (AUC ${deployed.roc_auc} vs ${epss.roc_auc}) and clearly beats CVSS alone, but it does not beat EPSS in the top of the list. Most of its signal comes from EPSS.`
                : delta && delta[1] < 0
                  ? 'The paired interval supports lower average precision than EPSS on this evaluation.'
                  : delta && delta[0] > 0
                    ? 'The paired interval supports higher average precision than EPSS on this evaluation.'
                    : 'No paired difference interval is available; inspect the reported metrics.'
              : ''}{' '}
            Prevalence in the test population is {ml.prevalence}; only a few hundred distinct CVEs
            are positive, so intervals are wide.
          </div>
        </div>
      </Panel>
      <div className="two-column spaced-panel">
        <Panel title="What drives the deployed model">
          <div className="panel-padding">
            {importances.map((i) => (
              <div className="bar-row" key={i.feature}>
                <span>{i.label}</span>
                <span className="bar-track">
                  <i style={{ width: `${(i.mean_abs_contribution / maxImportance) * 100}%` }} />
                </span>
                <span className="mono">{i.mean_abs_contribution.toFixed(2)}</span>
              </div>
            ))}
            <p className="subtle-label">Mean absolute TreeSHAP contribution on 20,000 test rows.</p>
          </div>
        </Panel>
        <Panel title="Stability by quarter">
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>QUARTER</th>
                  <th>MODEL AP</th>
                  <th>EPSS AP</th>
                  <th>POSITIVE ROWS</th>
                </tr>
              </thead>
              <tbody>
                {quarters.map(([q, v]) => (
                  <tr key={q}>
                    <td>{q}</td>
                    <td className="mono">{v.xgboost_with_epss}</td>
                    <td className="mono">{v.epss_percentile_baseline}</td>
                    <td className="mono">{v.positive_rows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-footnote">
            Performance varies by quarter; EPSS is often stronger. Treat the model as one signal,
            not an oracle.
          </div>
        </Panel>
      </div>
      <div className="two-column spaced-panel">
        <Panel title="Leakage controls and audit">
          <div className="panel-padding">
            <ul className="list-plain">
              {leakage_controls.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="callout">
              Shuffled-label audit: a model trained on permuted labels scores AP{' '}
              {shuffled_label_audit.average_precision} on the test set, versus{' '}
              {deployed?.average_precision} for the real model (prevalence {ml.prevalence}). The
              audit remains above prevalence and does not establish absence of leakage.
            </div>
          </div>
        </Panel>
        <Panel title="Known limitations">
          <div className="panel-padding">
            <ul className="list-plain">
              {limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
      <PooledBacktestPanel />
      <CveScorer />
      {features.length === 0 && (
        <EmptyState title="No model card found">
          Restore the committed model artifacts and reference cache. No replacement score is
          assigned.
        </EmptyState>
      )}
    </>
  )
}
