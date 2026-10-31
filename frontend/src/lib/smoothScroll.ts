/**
 * Eased ("delayed") wheel scrolling for the page.
 *
 * The wheel sets a target; the page glides to it with an exponential ease. It steps aside for
 * anything that should scroll or zoom natively: nested scroll areas that can still move, open
 * dialogs, zoomable diagrams (they cancel the wheel themselves), ctrl+wheel browser zoom,
 * horizontal gestures, touch, and users who prefer reduced motion. Keyboard, scrollbar drags and
 * anchor jumps stay native and the target re-syncs to them.
 */

/** Smaller = longer glide. Time constant of the ease, in milliseconds. */
const EASE_MS = 110
/** How far one wheel notch travels relative to the browser default. */
const SPEED = 1

const canScrollInside = (start: Element | null, dy: number): boolean => {
  for (
    let el = start;
    el && el !== document.body && el !== document.documentElement;
    el = el.parentElement
  ) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
      if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true
      if (dy < 0 && el.scrollTop > 0) return true
    }
  }
  return false
}

export function initSmoothScroll(): () => void {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (motion.matches) return () => {}

  const root = document.documentElement
  const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight)
  let current = window.scrollY
  let target = current
  let frame = 0
  let last = 0

  const step = (now: number) => {
    const dt = Math.min(64, now - last)
    last = now
    const diff = target - current
    if (Math.abs(diff) < 0.4) {
      current = target
      window.scrollTo({ top: current, behavior: 'instant' })
      frame = 0
      return
    }
    current += diff * (1 - Math.exp(-dt / EASE_MS))
    window.scrollTo({ top: current, behavior: 'instant' })
    frame = requestAnimationFrame(step)
  }

  const onWheel = (e: WheelEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    const el = e.target instanceof Element ? e.target : null
    if (el?.closest('dialog[open], [data-native-scroll]')) return
    if (canScrollInside(el, e.deltaY)) return

    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
    const next = Math.min(maxScroll(), Math.max(0, target + e.deltaY * unit * SPEED))
    if (next === target && (target === 0 || target === maxScroll())) return
    e.preventDefault()
    target = next
    if (!frame) {
      last = performance.now()
      frame = requestAnimationFrame(step)
    }
  }

  // Keyboard, scrollbar drag, anchors and find-in-page move the page natively: follow them.
  const onScroll = () => {
    if (!frame || Math.abs(window.scrollY - current) > 3) {
      current = target = window.scrollY
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }
  }
  const onResize = () => {
    target = Math.min(target, maxScroll())
  }

  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  return () => {
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
    if (frame) cancelAnimationFrame(frame)
  }
}
