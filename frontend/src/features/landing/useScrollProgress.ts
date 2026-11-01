import { useEffect, useRef, useState } from 'react'

/**
 * Tracks how far a tall container has been scrolled through, as 0..1, using
 * native window scroll position (not a scroll-jacking library) so it plays
 * nicely with the app's existing eased-wheel smooth scroll
 * (lib/smoothScroll.ts), which already owns wheel handling globally.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      if (total <= 0) {
        setProgress(1)
        return
      }
      const scrolled = -rect.top
      setProgress(Math.min(1, Math.max(0, scrolled / total)))
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return { ref, progress }
}

/** Remaps a 0..1 progress value into a 0..1 value local to [start, end]. */
export function sceneProgress(progress: number, start: number, end: number) {
  if (end <= start) return progress >= end ? 1 : 0
  return Math.min(1, Math.max(0, (progress - start) / (end - start)))
}
