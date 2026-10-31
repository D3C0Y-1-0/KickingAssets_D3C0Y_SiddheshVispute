import { useState } from 'react'
import { ArrowUpRight, ChartNoAxesCombined, Fingerprint, Layers, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAssets } from '../../hooks/queries'
import { demoFor } from '../../fixtures/previews'
import { AssetDrawer } from '../../components/AssetDrawer'
import {
  EmptyState,
  PageHeading,
  Panel,
  PreviewNotice,
  QueryState,
  RiskBadge,
  SampleBadge,
  SectorBadge,
} from '../../components/ui'

export default function Intelligence() {
  const assets = useAssets()
  const [selected, setSelected] = useState<string | null>(null)
  const ranking = (assets.data ?? [])
    .filter((a) => demoFor(a.id))
    .sort((a, b) => demoFor(b.id)!.score - demoFor(a.id)!.score)
  return (
    <>
      <PageHeading
        title="Risk intelligence"
        description="Prioritization with a traceable reason behind every result."
        actions={<span className="badge neutral">ENGINE NOT CONNECTED</span>}
      />
      <PreviewNotice />
      <div className="intelligence-layout">
        <Panel title="Risk-priority ranking" aside={<SampleBadge>Design preview</SampleBadge>}>
          <QueryState pending={assets.isPending} error={assets.error} retry={assets.refetch} />
          <div className="ranking-list">
            {ranking.map((a, i) => (
              <button className="ranking-row" key={a.id} onClick={() => setSelected(a.id)}>
                <span className="rank-number mono">{(i + 1).toString().padStart(2, '0')}</span>
                <div>
                  <strong>{a.name}</strong>
                  <small>
                    <span className="mono">{a.id}</span> · <SectorBadge sector={a.sector} />
                  </small>
                </div>
                <RiskBadge category={demoFor(a.id)?.category} />
                <strong className="mono rank-score">{demoFor(a.id)?.score}</strong>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div className="panel-footnote">
            Only seven illustrative labels are supplied. No score is inferred for the remaining
            assets.
          </div>
        </Panel>
        <Panel title="Explainability factors" aside={<Fingerprint size={17} className="muted" />}>
          <div className="factor-list">
            {[
              {
                name: 'Vulnerability evidence',
                text: 'CVE applicability, CVSS, EPSS and KEV references.',
                icon: ShieldAlert,
              },
              {
                name: 'Configuration & exposure',
                text: 'Snapshot-scoped controls and network assumptions.',
                icon: Layers,
              },
              {
                name: 'Conditional service impact',
                text: 'Consequences accounting for redundancy and backups.',
                icon: ChartNoAxesCombined,
              },
            ].map(({ name, text, icon: Icon }) => (
              <div key={name} className="factor-item">
                <span className="empty-icon">
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{name}</strong>
                  <p>{text}</p>
                  <span className="subtle-label">PLANNED · NO CONTRIBUTION CALCULATED</span>
                </div>
              </div>
            ))}
          </div>
          <Link to="/methodology" className="button secondary full-width">
            Read scoring principles
            <ArrowUpRight size={14} />
          </Link>
        </Panel>
      </div>
      <div className="three-column">
        <Panel title="Model evidence">
          <EmptyState title="Awaiting a validated model">
            Model version, temporal evaluation, calibration and dataset provenance will appear after
            training and validation.
          </EmptyState>
        </Panel>
        <Panel title="Vulnerability prioritization">
          <EmptyState title="No reference data imported">
            Real NVD, EPSS and KEV data must be ingested and matched before findings can be
            prioritized.
          </EmptyState>
        </Panel>
        <Panel title="Snapshot comparison">
          <EmptyState title="No calculated assessments">
            Risk changes require two comparable, versioned assessments. Only the unassessed baseline
            inventory exists.
          </EmptyState>
        </Panel>
      </div>
      <div className="inset-note">
        A relative risk index orders review priorities. It is not a calibrated probability of a real
        incident, and a network path alone does not prove exploitability.
      </div>
      <AssetDrawer id={selected} onClose={() => setSelected(null)} />
    </>
  )
}
