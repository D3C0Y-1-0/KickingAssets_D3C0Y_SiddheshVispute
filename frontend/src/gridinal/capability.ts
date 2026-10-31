import { useEffect, useState } from 'react'

export type Capability = { webgl: boolean; reducedMotion: boolean; compact: boolean }
export type ExperienceMode = 'cinematic' | 'static'

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const query = (q: string) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(q)
    : null

export function detectCapability(): Capability {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const memory = (nav as (Navigator & { deviceMemory?: number }) | undefined)?.deviceMemory
  const lowPower =
    (memory !== undefined && memory <= 2) ||
    (nav?.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2)
  return {
    webgl: typeof document !== 'undefined' && detectWebGL(),
    reducedMotion: !!query('(prefers-reduced-motion: reduce)')?.matches,
    compact: !!query('(max-width: 759px)')?.matches || lowPower,
  }
}

/** The cinematic path needs WebGL, motion and a capable device; everything else gets the static story. */
export function chooseMode(c: Capability, override?: string | null): ExperienceMode {
  if (override === 'static') return 'static'
  if (override === 'cinematic' && c.webgl) return 'cinematic'
  return c.webgl && !c.reducedMotion && !c.compact ? 'cinematic' : 'static'
}

/** Live capability: reacts to a motion preference or window width change. */
export function useCapability(): Capability {
  const [capability, setCapability] = useState(detectCapability)
  useEffect(() => {
    const queries = [query('(prefers-reduced-motion: reduce)'), query('(max-width: 759px)')]
    const update = () => setCapability((previous) => ({ ...previous, ...detectCapability() }))
    queries.forEach((q) => q?.addEventListener('change', update))
    return () => queries.forEach((q) => q?.removeEventListener('change', update))
  }, [])
  return capability
}
