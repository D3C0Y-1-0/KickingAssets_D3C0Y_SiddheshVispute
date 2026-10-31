import { useEffect, useRef } from 'react'
import { ExternalLink, ShieldCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAsset, useLatestRun } from '../hooks/queries'
import { QueryState, RiskBadge, SampleBadge, SectorBadge } from './ui'

export function AssetDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const query = useAsset(id)
  const latest = useLatestRun()
  const simulated = latest.data?.assets.find((a) => a.asset_id === id)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = dialog.current
    if (id && el && !el.open) el.showModal()
    if (!id && el?.open) el.close()
  }, [id])
  const detail = query.data
  return (
    <dialog
      ref={dialog}
      className="asset-drawer"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-labelledby="asset-detail-heading"
    >
      <div className="drawer-content">
        <div className="drawer-top">
          <span className="eyebrow">ASSET INSPECTION</span>
          <button aria-label="Close asset details" className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
        {detail && (
          <>
            <div className="mono muted">{detail.asset.id}</div>
            <h2 id="asset-detail-heading">{detail.asset.name}</h2>
            <div className="inline-items">
              <SectorBadge sector={detail.asset.sector} />
              <SampleBadge>Fictional asset</SampleBadge>
            </div>
            <p>{detail.asset.description}</p>
            <dl className="detail-grid">
              <dt>Site</dt>
              <dd>{detail.asset.site}</dd>
              <dt>Type</dt>
              <dd>{detail.asset.asset_type}</dd>
              <dt>Vendor</dt>
              <dd>{detail.asset.vendor}</dd>
              <dt>Product</dt>
              <dd>{detail.asset.product}</dd>
              <dt>Version</dt>
              <dd className="mono">{detail.asset.version}</dd>
              <dt>Criticality</dt>
              <dd>{detail.asset.criticality}</dd>
              <dt>Exposure</dt>
              <dd>{detail.asset.exposure}</dd>
            </dl>
            <h3 className="section-label">
              <ShieldCheck size={16} />
              Security configuration
            </h3>
            <dl className="detail-grid">
              <dt>Network zone</dt>
              <dd>{detail.asset.security.network_zone}</dd>
              <dt>Multifactor auth</dt>
              <dd>
                {detail.asset.security.mfa_enabled == null
                  ? 'Unknown'
                  : detail.asset.security.mfa_enabled
                    ? 'Configured'
                    : 'Not configured'}
              </dd>
              <dt>Remote access</dt>
              <dd>
                {detail.asset.security.remote_access == null
                  ? 'Unknown'
                  : detail.asset.security.remote_access
                    ? 'Configured'
                    : 'Not configured'}
              </dd>
              <dt>Patch status</dt>
              <dd>{detail.asset.security.patch_status.replaceAll('_', ' ')}</dd>
              <dt>Backup</dt>
              <dd>{detail.asset.security.backup_mode}</dd>
            </dl>
            <div className="inset-note">
              Configuration is a scenario assumption, not a verified observation.
            </div>
            <h3>Risk assessment</h3>
            {detail.risk.status === 'computed' ? (
              <div className="inset-note">
                <RiskBadge category={detail.risk.category} /> score{' '}
                <strong className="mono">{detail.risk.score?.toFixed(1)}</strong> · computed by{' '}
                {detail.risk.scoring_version} over {detail.risk.model_version}
                <ul className="list-plain">
                  {(detail.risk.factors ?? []).map((f) => (
                    <li key={f.name}>
                      <strong>{f.name}</strong>: {f.explanation}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="inset-note">
                Unavailable · {detail.risk.unavailable_reason} No score is assigned.
              </div>
            )}
            <h3>Candidate vulnerabilities</h3>
            {simulated ? (
              <>
                <p className="small muted">
                  Assumed product family: {simulated.profile.label}. {simulated.candidate_count}{' '}
                  candidate CVEs, {simulated.known_exploited_count} already in CISA KEV.
                </p>
                <ul className="list-plain">
                  {simulated.top_vulnerabilities.slice(0, 5).map((v) => (
                    <li key={v.cve_id}>
                      <span className="mono">{v.cve_id}</span> ·{' '}
                      {v.status === 'kev_listed'
                        ? `known exploited (KEV ${v.kev_added})`
                        : `ML top ${(100 - (v.priority_percentile ?? 0) * 100).toFixed(2)}%`}
                    </li>
                  ))}
                </ul>
                <Link className="text-link" to="/intelligence" onClick={onClose}>
                  Full reasoning in Risk Intelligence
                </Link>
              </>
            ) : (
              <div className="inset-note">
                Run the simulation to fetch and score candidate CVEs. An empty record does not
                establish that this asset is secure.
              </div>
            )}
            <h3>Source & context</h3>
            <dl className="detail-grid">
              <dt>Provenance</dt>
              <dd>{detail.asset.provenance.source}</dd>
              <dt>Source type</dt>
              <dd>Scenario assumption</dd>
              <dt>Snapshot</dt>
              <dd className="mono">{detail.asset.snapshot_id}</dd>
            </dl>
            <Link
              className="button secondary full-width"
              to={`/infrastructure?focus=${id}`}
              onClick={onClose}
            >
              Locate in infrastructure map
              <ExternalLink size={15} />
            </Link>
          </>
        )}
      </div>
    </dialog>
  )
}
