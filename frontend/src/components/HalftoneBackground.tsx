import { useEffect, useRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../lib/utils'

interface HalftoneBackgroundProps extends ComponentPropsWithoutRef<'div'> {
  /** Dot color as "r, g, b". */
  color?: string
  /** Distance between dot centers, in CSS pixels. */
  spacing?: number
  /** Largest dot radius as a fraction of half the spacing (1 = dots touch). */
  maxDot?: number
  /** Alpha of the dots, 0..1. */
  opacity?: number
  /** Drift speed multiplier for the light/shade field. */
  speed?: number
}

/**
 * Newsprint-style halftone: a grid of print dots whose size follows a slowly
 * drifting field of light and shade (dense where the field is "dark", tiny
 * where it is "light"). Drawn on one canvas as a single batched path.
 * Pauses when the tab is hidden or the layer is off screen, and draws one
 * static frame under prefers-reduced-motion.
 */
export function HalftoneBackground({
  color = '204, 255, 0',
  spacing = 12,
  maxDot = 0.78,
  opacity = 0.7,
  speed = 1,
  className,
  ...props
}: HalftoneBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let dpr = 1
    let frame = 0
    let inView = true
    let lastDraw = 0

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      width = container.clientWidth
      height = container.clientHeight
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    // Overlapping slow waves give a soft, never-repeating-looking field in 0..1.
    const field = (x: number, y: number, t: number) => {
      const v =
        0.5 +
        0.26 * Math.sin(x * 0.0105 + t * 0.00042) +
        0.24 * Math.sin(y * 0.0125 - t * 0.00031 + x * 0.0042) +
        0.16 * Math.sin((x + y) * 0.0068 + t * 0.00052)
      return Math.min(1, Math.max(0, v))
    }

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = `rgba(${color}, ${opacity})`
      ctx.beginPath()
      const half = spacing / 2
      for (let y = half; y < height + half; y += spacing) {
        for (let x = half; x < width + half; x += spacing) {
          const r = half * maxDot * Math.pow(field(x, y, t), 1.6)
          if (r < 0.35) continue
          ctx.moveTo(x + r, y)
          ctx.arc(x, y, r, 0, Math.PI * 2)
        }
      }
      ctx.fill()
    }

    const tick = (now: number) => {
      frame = 0
      if (!inView || document.hidden) return
      // ~30fps is plenty for a slow drift and halves the canvas cost.
      if (now - lastDraw >= 33) {
        lastDraw = now
        draw(now * speed)
      }
      frame = requestAnimationFrame(tick)
    }
    const start = () => {
      if (reduceMotion) {
        draw(0)
      } else if (!frame) {
        frame = requestAnimationFrame(tick)
      }
    }

    resize()
    start()
    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (reduceMotion) draw(0)
    })
    resizeObserver.observe(container)
    const viewObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      if (inView) start()
    })
    viewObserver.observe(container)
    const onVisibility = () => {
      if (!document.hidden) start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      viewObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [color, spacing, maxDot, opacity, speed])

  return (
    <div ref={containerRef} className={cn('h-full w-full', className)} aria-hidden {...props}>
      <canvas ref={canvasRef} className="pointer-events-none" />
    </div>
  )
}
