import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ExternalLink, Network, Search } from 'lucide-react'
import { useGraph } from '../../hooks/queries'
import { TWIN_LINKS } from '../../data/twinLinks'
import { TWIN_VIEW_LABEL, partLabel, viewOfPart, type TwinView } from '../../data/twinParts'
import type { PartLink } from '../../hooks/twinConnections'
import type { TwinRisk } from '../../hooks/twinRisk'
import type { AssetSimulation } from '../../api/client'
import { useTwinNav } from './TwinNav'
import './twin.css'

export interface InspectorPart {
  id: string
  label: string
  sub?: string
  metric?: string
  value?: string
}

interface Props {
  view: TwinView
  parts: InspectorPart[]
  selectedId: string | null
  onSelect: (id: string) => void
  risk: Record<string, TwinRisk>
  /** Scored assets from the latest simulation run, by asset id. */
  scored: Map<string, AssetSimulation>
  links: PartLink[]
}

const MAX_ASSETS = 5

/**
 * Side panel for a digital twin: what the selected part is, which scenario assets sit behind it
 * (and their computed risk, if a simulation has run), and how it connects to other parts.
 * Design values are illustrative; risk comes only from the latest computed run.
 */
export function TwinInspector({ view, parts, selectedId, onSelect, risk, scored, links }: Props) {
  const { openPart, openAsset } = useTwinNav()
  const names = useGraph('operational').data?.nodes
  const nameOf = useMemo(() => new Map((names ?? []).map((n) => [n.id, n.name])), [names])
  const part = parts.find((p) => p.id === selectedId) ?? null
  const partRisk = selectedId ? risk[selectedId] : undefined

  const assetIds = selectedId ? (TWIN_LINKS[selectedId] ?? []) : []
  const assets = assetIds
    .map((id) => ({ id, sim: scored.get(id) }))
    .sort((a, b) => (b.sim?.risk.score ?? -1) - (a.sim?.risk.score ?? -1))

  const mine = (kind: PartLink['kind']) =>
    links.filter((l) => l.kind === kind && (l.from === selectedId || l.to === selectedId))
  const operational = mine('operational')
  const cyber = mine('cyber')

  const Chip = ({ id, label }: { id: string; label?: string }) => {
    const v = viewOfPart(id)
    const away = v && v !== view
    return (
      <button className="ti-part-chip" onClick={() => openPart(id)} title={`Open ${partLabel(id)}`}>
        <span>{label ?? partLabel(id)}</span>
        {away && <small>{TWIN_VIEW_LABEL[v]}</small>}
      </button>
    )
  }

  const Group = ({
    title,
    rows,
    outgoing,
  }: {
    title: string
    rows: PartLink[]
    outgoing: boolean
  }) => {
    const list = rows.filter((l) => (outgoing ? l.from === selectedId : l.to === selectedId))
    if (!list.length) return null
    return (
      <div className="ti-group">
        <h4>{title}</h4>
        {list.map((l) => (
          <div key={l.id} className="ti-link-row" title={l.via.join(', ')}>
            <Chip id={outgoing ? l.to : l.from} />
            <span className="ti-link-kind">{l.label.replaceAll('_', ' ')}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <aside className="twin-inspector" aria-label="Part inspector">
      <label className="ti-field" htmlFor={`ti-part-${view}`}>
        Part
      </label>
      <select
        id={`ti-part-${view}`}
        className="twin-select ti-select"
        value={selectedId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        {parts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {part ? (
        <>
          <h3 className="ti-title">{part.label}</h3>
          {part.sub && <p className="ti-sub">{part.sub}</p>}
          {part.metric && (
            <div className="ti-metric">
              <span>{part.metric}</span>
              <strong>{part.value}</strong>
              <em>Design reference, illustrative</em>
            </div>
          )}

          <section className="ti-section">
            <h4>Scenario assets behind this part</h4>
            {assets.length === 0 ? (
              <p className="ti-empty">
                Purely physical or civil element: no controller, relay or gateway in the scenario is
                attached to it, so there is nothing to assess.
              </p>
            ) : (
              <>
                {partRisk && (
                  <div className={`ti-risk ${partRisk.category}`}>
                    <strong>{partRisk.score.toFixed(1)}</strong>
                    <span>
                      {(partRisk.category ?? '').toUpperCase()} · worst of {partRisk.linked} linked
                      asset{partRisk.linked === 1 ? '' : 's'}
                    </span>
                  </div>
                )}
                {!partRisk && <p className="ti-empty">Not scored yet. Run the simulation.</p>}
                <ul className="ti-assets">
                  {assets.slice(0, MAX_ASSETS).map(({ id, sim }) => (
                    <li key={id}>
                      <div>
                        <span className="mono">{id}</span>
                        <small>{nameOf.get(id) ?? sim?.name ?? ''}</small>
                      </div>
                      {sim?.risk.score != null && (
                        <span className={`ti-score ${sim.risk.category}`}>
                          {sim.risk.score.toFixed(1)}
                        </span>
                      )}
                      <button
                        className="ti-icon"
                        onClick={() => openAsset(id)}
                        aria-label={`Open ${id} details`}
                        title="Asset details"
                      >
                        <Search size={13} />
                      </button>
                      <Link
                        className="ti-icon"
                        to={`/infrastructure?mode=operational&focus=${id}`}
                        aria-label={`Show ${id} on the infrastructure map`}
                        title="Show on infrastructure map"
                      >
                        <Network size={13} />
                      </Link>
                    </li>
                  ))}
                </ul>
                {assets.length > MAX_ASSETS && (
                  <p className="ti-empty">
                    +{assets.length - MAX_ASSETS} more on the{' '}
                    <Link to="/assets" className="text-link">
                      register <ExternalLink size={11} />
                    </Link>
                  </p>
                )}
              </>
            )}
          </section>

          <section className="ti-section">
            <h4>Operational dependencies</h4>
            {operational.length === 0 ? (
              <p className="ti-empty">No provider or dependent link to another mapped part.</p>
            ) : (
              <>
                <Group title="Provides to" rows={operational} outgoing />
                <Group title="Depends on" rows={operational} outgoing={false} />
              </>
            )}
          </section>

          <section className="ti-section">
            <h4>Cyber reachability</h4>
            {cyber.length === 0 ? (
              <p className="ti-empty">No permitted access path to another mapped part.</p>
            ) : (
              <>
                <Group title="Can reach" rows={cyber} outgoing />
                <Group title="Reachable from" rows={cyber} outgoing={false} />
              </>
            )}
            <p className="ti-note">
              <ArrowRight size={11} /> Connectivity is not compromise. Edges come from the scenario
              graphs, not from this drawing.
            </p>
          </section>
        </>
      ) : (
        <p className="ti-empty">Select a part on the diagram to see what is behind it.</p>
      )}
    </aside>
  )
}
