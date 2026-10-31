import { useEffect, useRef } from 'react'
import { ExternalLink, ShieldCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAsset } from '../hooks/queries'
import { EmptyState, QueryState, SampleBadge, SectorBadge } from './ui'

export function AssetDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const query = useAsset(id)
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
            <h3>Vulnerability records</h3>
            <EmptyState compact title="No vulnerability intelligence imported">
              No CVEs have been matched. An empty record does not establish that this asset is
              secure.
            </EmptyState>
            <h3>Risk assessment</h3>
            <div className="inset-note">
              Unavailable · {detail.risk.unavailable_reason}. No score is assigned.
            </div>
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
