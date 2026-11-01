import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Focus,
  Minus,
  Maximize2,
  Minimize2,
  Network,
  PanelRight,
  Plus,
  Search,
  Shuffle,
  X,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useGraph, useLatestRun, useIntelligence } from '../../hooks/queries'
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
import { categoryLabels } from '../../lib/risk'
import { ForceGraph, type ForceGraphHandle } from './ForceGraph'

export default function Infrastructure() {
  const [params, setParams] = useSearchParams()
  const mode: GraphMode = params.get('mode') === 'operational' ? 'operational' : 'cyber'
  const requestedSector = params.get('sector') ?? 'all'
  const sector = ['all', 'power', 'water', 'healthcare'].includes(requestedSector)
    ? requestedSector
    : 'all'
  const focusId = params.get('focus')
  const query = useGraph(mode)
  const graph = useRef<ForceGraphHandle>(null)
  const [selected, setSelected] = useState<string | null>(focusId)
  const [detail, setDetail] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState(false)
  const latestRun = useLatestRun()
  const curated = useIntelligence()
  const [riskSource, setRiskSource] = useState('workflow')
  const runAssets = latestRun.data?.assets
  const riskOf = (id: string) =>
    riskSource === 'curated'
      ? curated.isError
        ? undefined
        : curated.data?.assets.find((a) => a.asset_id === id)?.risk
      : runAssets?.find((a) => a.asset_id === id)?.risk
  const [zoom, setZoom] = useState(100)
  const [fullscreen, setFullscreen] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  useEffect(() => {
    if (selected) setShowInspector(true)
  }, [selected])
  useEffect(() => {
    const t = window.setTimeout(() => graph.current?.fit(), 150)
    if (!fullscreen) return () => window.clearTimeout(t)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [fullscreen])
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

  const colorOf = useCallback(
    (asset: Asset) => {
      const root = getComputedStyle(document.documentElement)
      const category = preview ? riskOf(asset.id)?.category : undefined
      return root
        .getPropertyValue(
          category
            ? `--risk-${category}`
            : preview
              ? '--text-secondary'
              : `--sector-${asset.sector}`,
        )
        .trim()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview, runAssets, riskSource, curated.data, curated.isError],
  )
  const focus = (id: string) => {
    setSelected(id)
    graph.current?.focus(id)
  }
  useEffect(() => {
    if (focusId) graph.current?.focus(focusId)
  }, [focusId, nodes, mode])
  const matches = nodes.filter((a) =>
    `${a.name} ${a.id}`.toLowerCase().includes(search.toLowerCase()),
  )
  const selectedEdges = active
    ? edges.filter((e) => e.source_asset_id === active.id || e.target_asset_id === active.id)
    : []
  return (
    <div className="graph-full">
      <PageHeading
        title="Infrastructure map"
        description="Two independent views. One inventory. Explore connections without confusing their meaning."
        actions={
          <>
            <SampleBadge>Fictional topology</SampleBadge>
            <Link className="button secondary" to="/attack-paths">
              Inspect attack paths
            </Link>
            <Link
              className="button secondary"
              to={`/resilience-planner${selected ? `?asset=${selected}` : ''}`}
            >
              Open Resilience Planner
            </Link>
          </>
        }
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
      <div
        className={`graph-layout ${fullscreen ? 'graph-fs' : ''} ${showInspector ? '' : 'inspector-hidden'}`}
      >
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
            <select
              aria-label="Graph view"
              value={mode}
              onChange={(e) => updateParams('mode', e.target.value)}
            >
              <option value="cyber">Cyber reachability</option>
              <option value="operational">Operational dependencies</option>
            </select>
            <button
              className={`icon-button ${showInspector ? 'on' : ''}`}
              title={showInspector ? 'Hide inspector' : 'Show inspector'}
              aria-label={showInspector ? 'Hide node inspector' : 'Show node inspector'}
              aria-pressed={showInspector}
              onClick={() => setShowInspector((v) => !v)}
            >
              <PanelRight size={18} />
            </button>
            <button
              className="icon-button"
              title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
              aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              className="icon-button"
              title="Fit to screen"
              aria-label="Fit graph to screen"
              onClick={() => graph.current?.fit()}
            >
              <Focus size={18} />
            </button>
            <button
              className="icon-button"
              title="Re-run layout"
              aria-label="Re-run force layout"
              onClick={() => graph.current?.relayout()}
            >
              <Shuffle size={18} />
            </button>
          </div>
          {query.isPending || query.isError ? (
            <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
          ) : (
            <>
              <div
                className="graph-canvas"
                data-testid="graph-canvas"
                role="group"
                aria-label={`${mode} directed force graph, ${nodes.length} assets. Drag nodes to rearrange, scroll to zoom. Nodes are keyboard focusable; the adjacent asset selector is also available.`}
              >
                <ForceGraph
                  ref={graph}
                  nodes={nodes}
                  edges={edges}
                  mode={mode}
                  selected={selected}
                  colorOf={colorOf}
                  onSelect={setSelected}
                  onZoom={setZoom}
                />
              </div>
              <div className="graph-controls">
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  onClick={() => {
                    graph.current?.zoomBy(1 / 1.3)
                  }}
                >
                  <Minus size={16} />
                </button>
                <span className="mono">{zoom}%</span>
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  onClick={() => {
                    graph.current?.zoomBy(1.3)
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
            {mode === 'cyber'
              ? 'Permitted access direction (not compromise)'
              : 'Provider → dependent; dotted edges are declared standby'}
          </div>
          <div className="panel-footnote">
            {mode === 'cyber'
              ? 'Directed paths represent fictional protocol and access assumptions. They do not establish exploit success or attack propagation.'
              : 'Edges are direct provider → dependent relationships; indirect dependencies follow multiple edges. Hover an edge or use the inspector for its requirement, group and grace period. This map shows topology; use Resilience Planner for calculated conditional disruption.'}
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
                  <dd>
                    {riskOf(active.id)?.score != null
                      ? `${riskOf(active.id)!.score!.toFixed(1)} (${riskOf(active.id)!.category})`
                      : 'Run the simulation'}
                  </dd>
                  <dt>Relationships</dt>
                  <dd>{selectedEdges.length} in this view</dd>
                </dl>
                {riskOf(active.id)?.category && (
                  <div className="inline-items">
                    <RiskBadge category={riskOf(active.id)!.category} />
                    <span className="subtle-label">COMPUTED</span>
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
                          : `${edge.dependency} · ${edge.requirement} · grace ${edge.grace_period_minutes} min${edge.redundancy_group ? ` · ${edge.redundancy_group}: minimum ${edge.minimum_providers}` : ''}`}
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
            <label className="field-label" htmlFor="map-risk-source">
              Calculated risk source
            </label>
            <select
              id="map-risk-source"
              value={riskSource}
              onChange={(e) => setRiskSource(e.target.value)}
            >
              <option value="workflow">Workflow product map</option>
              <option value="curated">Curated Apache overlay</option>
            </select>
            {riskSource === 'curated' && (
              <QueryState
                pending={curated.isPending}
                error={curated.error}
                retry={curated.refetch}
              />
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preview}
                disabled={riskSource === 'workflow' ? !runAssets : !curated.data || curated.isError}
                onChange={(e) => setPreview(e.target.checked)}
              />
              Color by computed risk
            </label>
            <p className="muted small">
              {riskSource === 'curated'
                ? 'Curated overlay priorities: partial coverage. Grey means unavailable. Different software assumptions and policy from the workflow.'
                : runAssets
                  ? 'Colors come from the latest simulation.'
                  : 'Run the simulation on the overview to color assets by risk.'}
            </p>
            {preview && (
              <div className="demo-risk-legend">
                <span className="subtle-label">COMPUTED</span>
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
    </div>
  )
}
