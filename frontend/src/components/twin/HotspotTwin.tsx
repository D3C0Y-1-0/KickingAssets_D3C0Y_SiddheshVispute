import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Plate } from '../iso/react/draw'
import { RadarPing, RiskLine } from '../TwinRadar'
import { FlowOverlay, type LinkMode } from './FlowOverlay'
import { TwinInspector } from './TwinInspector'
import { useTwinNav } from './TwinNav'
import { useStageView } from './useStageView'
import { useLatestRun } from '../../hooks/queries'
import { usePartLinks } from '../../hooks/twinConnections'
import type { TwinRisk } from '../../hooks/twinRisk'
import type { TwinView } from '../../data/twinParts'
import './twin.css'

export interface TwinHotspot {
  id: string
  label: string
  sub?: string
  /** Pin position in diagram pixels. */
  coord: [number, number]
  metric?: string
  value?: string
}

export interface TwinToggle {
  id: string
  label: string
  icon: LucideIcon
  initial?: boolean
}

interface Props {
  view: TwinView
  title: string
  badge: string
  subtitle: string
  icon: LucideIcon
  fig: string
  plateTitle: string
  ariaLabel: string
  width: number
  height: number
  hotspots: TwinHotspot[]
  initialPart: string
  initialZoom?: number
  risk: Record<string, TwinRisk>
  /** Illustrative design values. Shown as a reference, never as live telemetry. */
  reference?: { label: string; value: string }[]
  toggles?: TwinToggle[]
  renderArt: (ctx: {
    selectedId: string
    onSelect: (id: string) => void
    toggles: Record<string, boolean>
  }) => ReactNode
}

