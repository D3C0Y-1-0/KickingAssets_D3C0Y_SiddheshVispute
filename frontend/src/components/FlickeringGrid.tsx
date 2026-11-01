import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../lib/utils'

interface FlickeringGridProps extends ComponentPropsWithoutRef<'div'> {
  squareSize?: number
  gridGap?: number
  flickerChance?: number
  color?: string
  width?: number
  height?: number
  maxOpacity?: number
}

/**
 * Canvas grid of small squares that randomly flicker (shadcn/Magic UI
 * "FlickeringGrid", React version). Adapted: relative imports instead of the
 * `@/` alias, the animation pauses when the tab is hidden or the grid is off
 * screen, and under prefers-reduced-motion it draws one static frame instead
 * of flickering.
 */
export function FlickeringGrid({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color = 'rgb(0, 0, 0)',
  width,
  height,
  className,
  maxOpacity = 0.3,
  ...props
}: FlickeringGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const rgb = useMemo(() => {
    if (typeof window === 'undefined') return '0, 0, 0'
    const probe = document.createElement('canvas')
    probe.width = probe.height = 1
    const ctx = probe.getContext('2d')
    if (!ctx) return '0, 0, 0'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data)
    return `${r}, ${g}, ${b}`
  }, [color])

  const setup = useCallback(
    (canvas: HTMLCanvasElement, w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const cols = Math.ceil(w / (squareSize + gridGap))
      const rows = Math.ceil(h / (squareSize + gridGap))
      const squares = new Float32Array(cols * rows)
      for (let i = 0; i < squares.length; i++) squares[i] = Math.random() * maxOpacity
      return { cols, rows, squares, dpr }
    },
    [squareSize, gridGap, maxOpacity],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let last = 0
    let grid = setup(canvas, canvasSize.width, canvasSize.height)

    const draw = () => {
      const { cols, rows, squares, dpr } = grid
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillStyle = `rgba(${rgb}, ${squares[i * rows + j]})`
          ctx.fillRect(
            i * (squareSize + gridGap) * dpr,
            j * (squareSize + gridGap) * dpr,
            squareSize * dpr,
            squareSize * dpr,
          )
        }
      }
    }

    const tick = (time: number) => {
      if (!isInView || document.hidden) {
        frame = 0
        return
      }
      const dt = Math.min(0.1, (time - last) / 1000)
      last = time
      for (let i = 0; i < grid.squares.length; i++) {
        if (Math.random() < flickerChance * dt) grid.squares[i] = Math.random() * maxOpacity
      }
      draw()
      frame = requestAnimationFrame(tick)
    }

    const start = () => {
      if (reduceMotion) {
        draw()
        return
      }
      if (!frame) {
        last = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }
    const onVisibility = () => {
      if (!document.hidden && isInView) start()
    }

    if (canvasSize.width > 0 && isInView) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [setup, canvasSize, isInView, flickerChance, maxOpacity, rgb, squareSize, gridGap])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () =>
      setCanvasSize({
        width: width || container.clientWidth,
        height: height || container.clientHeight,
      })
    update()
    const resize = new ResizeObserver(update)
    resize.observe(container)
    const visibility = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), {
      threshold: 0,
    })
    visibility.observe(container)
    return () => {
      resize.disconnect()
      visibility.disconnect()
    }
  }, [width, height])

  return (
    <div ref={containerRef} className={cn('h-full w-full', className)} {...props}>
      <canvas ref={canvasRef} className="pointer-events-none" />
    </div>
  )
}
