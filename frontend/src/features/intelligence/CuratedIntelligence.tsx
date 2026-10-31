import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useContext, useIntelligence } from '../../hooks/queries'
import { AssetDrawer } from '../../components/AssetDrawer'
import {
  EmptyState,
  PageHeading,
  Panel,
  QueryState,
  RiskBadge,
  SectorBadge,
} from '../../components/ui'
import { PriorityEvidence } from './RiskEvidence'

export default function Intelligence() {
  const query = useIntelligence()
  const context = useContext()
  const client = useQueryClient()
  const run = useMutation({
    mutationFn: () => api.assessIntelligence(context),
    onSuccess: () => client.invalidateQueries(),
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [sector, setSector] = useState('all')
  const [band, setBand] = useState('all')
  const [search, setSearch] = useState('')
  const report = query.isError ? undefined : query.data
  const rows =
    report?.assets.filter(
      (a) =>
        (sector === 'all' || sector === a.sector) &&
        (band === 'all' || (a.risk.category ?? 'unavailable') === band) &&
        `${a.name} ${a.asset_id}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  const active = report?.assets.find((a) => a.asset_id === selected) ?? rows[0]
  return (
    <>
      <PageHeading
        title="Curated vulnerability check"
        description="Calculated review priorities, real CVE evidence and conditional operational consequences."
        actions={
          <button className="button primary" disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? 'Assessing…' : 'Run risk assessment'}
          </button>
        }
      />
      <QueryState
        pending={query.isPending}
        error={run.error ?? query.error}
        retry={query.refetch}
      />
      {report && (
        <>
          <div className="risk-coverage">
            <strong>
              {report.assessed_count} / {report.assets.length} assets with calculated priority
            </strong>{' '}
            · {report.unavailable_count} unavailable.
            <br />
            Curated references and simulated infrastructure. Relative index, not an asset-compromise
            probability.
            <br />
            <span className="mono small">
              {report.scoring_version} · {report.model.model_version}/{report.model.variant} ·{' '}
              {new Date(report.calculated_at).toLocaleString()}
            </span>
          </div>
          <div className="intelligence-filters">
            <input
              aria-label="Search risk priorities"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets…"
            />
            <select
              aria-label="Risk sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            >
              <option value="all">All sectors</option>
              {['power', 'water', 'healthcare'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Risk category"
              value={band}
              onChange={(e) => setBand(e.target.value)}
            >
              <option value="all">All risk categories</option>
              {['critical', 'high', 'medium', 'low', 'unavailable'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="intelligence-layout">
            <Panel title="Calculated asset priorities">
              <div className="ranking-list">
                {rows.map((a, i) => (
                  <button
                    key={a.asset_id}
                    className={`ranking-row ${a.asset_id === active?.asset_id ? 'selected' : ''}`}
                    onClick={() => setSelected(a.asset_id)}
                    aria-label={`Explain ${a.name}`}
                  >
                    <span className="rank-number mono">{i + 1}</span>
                    <div>
                      <strong>{a.name}</strong>
                      <small>
                        {a.asset_id} ·{' '}
                        <SectorBadge sector={a.sector as 'power' | 'water' | 'healthcare'} />
                      </small>
                    </div>
                    <RiskBadge category={a.risk.category ?? undefined} />
                    <strong className="mono rank-score">{a.risk.score?.toFixed(2) ?? '—'}</strong>
                  </button>
                ))}
              </div>
              {rows.length === 0 && (
                <EmptyState title="No matching priorities">
                  Change the filters to inspect other assets.
                </EmptyState>
              )}
            </Panel>
            <Panel title={active ? `Why ${active.name}?` : 'Risk explanation'}>
              {active && (
                <>
                  <button className="button secondary" onClick={() => setDetail(active.asset_id)}>
                    Inspect asset & vulnerability findings
                  </button>
                  <PriorityEvidence item={active} />
                </>
              )}
            </Panel>
          </div>
          <Panel title="Model evaluation & provenance">
            <p>{report.model.task}</p>
            <p>{report.model.evaluation_status}</p>
            <div className="table-scroll">
              <table className="model-metrics">
                <thead>
                  <tr>
                    <th>MODEL / BASELINE</th>
                    <th>TEST AP</th>
                    <th>ROC-AUC</th>
                    <th>PRECISION @ 200 / MONTH</th>
                    <th>RECALL @ 200 / MONTH</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.model.metrics).map(([name, m]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      {[
                        'average_precision',
                        'roc_auc',
                        'precision_at_200_per_month',
                        'recall_at_200_per_month',
                      ].map((k) => (
                        <td className="mono" key={k}>
                          {typeof m[k] === 'number' ? m[k].toFixed(4) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mono small hash">
              Model SHA-256 {report.model.artifact_sha256}
              <br />
              Training manifest SHA-256 {report.model.manifest_sha256}
            </p>
            <details className="signal-card">
              <summary>Model limitations and coverage</summary>
              <ul>
                {report.model.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </details>
          </Panel>
          <Panel title="Assessment context">
            <p className="mono small hash">
              Report {report.id}
              <br />
              Vulnerability assessment {report.vulnerability_assessment_id}
              <br />
              Reference dataset {report.reference_dataset_id}
            </p>
            <p>
              One inventory snapshot; no comparable risk trend is available. Current priorities and
              projected impact assumptions remain distinct.
            </p>
          </Panel>
        </>
      )}
      <AssetDrawer id={detail} onClose={() => setDetail(null)} />
    </>
  )
}
