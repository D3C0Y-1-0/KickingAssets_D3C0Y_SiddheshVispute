import { useRef } from 'react'
import type { ReactNode } from 'react'
import { MotionValue, motion, useSpring, useTransform } from 'motion/react'

/**
 * Per-item magnification for the sidebar nav, ported from Aceternity's
 * FloatingDock `IconContainer`. Adapted, not copied:
 *  - The source dock is a horizontal pill that magnifies icon width/height
 *    against the cursor's X position; this app's nav is a vertical list in
 *    a fixed-width sidebar, so the axis is flipped to track `mouseY` and
 *    distance is measured against each item's vertical center instead.
 *  - No `@/` alias (this project only uses relative imports) and no
 *    `"use client"` directive (plain Vite SPA, not Next.js).
 *  - The source's own tooltip-on-hover popover is dropped: this sidebar
 *    already shows an icon + visible label side by side (or a native
 *    `title` attribute when collapsed to icon-only), so a second floating
 *    label would duplicate it.
 *  - Sizes are tuned down from the source's 40/80/40px (a large standalone
 *    dock) to a narrower swing that fits the sidebar's existing 36px icon
 *    slot without reflowing the row.
 */
export function DockNavIcon({
  mouseY,
  children,
}: {
  mouseY: MotionValue<number>
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  const distance = useTransform(mouseY, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 }
    return val - bounds.y - bounds.height / 2
  })

  const sizeTransform = useTransform(distance, [-120, 0, 120], [36, 50, 36])
  const iconSizeTransform = useTransform(distance, [-120, 0, 120], [18, 25, 18])

  const size = useSpring(sizeTransform, { mass: 0.1, stiffness: 150, damping: 12 })
  const iconSize = useSpring(iconSizeTransform, { mass: 0.1, stiffness: 150, damping: 12 })

  return (
    <motion.div ref={ref} style={{ width: size, height: size }} className="nav-icon">
      <motion.div
        style={{ width: iconSize, height: iconSize }}
        className="flex items-center justify-center"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
