import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import type { Core, EventObject, StylesheetJson } from 'cytoscape'
import { ArrowRight, ArrowUpRight, Focus, Minus, Network, Plus, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useGraph } from '../../hooks/queries'
import type { Asset, GraphMode } from '../../api/client'
import { AssetDrawer } from '../../components/AssetDrawer'
import {
  PageHeading,
  Panel,
  QueryState,
  RiskBadge,
  SampleBadge,
  SectorBadge,
} from '../../components/ui'
import { categoryLabels, demoFor } from '../../fixtures/previews'

export default function Infrastructure() {
  const [params, setParams] = useSearchParams()
  const mode: GraphMode = params.get('mode') === 'operational' ? 'operational' : 'cyber'
  const requestedSector = params.get('sector') ?? 'all'
  const sector = ['all', 'power', 'water', 'healthcare'].includes(requestedSector)
    ? requestedSector
    : 'all'
  const focusId = params.get('focus')
  const query = useGraph(mode)
  const container = useRef<HTMLDivElement>(null)
  const cy = useRef<Core | null>(null)
  const [selected, setSelected] = useState<string | null>(focusId)
  const [detail, setDetail] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState(false)
  const [zoom, setZoom] = useState(100)
  const selection = useRef(selected)
  useEffect(() => {
    selection.current = selected
  }, [selected])
  useEffect(() => {
    if (focusId) setSelected(focusId)
  }, [focusId])
  const nodes = useMemo(
    () => query.data?.nodes.filter((a) => sector === 'all' || a.sector === sector) ?? [],
    [query.data, sector],
  )
  const edges = useMemo(() => {
    const ids = new Set(nodes.map((a) => a.id))
    return (
      query.data?.edges.filter((e) => ids.has(e.source_asset_id) && ids.has(e.target_asset_id)) ??
      []
    )
  }, [query.data, nodes])
  const active = nodes.find((a) => a.id === selected)
  const updateParams = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set(key, value)
      next.delete('focus')
      return next
    })

  useEffect(() => {
    if (!container.current || !query.data) return
    const colors = getComputedStyle(container.current)
    const token = (name: string) => colors.getPropertyValue(name).trim()
    const style: StylesheetJson = [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'background-opacity': 0.13,
          'border-color': 'data(color)',
          'border-width': 1.5,
          label: 'data(label)',
          color: token('--text-secondary'),
          'font-size': 9,
          'font-family': 'Segoe UI, sans-serif',
          'text-valign': 'bottom',
          'text-margin-y': 8,
          'text-wrap': 'wrap',
          'text-max-width': '100px',
          width: 26,
          height: 26,
          shape: 'round-rectangle',
        },
      },
      { selector: 'node[essential]', style: { width: 34, height: 34, 'border-width': 2 } },
      {
        selector: 'edge',
        style: {
          width: 1.1,
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.65,
          'line-color': token('--graph-edge'),
          'target-arrow-color': token('--graph-arrow'),
          opacity: 0.85,
          'line-style': mode === 'cyber' ? 'solid' : 'dashed',
        },
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color': token('--accent'),
          'target-arrow-color': token('--accent'),
          width: 2,
        },
      },
      {
        selector: 'node:selected',
        style: {
          'background-opacity': 0.4,
          'border-width': 3,
          'border-color': token('--text'),
          color: token('--text'),
          'font-weight': 'bold',
        },
      },
      { selector: '.dim', style: { opacity: 0.15 } },
    ]
    const getColor = (asset: Asset) =>
      colors
        .getPropertyValue(
          preview && demoFor(asset.id)
            ? `--risk-${demoFor(asset.id)!.category}`
            : `--sector-${asset.sector}`,
        )
        .trim()
    const sectors = ['power', 'water', 'healthcare']
    const c = cytoscape({
      container: container.current,
      elements: [
        ...nodes.map((a) => {
          const groupIndex = sectors.indexOf(a.sector)
          const i = nodes.filter((n) => n.sector === a.sector).findIndex((n) => n.id === a.id)
          return {
            data: {
              id: a.id,
              label: `${a.id}\n${a.name.replace(/^(North |South |Central |Waterworks |Hospital |Aurora )/, '')}`,
              color: getColor(a),
              ...(a.criticality === 'essential' ? { essential: true } : {}),
            },
            position: {
              x: groupIndex * 300 + (i % 3) * 100,
              y: Math.floor(i / 3) * 115 + (i % 3 === 1 ? 25 : 0),
            },
          }
        }),
        ...edges.map((e) => ({
          data: { id: e.id, source: e.source_asset_id, target: e.target_asset_id },
        })),
      ],
      style,
      layout: { name: 'preset', fit: true, padding: 45 },
      minZoom: 0.25,
      maxZoom: 3,
    })
    cy.current = c
    if (selection.current) c.getElementById(selection.current).select()
    c.on('tap', 'node', (event: EventObject) => setSelected(event.target.id() as string))
    c.on('zoom', () => setZoom(Math.round(c.zoom() * 100)))
    const observer = new ResizeObserver(() => {
      c.resize()
      c.fit(undefined, 45)
    })
    observer.observe(container.current)
    if (focusId) {
      const target = c.getElementById(focusId)
      if (target.length) {
        target.select()
        c.center(target)
        c.zoom({ level: 1.5, position: target.position() })
      }
    }
    return () => {
      observer.disconnect()
      c.destroy()
      cy.current = null
    }
  }, [query.data, nodes, edges, mode, preview, focusId])
  useEffect(() => {
    const c = cy.current
    if (!c) return
    c.nodes().unselect()
    if (selected) c.getElementById(selected).select()
  }, [selected, nodes])
  const focus = (id: string) => {
    const c = cy.current
    const n = c?.getElementById(id)
    if (c && n?.length) {
      setSelected(id)
      c.center(n)
      c.zoom({ level: 1.6, position: n.position() })
    }
  }
  const matches = nodes.filter((a) =>
    `${a.name} ${a.id}`.toLowerCase().includes(search.toLowerCase()),
  )
  const selectedEdges = active
    ? edges.filter((e) => e.source_asset_id === active.id || e.target_asset_id === active.id)
    : []
  return (
    <>
      <PageHeading
        title="Infrastructure map"
        description="Two independent views. One inventory. Explore connections without confusing their meaning."
        actions={<SampleBadge>Fictional topology</SampleBadge>}
      />
      <div className="graph-mode-bar">
        <div className="segmented-control" aria-label="Graph display mode">
          <button
            aria-pressed={mode === 'cyber'}
            className={mode === 'cyber' ? 'selected' : ''}
            onClick={() => updateParams('mode', 'cyber')}
          >
            <Network size={16} />
            Cyber Reachability
          </button>
          <button
            aria-pressed={mode === 'operational'}
            className={mode === 'operational' ? 'selected' : ''}
            onClick={() => updateParams('mode', 'operational')}
          >
            <ArrowRight size={16} />
            Operational Dependencies
          </button>
        </div>
        <span className="subtle-label">
          {mode === 'cyber' ? 'CONNECTIVITY ≠ COMPROMISE' : 'PROVIDER → DEPENDENT'}
        </span>
      </div>
      <div className="graph-layout">
        <Panel
          title={mode === 'cyber' ? 'Cyber reachability graph' : 'Operational dependency graph'}
          aside={
            <span className="mono subtle-label">
              {nodes.length} NODES / {edges.length} EDGES
            </span>
          }
          className="graph-panel"
        >
          <div className="filter-toolbar">
            <label className="search-field">
              <Search size={15} />
              <input
                aria-label="Find graph asset"
                placeholder="Find an asset and press Enter…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matches[0]) focus(matches[0].id)
                }}
              />
            </label>
            <select
              aria-label="Graph sector"
              value={sector}
              onChange={(e) => updateParams('sector', e.target.value)}
            >
              <option value="all">All sectors</option>
              <option value="power">Power</option>
              <option value="water">Water</option>
              <option value="healthcare">Healthcare</option>
            </select>
            <button
              className="icon-button"
              title="Fit to screen"
              aria-label="Fit graph to screen"
              onClick={() => cy.current?.fit(undefined, 45)}
            >
              <Focus size={18} />
            </button>
          </div>
          {query.isPending || query.isError ? (
            <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
          ) : (
            <>
              <div
                className="graph-canvas"
                data-testid="graph-canvas"
                ref={container}
                role="img"
                aria-label={`${mode} directed graph, ${nodes.length} assets. Use the adjacent asset selector for keyboard inspection.`}
              />
              <div className="graph-controls">
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  onClick={() => {
                    const c = cy.current
                    if (c) c.zoom(c.zoom() / 1.2)
                  }}
                >
                  <Minus size={16} />
                </button>
                <span className="mono">{zoom}%</span>
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  onClick={() => {
                    const c = cy.current
                    if (c) c.zoom(c.zoom() * 1.2)
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </>
          )}
          <div className="graph-legend">
            <span>
              <i className="legend-dot power" />
              Power
            </span>
            <span>
              <i className="legend-dot water" />
              Water
            </span>
            <span>
              <i className="legend-dot healthcare" />
              Healthcare
            </span>
            <span className={`edge-legend ${mode}`} />
            {mode === 'cyber' ? 'Permitted direction' : 'Required / redundant / backup'}
          </div>
          <div className="panel-footnote">
            {mode === 'cyber'
              ? 'Directed paths represent fictional protocol and access assumptions. They do not establish exploit success or attack propagation.'
              : 'Edges point from provider to dependent. Backup and redundancy requirements are stored; cascading disruption is not calculated.'}
          </div>
        </Panel>
        <aside className="inspector panel">
          <div className="panel-heading">
            <h2>Node inspector</h2>
            {active && (
              <button
                className="icon-button"
                aria-label="Clear node selection"
                onClick={() => setSelected(null)}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="inspector-body">
            <label className="field-label" htmlFor="inspect-asset">
              Select asset to inspect
            </label>
            <select
              id="inspect-asset"
              value={active?.id ?? ''}
              onChange={(e) => focus(e.target.value)}
            >
              <option value="">Choose an asset…</option>
              {nodes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} · {a.name}
                </option>
              ))}
            </select>
            {active ? (
              <>
                <div className="node-emblem">
                  <Network size={27} />
                </div>
                <span className="mono subtle-label">{active.id}</span>
                <h3>{active.name}</h3>
                <SectorBadge sector={active.sector} />
                <dl className="detail-grid">
                  <dt>Type</dt>
                  <dd>{active.asset_type}</dd>
                  <dt>Zone</dt>
                  <dd>{active.security.network_zone}</dd>
                  <dt>Criticality</dt>
                  <dd>{active.criticality}</dd>
                  <dt>Assessment</dt>
                  <dd>Unavailable</dd>
                  <dt>Relationships</dt>
                  <dd>{selectedEdges.length} in this view</dd>
                </dl>
                {preview && demoFor(active.id) && (
                  <div className="inline-items">
                    <RiskBadge category={demoFor(active.id)!.category} />
                    <span className="tiny-demo">DEMO ONLY</span>
                  </div>
                )}
                <button
                  className="button secondary full-width"
                  onClick={() => setDetail(active.id)}
                >
                  Open asset details
                  <ArrowUpRight size={14} />
                </button>
                <div className="relationship-list">
                  {selectedEdges.map((edge) => (
                    <div key={edge.id}>
                      <span className="mono">
                        {edge.source_asset_id} → {edge.target_asset_id}
                      </span>
                      <small>
                        {edge.kind === 'cyber'
                          ? `${edge.protocol} · ${edge.access.replaceAll('_', ' ')}`
                          : `${edge.dependency} · ${edge.requirement}`}
                      </small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="inspector-empty">
                <Network size={40} strokeWidth={1} />
                <h3>Follow a connection</h3>
                <p>
                  Select a node on the map or use the selector to inspect its configuration and
                  relationships.
                </p>
              </div>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preview}
                onChange={(e) => setPreview(e.target.checked)}
              />
              Show demo risk colors
            </label>
            <p className="muted small">
              Preview colors are illustrative, not calculated assessments. Unlabelled assets retain
              sector colors.
            </p>
            {preview && (
              <div className="demo-risk-legend">
                <span className="tiny-demo">DEMO LABELS</span>
                {categoryLabels.map((category) => (
                  <span key={category}>
                    <i className={`legend-dot ${category}`} />
                    {category}
                  </span>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
      <AssetDrawer id={detail} onClose={() => setDetail(null)} />
    </>
  )
}