/** Shared shell for the single-site twins (water, hospital, transit). */
export function HotspotTwin({
  view,
  title,
  badge,
  subtitle,
  icon: Icon,
  fig,
  plateTitle,
  ariaLabel,
  width,
  height,
  hotspots,
  initialPart,
  initialZoom = 0.9,
  risk,
  reference,
  toggles = [],
  renderArt,
}: Props) {
  const stage = useStageView({ initialZoom, content: { width, height } })
  const { requestedPart } = useTwinNav()
  const [selectedId, setSelectedId] = useState(initialPart)
  const [hovered, setHovered] = useState<string | null>(null)
  const [linkMode, setLinkMode] = useState<LinkMode>('operational')
  const [showPins, setShowPins] = useState(true)
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(toggles.map((t) => [t.id, t.initial ?? true])),
  )

  const links = usePartLinks()
  const run = useLatestRun().data
  const scored = useMemo(() => new Map((run?.assets ?? []).map((a) => [a.asset_id, a])), [run])
  const byId = useMemo(() => new Map(hotspots.map((h) => [h.id, h])), [hotspots])
  const points = useMemo(
    () =>
      Object.fromEntries(hotspots.map((h) => [h.id, h.coord])) as Record<string, [number, number]>,
    [hotspots],
  )

  const select = (id: string, center = false) => {
    setSelectedId(id)
    const h = byId.get(id)
    if (center && h) stage.centerOn(h.coord[0], h.coord[1], width, height)
  }

  // Another screen or a connection chip asked for a part of this twin.
  const { centerOn } = stage
  useEffect(() => {
    const h = requestedPart ? byId.get(requestedPart) : undefined
    if (h) {
      setSelectedId(h.id)
      centerOn(h.coord[0], h.coord[1], width, height)
    }
  }, [requestedPart, byId, centerOn, width, height])

  const focusId = hovered ?? selectedId
  const neighbours = useMemo(() => {
    const set = new Set<string>()
    for (const l of links) {
      if (l.kind !== linkMode) continue
      if (l.from === focusId) set.add(l.to)
      if (l.to === focusId) set.add(l.from)
    }
    return set
  }, [links, linkMode, focusId])

  return (
    <div ref={stage.frameRef} className={`ts-frame${stage.isFullScreen ? ' full' : ''}`}>
      <div className="ts-bar">
        <div className="ts-title">
          <Icon size={20} color="#ccff00" aria-hidden />
          <div>
            <h2>
              {title} <span className="ts-badge">{badge}</span>
            </h2>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="ts-tools">
          <div className="ts-group" role="group" aria-label="Connection overlay">
            {(['operational', 'cyber', 'off'] as const).map((m) => (
              <button
                key={m}
                className="ts-btn"
                aria-pressed={linkMode === m}
                onClick={() => setLinkMode(m)}
                title={
                  m === 'operational'
                    ? 'Operational dependencies, provider to dependent'
                    : m === 'cyber'
                      ? 'Cyber reachability, permitted access paths'
                      : 'Hide connections'
                }
              >
                {m === 'off' ? 'Links off' : m === 'operational' ? 'Operational' : 'Cyber'}
              </button>
            ))}
          </div>
          <div className="ts-group" role="group" aria-label="Layers">
            {toggles.map((t) => (
              <button
                key={t.id}
                className="ts-btn"
                aria-pressed={on[t.id]}
                title={t.label}
                onClick={() => setOn((p) => ({ ...p, [t.id]: !p[t.id] }))}
              >
                <t.icon size={14} />
                <span>{t.label}</span>
              </button>
            ))}
            <button
              className="ts-btn"
              aria-pressed={showPins}
              onClick={() => setShowPins((v) => !v)}
              title="Show or hide part pins"
            >
              Pins
            </button>
          </div>
          <div className="ts-group" role="group" aria-label="View">
            <button className="ts-btn" onClick={stage.zoomIn} aria-label="Zoom in" title="Zoom in">
              <ZoomIn size={15} />
            </button>
            <span className="ts-zoom" aria-live="polite">
              {Math.round(stage.zoom * 100)}%
            </span>
            <button
              className="ts-btn"
              onClick={stage.zoomOut}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut size={15} />
            </button>
            <button
              className="ts-btn"
              onClick={stage.reset}
              aria-label="Reset view"
              title="Reset view"
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="ts-btn"
              onClick={stage.toggleFullScreen}
              aria-label={stage.isFullScreen ? 'Exit full screen' : 'Full screen'}
              title={stage.isFullScreen ? 'Exit full screen (Esc)' : 'Full screen'}
            >
              {stage.isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>
      </div>
      {reference && (
        <div className="ts-ref">
          <em>Design reference, not live:</em>
          {reference.map((r) => (
            <span key={r.label}>
              {r.label} <b>{r.value}</b>
            </span>
          ))}
        </div>
      )}

      <div className="ts-body">
        <div
          ref={stage.stageRef}
          className={`ts-stage${stage.dragging ? ' dragging' : ''}`}
          aria-label={`${ariaLabel}. Drag to pan, Ctrl or Cmd plus scroll to zoom, plus and minus keys to zoom.`}
          {...stage.stageProps}
        >
          <Plate fig={fig} title={plateTitle}>
            <div className="ts-center" style={stage.transformStyle}>
              <div className="ts-box" style={{ width, height }}>
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-full iso-svg block"
                  role="img"
                  aria-label={ariaLabel}
                >
                  {renderArt({ selectedId, onSelect: (id) => select(id), toggles: on })}
                </svg>
                <FlowOverlay
                  width={width}
                  height={height}
                  points={points}
                  links={links}
                  mode={linkMode}
                  focusId={focusId}
                />
                {showPins &&
                  hotspots.map((h) => {
                    const sel = selectedId === h.id
                    return (
                      <button
                        key={h.id}
                        className={`ts-part${sel ? ' sel' : ''}${neighbours.has(h.id) ? ' linked' : ''}${
                          linkMode !== 'off' &&
                          focusId &&
                          !sel &&
                          !neighbours.has(h.id) &&
                          neighbours.size
                            ? ' dim'
                            : ''
                        }`}
                        style={{ left: h.coord[0], top: h.coord[1] }}
                        aria-label={`${h.label}${sel ? ', selected' : ''}`}
                        aria-pressed={sel}
                        onClick={(e) => {
                          e.stopPropagation()
                          select(h.id)
                        }}
                        onPointerEnter={() => setHovered(h.id)}
                        onPointerLeave={() => setHovered(null)}
                        onFocus={() => setHovered(h.id)}
                        onBlur={() => setHovered(null)}
                      >
                        <RadarPing risk={risk[h.id]} />
                        <span className="ts-pin" />
                        <span className="ts-tip">
                          {h.metric && (
                            <i>
                              {h.metric}: {h.value}
                            </i>
                          )}
                          <b>{h.label}</b>
                          {h.sub && <span>{h.sub}</span>}
                          <RiskLine risk={risk[h.id]} />
                        </span>
                      </button>
                    )
                  })}
              </div>
            </div>
          </Plate>
          <span className="ts-hint">
            DRAG TO PAN · CTRL + SCROLL TO ZOOM · CLICK A PART · + − 0 KEYS
          </span>
        </div>

        <TwinInspector
          view={view}
          parts={hotspots}
          selectedId={selectedId}
          onSelect={(id) => select(id, true)}
          risk={risk}
          scored={scored}
          links={links}
        />
      </div>
    </div>
  )
}
