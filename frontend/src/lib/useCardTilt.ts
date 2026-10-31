import { useRef } from 'react'
import type { MouseEvent } from 'react'

/**
 * Pointer-tracking handlers for the shared card-fx hover treatment: a
 * cursor-following glow border (ported from a card-16-style spotlight
 * design) plus a subtle 3D tilt (ported from a card-15-style parallax
 * design). Both read the same --card-x/--card-y/--card-rx/--card-ry custom
 * properties set here; see .card-fx in styles/index.css for the visuals.
 */
export function useCardTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  const onMouseMove = (e: MouseEvent<T>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    el.style.setProperty('--card-x', `${px * 100}%`)
    el.style.setProperty('--card-y', `${py * 100}%`)
    // Bigger cards tilt less: the same rotation angle swings a large card's
    // far edge through a lot more screen distance than a small one, so the
    // max angle is scaled down as the card's diagonal grows (reference:
    // 6deg at a ~280px-diagonal metric card, down to ~2deg past 900px).
    const diagonal = Math.hypot(rect.width, rect.height)
    const maxTilt = Math.max(1.5, 6 - (diagonal - 280) / 160)
    el.style.setProperty('--card-ry', `${(px - 0.5) * maxTilt}deg`)
    el.style.setProperty('--card-rx', `${(0.5 - py) * maxTilt}deg`)
  }

  const onMouseLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--card-rx', '0deg')
    el.style.setProperty('--card-ry', '0deg')
  }

  return { ref, onMouseMove, onMouseLeave }
}
