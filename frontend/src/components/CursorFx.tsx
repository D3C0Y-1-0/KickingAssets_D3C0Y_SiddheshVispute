import { useEffect, useRef } from 'react'

/**
 * Custom two-ring cursor follower, ported from a plain-CSS reference
 * (a `.cursor` div with a pulsing `::after` ring, animated via
 * `transition-duration` on direct style writes and a `.expand` class on
 * click). Adapted here, not copied: the source set `top`/`left` in pixels
 * on every mousemove and relied on the browser's native cursor still being
 * visible underneath; this version uses a translate transform (cheaper to
 * animate) and hides the native cursor only while this one is live, and
 * restyles the two rings as glass (translucent + backdrop-blur) in the
 * app's lime accent instead of the source's white/gray/red. Disabled
 * automatically on touch devices and under reduced motion, since both the
 * source's pulse keyframes and the pointer-follow have no non-motion
 * fallback that would make sense.
 */
export function CursorFx() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const noHover = window.matchMedia('(hover: none)').matches
    if (reduceMotion || noHover) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    document.body.classList.add('cursorfx-active')

    let ringX = window.innerWidth / 2
    let ringY = window.innerHeight / 2

    const onMove = (e: MouseEvent) => {
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
      ringX = e.clientX
      ringY = e.clientY
    }
    // The ring trails the dot on a slower CSS transition (ported from the
    // source's `transition-duration: 200ms` on the cursor element itself).
    const onMoveRing = () => {
      ring.style.transform = `translate(${ringX}px, ${ringY}px)`
    }
    const onDown = () => {
      dot.classList.add('cursorfx-expand')
      ring.classList.add('cursorfx-expand')
    }
    const onUp = () => {
      dot.classList.remove('cursorfx-expand')
      ring.classList.remove('cursorfx-expand')
    }
    const onLeave = () => {
      dot.style.opacity = '0'
      ring.style.opacity = '0'
    }
    const onEnter = () => {
      dot.style.opacity = '1'
      ring.style.opacity = '1'
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousemove', onMoveRing)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)
    return () => {
      document.body.classList.remove('cursorfx-active')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousemove', onMoveRing)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursorfx-dot" aria-hidden />
      <div ref={ringRef} className="cursorfx-ring" aria-hidden />
    </>
  )
}
