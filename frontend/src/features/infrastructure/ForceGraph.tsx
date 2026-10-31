import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from 'd3-force'
import { drag } from 'd3-drag'
import { select, type Selection } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import type { Asset, GraphMode } from '../../api/client'

export type ForceEdge = {
  id: string
  source_asset_id: string
  target_asset_id: string
}

export type ForceGraphHandle = {
  fit: () => void
  zoomBy: (factor: number) => void
  focus: (id: string) => void
  relayout: () => void
}

type Props = {
  nodes: Asset[]
  edges: ForceEdge[]
  mode: GraphMode
  selected: string | null
  /** Resolved CSS colour for a node. */
  colorOf: (asset: Asset) => string
  onSelect: (id: string | null) => void
  onZoom?: (percent: number) => void
}

type SimNode = Asset & {
  x: number
  y: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
  r: number
}
type SimLink = { id: string; source: SimNode; target: SimNode; index: number; curve: number }

const RADIUS = { essential: 17, important: 13, supporting: 10 } as const
const SECTORS = ['power', 'water', 'healthcare']
const shortName = (a: Asset) =>
  a.name.replace(/^(North |South |Central |Waterworks |Hospital |Aurora )/, '')

/**
 * Force-directed network view. The simulation lays assets out by their
 * relationships; sectors are only a weak gravitational hint so that clusters
 * emerge without hiding cross-sector links. Nothing here computes risk.
 */
