import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react'

export interface StageViewOptions {
  initialZoom?: number
  minZoom?: number
  maxZoom?: number
  /** Diagram size in pixels. When given, the view fits the stage until the user moves it. */
  content?: { width: number; height: number }
}

interface View {
  zoom: number
  x: number
  y: number
}

const DRAG_THRESHOLD = 4

/**
 * Pan / zoom / fullscreen for an isometric diagram.
 * - fits the whole diagram to the stage (and refits on resize) until the user moves it
 * - drag to pan (a click on a part still selects it; only real drags swallow the click)
 * - Ctrl/Cmd + wheel zooms towards the cursor, two-finger pinch zooms on touch
 * - focus the stage and use + / - / 0 / arrow keys
 * The transformed element must have the diagram box as its only child, so the
 * transform origin sits at the diagram centre (see `centerOn`).
 */
export function useStageView({
  initialZoom = 0.9,
  minZoom = 0.2,
  maxZoom = 3,
  content,
}: StageViewOptions = {}) {
  const cw = content?.width
  const ch = content?.height
  const frameRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ zoom: initialZoom, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [animate, setAnimate] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    sx: number
    sy: number
    vx: number
    vy: number
    moved: boolean
  } | null>(null)
  const pinch = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const touched = useRef(false)
  const viewRef = useRef(view)
  viewRef.current = view

  const clamp = useCallback(
    (z: number) => Math.min(maxZoom, Math.max(minZoom, z)),
    [minZoom, maxZoom],
  )

  const fitZoom = useCallback(() => {
    const r = stageRef.current?.getBoundingClientRect()
    if (!r || !cw || !ch || !r.width) return initialZoom
    return clamp(Math.min(r.width / cw, (r.height - 44) / ch) * 1.12)
  }, [cw, ch, initialZoom, clamp])

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      touched.current = true
      const rect = stageRef.current?.getBoundingClientRect()
      const cx = rect ? clientX - rect.left - rect.width / 2 : 0
      const cy = rect ? clientY - rect.top - rect.height / 2 : 0
      setView((v) => {
        const zoom = clamp(v.zoom * factor)
        const r = zoom / v.zoom
        return { zoom, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }
      })
    },
    [clamp],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      setAnimate(true)
      const rect = stageRef.current?.getBoundingClientRect()
      if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
    },
    [zoomAt],
  )

  const reset = useCallback(() => {
    touched.current = false
    setAnimate(true)
    setView({ zoom: fitZoom(), x: 0, y: 0 })
  }, [fitZoom])

  // Keep the whole diagram in view while the stage is sized or resized, until the user moves it.
  useEffect(() => {
    const el = stageRef.current
    if (!el || !cw || !ch) return
    const apply = () => {
      if (!touched.current) setView({ zoom: fitZoom(), x: 0, y: 0 })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cw, ch, fitZoom])

  /** Bring a point of the diagram (in diagram pixels) to the middle of the stage. */
  const centerOn = useCallback(
    (px: number, py: number, width: number, height: number, zoom?: number) => {
      // The whole diagram is already in view: nothing to bring closer.
      if (zoom === undefined && viewRef.current.zoom <= fitZoom() * 1.05) return
      touched.current = true
      setAnimate(true)
      setView((v) => {
        const z = clamp(zoom ?? v.zoom)
        return { zoom: z, x: -(px - width / 2) * z, y: -(py - height / 2) * z }
      })
    },
    [clamp, fitZoom],
  )

  // Wheel needs a non-passive native listener so the page does not scroll with it.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // Plain wheel scrolls the page; Ctrl/Cmd + wheel (and trackpad pinch) zooms the diagram.
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setAnimate(false)
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setAnimate(false)
    if (pointers.current.size === 1) {
      const v = viewRef.current
      gesture.current = { sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
      if (gesture.current) gesture.current.moved = true
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / pinch.current)
      pinch.current = dist
      suppressClick.current = true
      return
    }
    const g = gesture.current
    if (!g || pointers.current.size !== 1) return
    const dx = e.clientX - g.sx
    const dy = e.clientY - g.sy
    if (!g.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      g.moved = true
      touched.current = true
      setDragging(true)
      stageRef.current?.setPointerCapture(e.pointerId)
    }
    if (g.moved) setView((v) => ({ ...v, x: g.vx + dx, y: g.vy + dy }))
  }

  const endPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return
    if (gesture.current?.moved) {
      suppressClick.current = true
      window.setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    if (pointers.current.size === 0) {
      gesture.current = null
      setDragging(false)
    }
    pinch.current = null
  }

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const step = 48
    const pan = (dx: number, dy: number) => {
      e.preventDefault()
      touched.current = true
      setAnimate(true)
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoomBy(1.2)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      zoomBy(1 / 1.2)
    } else if (e.key === '0') {
      e.preventDefault()
      reset()
    } else if (e.key === 'ArrowLeft') pan(step, 0)
    else if (e.key === 'ArrowRight') pan(-step, 0)
    else if (e.key === 'ArrowUp') pan(0, step)
    else if (e.key === 'ArrowDown') pan(0, -step)
  }

  // --- fullscreen -----------------------------------------------------------
  const toggleFullScreen = useCallback(() => {
    if (!isFullScreen) {
      setIsFullScreen(true)
      frameRef.current?.requestFullscreen?.().catch(() => {})
    } else {
      setIsFullScreen(false)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [isFullScreen])

  useEffect(() => {
    if (!isFullScreen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullScreen(false)
    }
    const onFs = () => {
      if (!document.fullscreenElement) setIsFullScreen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [isFullScreen])

  const transformStyle: CSSProperties = {
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
    transformOrigin: 'center center',
    transition: dragging || !animate ? 'none' : 'transform 0.28s cubic-bezier(.2,.7,.2,1)',
    willChange: 'transform',
  }

  return {
    frameRef,
    stageRef,
    stageProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onClickCapture,
      onKeyDown,
      tabIndex: 0,
      style: { touchAction: 'none' } as CSSProperties,
    },
    transformStyle,
    zoom: view.zoom,
    dragging,
    isFullScreen,
    toggleFullScreen,
    zoomIn: () => zoomBy(1.2),
    zoomOut: () => zoomBy(1 / 1.2),
    reset,
    centerOn,
  }
}
