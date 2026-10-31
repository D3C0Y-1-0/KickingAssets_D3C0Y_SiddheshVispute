import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, FlaskConical } from 'lucide-react'
import { SUBSTATION_LINKS, KIND_LABEL, type SubstationAsset } from './substation'
import { SCENES } from './scenes'

/** Shared GRIDINAL building blocks. Stateless; styling is in gridinal.css. */

export function SimulatedChip({ children = 'Simulated scenario' }: { children?: ReactNode }) {
  return (
    <span className="gx-chip" title="Fictional Aurora City. No live monitoring.">
      <FlaskConical size={13} aria-hidden />
      {children}
    </span>
  )
}

export type RiskFact = { score: number | null; category: string | null }

export function RiskPill({ risk }: { risk?: RiskFact | null }) {
  if (!risk || risk.score == null) {
    return <span className="gx-risk none">Not assessed</span>
  }
  return (
    <span className={`gx-risk ${risk.category ?? 'none'}`}>
      <span aria-hidden className="gx-risk-dot" />
      {risk.category} · {risk.score.toFixed(1)}
    </span>
  )
}

export function MetricStat({
  label,
  value,
  note,
}: {
  label: string
  value: ReactNode
  note?: string
}) {
  return (
    <div className="gx-stat">
      <span className="gx-stat-label">{label}</span>
      <span className="gx-stat-value">{value}</span>
      {note && <span className="gx-stat-note">{note}</span>}
    </div>
  )
}

export function Legend() {
  return (
    <ul className="gx-legend" aria-label="Legend">
      <li>
        <i className="gx-swatch data" /> Cyber route (OPC UA / HTTPS)
      </li>
      <li>
        <i className="gx-swatch op" /> Operational dependency
      </li>
      <li>
        <i className="gx-swatch ext" /> Externally exposed asset
      </li>
    </ul>
  )
}

export type AssetFacts = {
  product?: string
  risk?: RiskFact
}

export function AssetList({
  assets,
  selectedId,
  onSelect,
}: {
  assets: SubstationAsset[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <ul className="gx-asset-list" aria-label="Substation assets">
      {assets.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            aria-pressed={a.id === selectedId}
            onClick={() => onSelect(a.id === selectedId ? null : a.id)}
          >
            <span className="gx-asset-id">{a.id}</span>
            <span className="gx-asset-name">{a.name}</span>
            <span className="gx-asset-kind">{KIND_LABEL[a.kind]}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function AssetPanel({
  asset,
  facts,
  onClose,
}: {
  asset: SubstationAsset | null
  facts?: AssetFacts
  onClose: () => void
}) {
  if (!asset) {
    return (
      <div className="gx-panel gx-panel-empty">
        <p>Select a marker or an asset in the list to inspect it.</p>
      </div>
    )
  }
  const links = SUBSTATION_LINKS.filter((l) => l.from === asset.id || l.to === asset.id)
  return (
    <div className="gx-panel" role="region" aria-label={`${asset.name} details`}>
      <div className="gx-panel-head">
        <div>
          <span className="gx-asset-id">{asset.id}</span>
          <h3>{asset.name}</h3>
        </div>
        <button type="button" className="gx-close" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>
      <p className="gx-panel-role">{asset.role}</p>
      <dl className="gx-facts">
        <div>
          <dt>Type</dt>
          <dd>{KIND_LABEL[asset.kind]}</dd>
        </div>
        <div>
          <dt>Criticality</dt>
          <dd>{asset.criticality}</dd>
        </div>
        <div>
          <dt>Exposure</dt>
          <dd>{asset.exposure}</dd>
        </div>
        <div>
          <dt>Assumed product</dt>
          <dd>{facts?.product ?? 'Run the simulation to see it'}</dd>
        </div>
        <div>
          <dt>Risk index</dt>
          <dd>
            <RiskPill risk={facts?.risk} />
          </dd>
        </div>
      </dl>
      {links.length > 0 && (
        <ul className="gx-links">
          {links.map((l) => (
            <li key={`${l.from}-${l.to}`}>
              <span className={`gx-swatch ${l.kind === 'data' ? 'data' : 'op'}`} />
              {l.from} → {l.to}: {l.label}
            </li>
          ))}
        </ul>
      )}
      <p className="gx-source">
        Scenario definition (simulated). The product is an assumption and the risk index is computed
        from real vulnerability data. It is not a scan or live monitoring.
      </p>
      <Link className="gx-link" to={`/assets?q=${encodeURIComponent(asset.id)}`}>
        Open in Assets &amp; Risk <ArrowUpRight size={14} aria-hidden />
      </Link>
    </div>
  )
}

export function SceneNav({
  railRef,
  current,
  onGo,
}: {
  railRef: RefObject<HTMLElement | null>
  current: string
  onGo: (p: number) => void
}) {
  return (
    <nav className="gx-scenes" aria-label="Scenes">
      <ol>
        {SCENES.map((s) => (
          <li key={s.id}>
            {s.ready && s.at !== null ? (
              <button
                type="button"
                aria-current={s.id === current ? 'step' : undefined}
                onClick={() => onGo(s.at!)}
              >
                <span className="gx-scene-n">0{s.number}</span>
                <span className="gx-scene-title">{s.title}</span>
              </button>
            ) : (
              <span className="gx-scene-off" title="Not available in this build">
                <span className="gx-scene-n">0{s.number}</span>
                <span className="gx-scene-title">{s.title}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="gx-scene-rail" aria-hidden>
        <i ref={railRef} />
      </div>
    </nav>
  )
}

export function TopBar({
  railRef,
  scene,
  onGo,
}: {
  railRef: RefObject<HTMLElement | null>
  scene: string
  onGo: (p: number) => void
}) {
  return (
    <header className="gx-top">
      <Link to="/gridinal" className="gx-brand" aria-label="GRIDINAL home">
        GRID<span>INAL</span>
      </Link>
      <SimulatedChip />
      <SceneNav railRef={railRef} current={scene} onGo={onGo} />
      <Link className="gx-enter" to="/">
        Enter Command Center <ArrowRight size={15} aria-hidden />
      </Link>
    </header>
  )
}
