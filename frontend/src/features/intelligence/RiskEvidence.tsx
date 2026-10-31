import type { Models } from '../../api/client'
import { useIntelligence } from '../../hooks/queries'
import { QueryState, RiskBadge } from '../../components/ui'
import './intelligence.css'

export function PriorityEvidence({ item }: { item: Models['AssetPriority'] }) {
  return (
    <div className="risk-evidence">
      <div className="inline-items">
        <RiskBadge category={item.risk.category ?? undefined} />
        <strong className="mono">
          {item.risk.score?.toFixed(2) ?? 'Unavailable'}
          {item.risk.score != null && ' / 100'}
        </strong>
        <span className="badge neutral">
          {item.coverage === 'partial' ? 'CURATED COVERAGE' : 'INSUFFICIENT EVIDENCE'}
        </span>
      </div>
      <p>
        {item.risk.unavailable_reason ??
          'Calculated relative review priority for a simulated asset. Not an incident probability.'}
      </p>
      <dl className="risk-factors">
        {(item.risk.factors ?? []).map((f) => (
          <div key={f.name}>
            <dt>
              {f.name}
              <strong className="mono">+{f.contribution.toFixed(2)}</strong>
            </dt>
            <dd>
              {f.explanation}
              <small>Evidence: {f.evidence_ids.join(', ') || 'Scenario configuration'}</small>
            </dd>
          </div>
        ))}
      </dl>
      <h4>CVE prioritization signals</h4>
      {item.signals.length === 0 && (
        <p>No matched model input. Unknown applicability does not establish safety.</p>
      )}
      {item.signals.map((s) => (
        <details key={s.cve_id} className="signal-card">
          <summary>
            {s.cve_id} ·{' '}
            {s.status === 'computed'
              ? `ML signal ${s.signal?.toFixed(5)}`
              : s.status.replaceAll('_', ' ')}
          </summary>
          <p>{s.reason}</p>
          <p className="mono small">
            {s.model_version} / {s.model_variant} · Features {s.feature_date}
          </p>
          <p className="mono small hash">Artifact SHA-256 {s.artifact_sha256}</p>
          {(s.contributions?.length ?? 0) > 0 && (
            <>
              <p>
                Largest signed tree contributions in log-odds space; these explain the CVE signal,
                not the asset index.
              </p>
              <ul>
                {s.contributions?.map((f) => (
                  <li key={f.feature}>
                    <span className="mono">{f.feature}</span>: {f.log_odds_contribution.toFixed(4)}{' '}
                    (input {f.value?.toFixed(3) ?? 'missing'})
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
      ))}
      <h4>Conditional operational impact</h4>
      <p>
        Assume this asset becomes unavailable for 1,440 minutes. Each asset is simulated
        independently; compromise is not inferred from a CVE or graph path.
      </p>
      {item.impacts.map((i) => (
        <details className="signal-card" key={i.service_id}>
          <summary>
            {i.service_id.replace('svc-', '')} ·{' '}
            {i.disruption_fraction == null
              ? 'unavailable'
              : `${(i.disruption_fraction * 100).toFixed(1)}% of horizon disrupted`}
          </summary>
          <p>
            {i.engine_version} · {i.compromise_effect} · projected
          </p>
          <ul>
            {i.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      ))}
      <details className="signal-card">
        <summary>Coverage, versions & assumptions</summary>
        <p>
          {item.risk.scoring_version ?? 'No scoring result'} ·{' '}
          {item.risk.calculated_at ?? 'Not calculated'}
        </p>
        <ul>
          {item.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}

export function RiskEvidence({ assetId }: { assetId: string }) {
  const query = useIntelligence()
  const item = query.isError ? undefined : query.data?.assets.find((a) => a.asset_id === assetId)
  return (
    <>
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
      {item && <PriorityEvidence item={item} />}
    </>
  )
}