export const ForceGraph = forwardRef<ForceGraphHandle, Props>(function ForceGraph(
  { nodes, edges, mode, selected, colorOf, onSelect, onZoom },
  ref,
) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<ForceGraphHandle | null>(null)
  const highlight = useRef<(id: string | null) => void>(() => {})
  const selectedRef = useRef(selected)
  const onSelectRef = useRef(onSelect)
  const onZoomRef = useRef(onZoom)
  const colorRef = useRef(colorOf)
  useEffect(() => {
    onSelectRef.current = onSelect
    onZoomRef.current = onZoom
    colorRef.current = colorOf
  })

  useImperativeHandle(
    ref,
    () => ({
      fit: () => api.current?.fit(),
      zoomBy: (f) => api.current?.zoomBy(f),
      focus: (id) => api.current?.focus(id),
      relayout: () => api.current?.relayout(),
    }),
    [],
  )

  // Rebuild the simulation only when the topology changes.
  useEffect(() => {
    const el = host.current
    if (!el) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const css = getComputedStyle(el)
    const token = (n: string) => css.getPropertyValue(n).trim()
    let width = el.clientWidth || 800
    let height = el.clientHeight || 500

    const simNodes: SimNode[] = nodes.map((a, i) => {
      const s = Math.max(0, SECTORS.indexOf(a.sector))
      const angle = (s / SECTORS.length) * Math.PI * 2 - Math.PI / 2
      return {
        ...a,
        r: RADIUS[a.criticality] ?? 11,
        x: Math.cos(angle) * 140 + Math.cos(i * 2.4) * 40,
        y: Math.sin(angle) * 140 + Math.sin(i * 2.4) * 40,
      }
    })
    const byId = new Map(simNodes.map((n) => [n.id, n]))
    const pairCount = new Map<string, number>()
    const simLinks: SimLink[] = []
    edges.forEach((e, index) => {
      const source = byId.get(e.source_asset_id)
      const target = byId.get(e.target_asset_id)
      if (!source || !target) return
      // Offset reciprocal / parallel edges so every direction stays visible.
      const key = [source.id, target.id].sort().join('|')
      const seen = pairCount.get(key) ?? 0
      pairCount.set(key, seen + 1)
      const flip = source.id > target.id ? -1 : 1
      simLinks.push({ id: e.id, source, target, index, curve: seen === 0 ? 0 : flip * seen * 0.35 })
    })
    const degree = new Map<string, number>()
    simLinks.forEach((l) => {
      degree.set(l.source.id, (degree.get(l.source.id) ?? 0) + 1)
      degree.set(l.target.id, (degree.get(l.target.id) ?? 0) + 1)
    })
    const neighbours = new Map<string, Set<string>>()
    simLinks.forEach((l) => {
      if (!neighbours.has(l.source.id)) neighbours.set(l.source.id, new Set())
      if (!neighbours.has(l.target.id)) neighbours.set(l.target.id, new Set())
      neighbours.get(l.source.id)!.add(l.target.id)
      neighbours.get(l.target.id)!.add(l.source.id)
    })

    const svg = select(el)
      .append('svg')
      .attr('class', 'fg-svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('role', 'presentation')
    const defs = svg.append('defs')
    const marker = (id: string, color: string) =>
      defs
        .append('marker')
        .attr('id', `fg-arrow-${id}-${mode}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 9)
        .attr('refY', 0)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L9,0L0,4Z')
        .attr('fill', color)
    marker('base', token('--graph-arrow'))
    marker('hot', token('--accent'))

    const glow = defs.append('filter').attr('id', `fg-glow-${mode}`)
    glow.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'b')
    const merge = glow.append('feMerge')
    merge.append('feMergeNode').attr('in', 'b')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    const world = svg.append('g').attr('class', 'fg-world')
    const linkLayer = world.append('g')
    const nodeLayer = world.append('g')

    const linkSel = linkLayer
      .selectAll<SVGPathElement, SimLink>('path')
      .data(simLinks, (d) => d.id)
      .join('path')
      .attr('class', `fg-link ${mode}`)
      .attr('fill', 'none')
      .attr('marker-end', `url(#fg-arrow-base-${mode})`)

    const nodeSel = nodeLayer
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes, (d) => d.id)
      .join('g')
      .attr('class', 'fg-node')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.id} ${d.name}, ${d.sector}, ${d.criticality}`)
    nodeSel
      .append('circle')
      .attr('class', 'fg-halo')
      .attr('r', (d) => d.r + 7)
      .attr('fill', (d) => colorRef.current(d))
    nodeSel
      .append('circle')
      .attr('class', 'fg-body')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => colorRef.current(d))
      .attr('stroke', (d) => colorRef.current(d))
    nodeSel
      .filter((d) => d.criticality === 'essential')
      .append('circle')
      .attr('class', 'fg-ring')
      .attr('r', (d) => d.r + 4)
      .attr('stroke', (d) => colorRef.current(d))
    nodeSel
      .append('text')
      .attr('class', 'fg-id')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .text((d) => d.id.split(/[-_]/).pop() ?? d.id)
    const label = nodeSel
      .append('text')
      .attr('class', 'fg-label')
      .attr('text-anchor', 'middle')
      .attr('y', (d) => d.r + 15)
    label
      .append('tspan')
      .attr('class', 'fg-label-id')
      .attr('x', 0)
      .text((d) => d.id)
    label
      .append('tspan')
      .attr('class', 'fg-label-name')
      .attr('x', 0)
      .attr('dy', '1.25em')
      .text((d) => shortName(d))
    nodeSel.append('title').text((d) => `${d.id} · ${d.name}`)

    const linkPath = (l: SimLink) => {
      const sx = l.source.x
      const sy = l.source.y
      const tx = l.target.x
      const ty = l.target.y
      const dx = tx - sx
      const dy = ty - sy
      const dist = Math.hypot(dx, dy) || 1
      const ux = dx / dist
      const uy = dy / dist
      // Trim to node edges so arrowheads touch the outline, not the centre.
      const x1 = sx + ux * (l.source.r + 2)
      const y1 = sy + uy * (l.source.r + 2)
      const x2 = tx - ux * (l.target.r + 4)
      const y2 = ty - uy * (l.target.r + 4)
      if (!l.curve) return `M${x1},${y1}L${x2},${y2}`
      const mx = (x1 + x2) / 2 - uy * dist * l.curve
      const my = (y1 + y2) / 2 + ux * dist * l.curve
      return `M${x1},${y1}Q${mx},${my} ${x2},${y2}`
    }
    const paint = () => {
      linkSel.attr('d', linkPath)
      nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`)
    }

    const sectorAnchor = (sector: string) => {
      const s = Math.max(0, SECTORS.indexOf(sector))
      const spread = Math.min(width, height) * 0.19
      const angle = (s / SECTORS.length) * Math.PI * 2 - Math.PI / 2
      return { x: Math.cos(angle) * spread, y: Math.sin(angle) * spread }
    }

    const sim: Simulation<SimNode, undefined> = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(
            (l) => (mode === 'cyber' ? 62 : 74) + 8 * Math.min(6, degree.get(l.source.id) ?? 0),
          )
          .strength(0.55),
      )
      .force(
        'charge',
        forceManyBody<SimNode>()
          .strength((d) => -170 - 25 * (degree.get(d.id) ?? 0))
          .distanceMax(420),
      )
      .force('collide', forceCollide<SimNode>((d) => d.r + 18).strength(0.9))
      .force('x', forceX<SimNode>((d) => sectorAnchor(d.sector).x).strength(0.12))
      .force('y', forceY<SimNode>((d) => sectorAnchor(d.sector).y).strength(0.12))
      .alphaDecay(0.028)
      .velocityDecay(0.38)
      .on('tick', paint)

    // --- zoom / pan -------------------------------------------------------
    const zoomer: ZoomBehavior<HTMLDivElement, unknown> = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.25, 4])
      .filter((event) => !event.ctrlKey || event.type === 'wheel')
      .on('zoom', (event) => {
        world.attr('transform', event.transform.toString())
        el.style.setProperty('--fg-k', String(event.transform.k))
        onZoomRef.current?.(Math.round(event.transform.k * 100))
      })
    const container = select(el)
    container.call(zoomer).on('dblclick.zoom', null)

    const bounds = () => {
      if (!simNodes.length) return null
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const n of simNodes) {
        x0 = Math.min(x0, n.x - n.r - 30)
        x1 = Math.max(x1, n.x + n.r + 30)
        y0 = Math.min(y0, n.y - n.r - 20)
        y1 = Math.max(y1, n.y + n.r + 44)
      }
      return { x0, y0, x1, y1 }
    }
    const fit = (animate = true) => {
      const b = bounds()
      if (!b) return
      const k = Math.min(1.6, 0.94 / Math.max((b.x1 - b.x0) / width, (b.y1 - b.y0) / height))
      const t = zoomIdentity
        .translate(width / 2 - (k * (b.x0 + b.x1)) / 2, height / 2 - (k * (b.y0 + b.y1)) / 2)
        .scale(k)
      if (animate && !reduceMotion) {
        container.transition().duration(550).call(zoomer.transform, t)
      } else {
        container.interrupt().call(zoomer.transform, t)
      }
    }
    api.current = {
      fit: () => fit(),
      zoomBy: (f) => {
        if (reduceMotion) container.call(zoomer.scaleBy, f)
        else container.transition().duration(180).call(zoomer.scaleBy, f)
      },
      focus: (id) => {
        const n = byId.get(id)
        if (!n) return
        const t = zoomIdentity
          .translate(width / 2, height / 2)
          .scale(1.5)
          .translate(-n.x, -n.y)
        if (reduceMotion) container.call(zoomer.transform, t)
        else container.transition().duration(550).call(zoomer.transform, t)
      },
      relayout: () => {
        simNodes.forEach((n) => {
          n.fx = null
          n.fy = null
        })
        sim.alpha(0.9).restart()
      },
    }

    // --- interaction ------------------------------------------------------
    let hovered: string | null = null
    const apply = () => {
      const focusId = hovered ?? selectedRef.current
      const near = focusId ? neighbours.get(focusId) : undefined
      nodeSel
        .classed('is-selected', (d) => d.id === selectedRef.current)
        .classed('is-dim', (d) => !!focusId && d.id !== focusId && !near?.has(d.id))
      linkSel
        .classed('is-hot', (l) => !!focusId && (l.source.id === focusId || l.target.id === focusId))
        .classed('is-dim', (l) => !!focusId && l.source.id !== focusId && l.target.id !== focusId)
        .attr('marker-end', (l) =>
          focusId && (l.source.id === focusId || l.target.id === focusId)
            ? `url(#fg-arrow-hot-${mode})`
            : `url(#fg-arrow-base-${mode})`,
        )
      linkSel.filter('.is-hot').raise()
    }
    highlight.current = (id) => {
      selectedRef.current = id
      apply()
    }

    const dragger = drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.25).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0)
        // Release so the layout keeps responding to the relationships.
        d.fx = null
        d.fy = null
      })
    nodeSel
      .call(dragger)
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation()
        onSelectRef.current(d.id)
      })
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelectRef.current(d.id)
        }
      })
      .on('pointerenter', (_e, d) => {
        hovered = d.id
        apply()
      })
      .on('pointerleave', () => {
        hovered = null
        apply()
      })
      .on('focus', (_e, d) => {
        hovered = d.id
        apply()
      })
      .on('blur', () => {
        hovered = null
        apply()
      })
    svg.on('click', () => onSelectRef.current(null))

    // Settle quietly off-screen first so the first paint is already organised.
    const warm = reduceMotion ? 300 : 120
    sim.stop()
    for (let i = 0; i < warm; i += 1) sim.tick()
    paint()
    fit(false)
    apply()
    if (!reduceMotion) sim.alpha(0.35).restart()

    const observer = new ResizeObserver(() => {
      width = el.clientWidth || width
      height = el.clientHeight || height
    })
    observer.observe(el)
    // Re-fit once the layout has relaxed, unless the user already moved the view.
    const refit = reduceMotion
      ? 0
      : window.setTimeout(() => {
          if (!el.dataset.touched) fit()
        }, 1400)
    const touch = () => {
      el.dataset.touched = '1'
    }
    el.addEventListener('wheel', touch, { passive: true })
    el.addEventListener('pointerdown', touch)

    return () => {
      window.clearTimeout(refit)
      observer.disconnect()
      el.removeEventListener('wheel', touch)
      el.removeEventListener('pointerdown', touch)
      delete el.dataset.touched
      sim.stop()
      container.on('.zoom', null).interrupt()
      ;(svg as Selection<SVGSVGElement, unknown, null, undefined>).remove()
      api.current = null
      highlight.current = () => {}
    }
  }, [nodes, edges, mode])

  useEffect(() => {
    selectedRef.current = selected
    highlight.current(selected)
  }, [selected, nodes, edges, mode])

  // Recolour in place (e.g. demo risk colours) without restarting the layout.
  useEffect(() => {
    const el = host.current
    if (!el) return
    select(el)
      .selectAll<SVGCircleElement, SimNode>('.fg-halo, .fg-body, .fg-ring')
      .each(function (d) {
        const c = colorOf(d)
        const s = select(this)
        s.attr('stroke', c)
        if (!s.classed('fg-ring')) s.attr('fill', c)
      })
  }, [colorOf, nodes, edges, mode])

  return <div className="fg-host" ref={host} />
})
