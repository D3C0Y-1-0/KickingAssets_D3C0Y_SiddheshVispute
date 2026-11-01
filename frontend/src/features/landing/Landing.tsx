import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ArrowRight, ChevronDown, Filter, Network, Workflow } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { CascadeDiagram, SignalDiagram, TwoGraphsDiagram } from './LandingDiagrams'
import { sceneProgress, useScrollProgress } from './useScrollProgress'
import './landing.css'

type SectorScene = {
  id: string
  icon: typeof Network
  Diagram: () => React.JSX.Element
  eyebrow: string
  title: string
  body: string
  /** Scattered resting position for this diagram, in vw/vh. */
  home: { x: number; y: number; rotate: number }
}

const SECTOR_SCENES: SectorScene[] = [
  {
    id: 'graphs',
    icon: Network,
    Diagram: TwoGraphsDiagram,
    eyebrow: '01 / TWO MAPS',
    title: 'Two maps. One city.',
    body: 'Every asset sits on two separate graphs: the paths an attacker could plausibly take, and the services that depend on each other. Gridinal keeps them apart, then reads them together.',
    home: { x: -30, y: -22, rotate: -6 },
  },
  {
    id: 'funnel',
    icon: Filter,
    Diagram: SignalDiagram,
    eyebrow: '02 / SIGNAL',
    title: '22,000 flaws. Only a few matter.',
    body: 'Real CVE, CISA KEV and EPSS data are matched to each asset’s actual software, then an ML model ranks what is most likely to be exploited. Scored from evidence, never guessed.',
    home: { x: 32, y: -16, rotate: 5 },
  },
  {
    id: 'cascade',
    icon: Workflow,
    Diagram: CascadeDiagram,
    eyebrow: '03 / CASCADE',
    title: 'One failure rarely stays one.',
    body: 'See how a compromised substation can starve a pump station and a hospital, with redundancy, backups and delays applied, and no breach assumed just because two things are connected.',
    home: { x: 0, y: 26, rotate: -3 },
  },
]

// Scroll distance budget, as a fraction of the intro's total scrollable
// height, given to each scene before the next one takes over.
const SCENE_COUNT = SECTOR_SCENES.length + 2
const sceneBounds: [number, number][] = Array.from({ length: SCENE_COUNT }, (_, i) => [
  i / SCENE_COUNT,
  (i + 1) / SCENE_COUNT,
])

// Progress positions (0..1) where each slide is fully "settled": the title,
// the peak of each diagram's focus window, and the closing call to action.
const STOPS = [
  0,
  ...SECTOR_SCENES.map((_, i) => (sceneBounds[i + 1][0] + sceneBounds[i + 1][1]) / 2),
  1,
]
const SLIDE_NAMES = ['Intro', ...SECTOR_SCENES.map((s) => s.title), 'Enter the dashboard']
const SLIDE_MS = 950

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export default function Landing({ onEnter }: { onEnter: () => void }) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>()
  const reduceMotion = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const slide = useRef({ index: 0, busy: false, frame: 0 })

  const stopY = useCallback(
    (i: number) => {
      const el = ref.current
      if (!el) return 0
      return STOPS[i] * Math.max(0, el.offsetHeight - window.innerHeight)
    },
    [ref],
  )

  // Glide to slide `to` with an eased scroll. The depth-field animation is
  // driven by scroll position, so animating scrollY plays it exactly as a
  // manual scroll would, just paged.
  const goTo = useCallback(
    (to: number) => {
      const st = slide.current
      const next = Math.min(STOPS.length - 1, Math.max(0, to))
      if (st.busy || next === st.index) return
      st.busy = true
      st.index = next
      const from = window.scrollY
      const target = stopY(next)
      const t0 = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / SLIDE_MS)
        window.scrollTo({ top: from + (target - from) * easeInOut(t), behavior: 'instant' })
        if (t < 1) {
          st.frame = requestAnimationFrame(step)
        } else {
          // Hold the lock briefly so trackpad inertia can't skip a slide.
          setTimeout(() => (st.busy = false), 220)
        }
      }
      st.frame = requestAnimationFrame(step)
    },
    [stopY],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root || reduceMotion) return
    const html = document.documentElement
    html.classList.add('landing-active')
    window.scrollTo(0, 0)
    const st = slide.current

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      if (Math.abs(e.deltaY) < 6) return
      goTo(st.index + (e.deltaY > 0 ? 1 : -1))
    }
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const forward = ['ArrowDown', 'PageDown', ' ', 'ArrowRight']
      const back = ['ArrowUp', 'PageUp', 'ArrowLeft']
      if (forward.includes(e.key)) {
        e.preventDefault()
        goTo(st.index + 1)
      } else if (back.includes(e.key)) {
        e.preventDefault()
        goTo(st.index - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goTo(STOPS.length - 1)
      }
    }
    let touchY = 0
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => e.preventDefault()
    const onTouchEnd = (e: TouchEvent) => {
      const dy = touchY - e.changedTouches[0].clientY
      if (Math.abs(dy) > 40) goTo(st.index + (dy > 0 ? 1 : -1))
    }
    const onResize = () => window.scrollTo({ top: stopY(st.index), behavior: 'instant' })

    root.addEventListener('wheel', onWheel, { passive: false })
    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    root.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      html.classList.remove('landing-active')
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(st.frame)
    }
  }, [goTo, stopY, reduceMotion])

  // The dot that is nearest the live scroll position stays highlighted
  // while a glide is in flight.
  const activeSlide = STOPS.reduce(
    (best, stop, i) => (Math.abs(progress - stop) < Math.abs(progress - STOPS[best]) ? i : best),
    0,
  )

  const titleP = useMemo(() => sceneProgress(progress, ...sceneBounds[0]), [progress])
  const sectorP = SECTOR_SCENES.map((_, i) => sceneProgress(progress, ...sceneBounds[i + 1]))
  const ctaP = useMemo(() => sceneProgress(progress, ...sceneBounds[SCENE_COUNT - 1]), [progress])

  // Each scene nudges the camera with a small swing during the glide only:
  // it is level at the start, middle (the resting slide) and end of every
  // window, so slides never rest rotated (rotation resamples text and blurs).
  const fieldTilt = sectorP.reduce(
    (sum, p) => sum + Math.sin(Math.min(1, p) * Math.PI * 2) * -1.2,
    0,
  )

  // Reduced motion: skip the scroll-driven depth-field camera entirely (it
  // is all scroll-linked inline transforms, which a CSS media query can't
  // reach) and show one static screen with everything already visible.
  if (reduceMotion) {
    return (
      <div className="landing-root landing-static">
        <div className="landing-field-bg" aria-hidden />
        <div className="landing-static-content">
          <h1 className="landing-display">
            Every city runs on
            <br />
            <em>hidden</em> dependencies.
          </h1>
          <p className="landing-sub">
            Gridinal maps how power, water and healthcare lean on each other, and shows where one
            weak link could take the rest down.
          </p>
          <div className="landing-static-sectors">
            {SECTOR_SCENES.map((scene) => {
              const Icon = scene.icon
              return (
                <div key={scene.id} className="landing-static-sector">
                  <scene.Diagram />
                  <span className="landing-sector-eyebrow">
                    <Icon size={14} />
                    {scene.eyebrow}
                  </span>
                  <h2 className="landing-sector-title">{scene.title}</h2>
                  <p className="landing-sector-body">{scene.body}</p>
                </div>
              )
            })}
          </div>
          <button className="landing-cta-button" onClick={onEnter}>
            Enter the dashboard
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-root" ref={rootRef}>
      <button className="landing-skip" onClick={onEnter}>
        Skip intro
      </button>
      <nav className="landing-dots" aria-label="Intro slides">
        {SLIDE_NAMES.map((name, i) => (
          <button
            key={name}
            className="landing-dot"
            aria-label={`Go to slide ${i + 1}: ${name}`}
            aria-current={i === activeSlide ? 'true' : undefined}
            onClick={() => goTo(i)}
          />
        ))}
      </nav>
      <div className="landing-scroll" ref={ref} style={{ height: `${SCENE_COUNT * 100}vh` }}>
        <div
          className="landing-stage"
          style={{ transform: Math.abs(fieldTilt) > 0.02 ? `rotate(${fieldTilt}deg)` : 'none' }}
        >
          <div className="landing-field-bg" aria-hidden />
          <div className="landing-scanlines" aria-hidden />

          {/* The three sector diagrams live in one shared depth field for the
              whole intro: scattered at rest, one at a time zooms to center
              focus while the other two recede into a blurred background,
              like a camera racking focus rather than separate slides. */}
          <div className="landing-field">
            {SECTOR_SCENES.map((scene, i) => {
              const p = sectorP[i]
              const focus = Math.sin(Math.min(1, p) * Math.PI) // 0 -> 1 -> 0 across the scene
              const settled = p >= 1 ? 1 : 0
              const x = scene.home.x * (1 - focus) + settled * scene.home.x * 0.4
              const y = scene.home.y * (1 - focus) + settled * scene.home.y * 0.4
              const scale = 0.52 + focus * 0.78 + settled * -0.1
              const blur = (1 - focus) * 9
              const opacity = 0.3 + focus * 0.7
              const rotate = scene.home.rotate * (1 - focus)
              return (
                <div
                  key={scene.id}
                  className="landing-field-item"
                  style={{
                    transform: `translate(${x}vw, ${y}vh) scale(${scale}) rotate(${rotate}deg)`,
                    filter: blur > 0.15 ? `blur(${blur}px)` : 'none',
                    opacity,
                    zIndex: Math.round(focus * 10),
                  }}
                >
                  <scene.Diagram />
                </div>
              )
            })}
          </div>

          {/* Scene 0: title, floats above the field */}
          <section
            className="landing-scene landing-title-scene"
            style={{
              opacity: 1 - Math.max(0, titleP - 0.6) / 0.4,
              transform: `translateY(${titleP * -40}px)`,
              pointerEvents: titleP > 0.95 ? 'none' : 'auto',
            }}
          >
            <h1 className="landing-display">
              Every city runs on
              <br />
              <em>hidden</em> dependencies.
            </h1>
            <p className="landing-sub">
              Gridinal maps how power, water and healthcare lean on each other, and shows where one
              weak link could take the rest down.
            </p>
            <div className="landing-scroll-cue" style={{ opacity: 1 - titleP * 3 }}>
              <ChevronDown size={18} />
              <span>Scroll to explore</span>
            </div>
          </section>

          {/* Sector copy overlays, keyed to the same focus curve as the art */}
          {SECTOR_SCENES.map((scene, i) => {
            const p = sectorP[i]
            const Icon = scene.icon
            const focus = Math.sin(Math.min(1, p) * Math.PI)
            const readable = Math.max(0, (focus - 0.45) / 0.55)
            return (
              <section
                key={scene.id}
                className={`landing-scene landing-sector-copy-scene landing-sector-copy-${i % 2 === 0 ? 'left' : 'right'}`}
                style={{
                  opacity: p <= 0 || p >= 1 ? 0 : readable,
                  transform: `translateY(${(1 - readable) * 18}px)`,
                  pointerEvents: readable > 0.6 ? 'auto' : 'none',
                }}
              >
                <span className="landing-sector-eyebrow">
                  <Icon size={14} />
                  {scene.eyebrow}
                </span>
                <h2 className="landing-sector-title">{scene.title}</h2>
                <p className="landing-sector-body">{scene.body}</p>
              </section>
            )
          })}

          {/* Scene 4: CTA, floats above the settled field */}
          <section
            className="landing-scene landing-cta-scene"
            style={{
              opacity: Math.min(1, ctaP / 0.5),
              pointerEvents: ctaP > 0.1 ? 'auto' : 'none',
            }}
          >
            <span className="landing-kicker">READY WHEN YOU ARE</span>
            <h2 className="landing-display landing-display-sm">
              Now see Aurora City’s
              <br />
              <em>weak links.</em>
            </h2>
            <p className="landing-sub">
              30 scenario assets, three essential sectors and 22,000+ real candidate CVE pairs,
              scored, ranked and explained in one dashboard.
            </p>
            <button className="landing-cta-button" onClick={onEnter}>
              Enter the dashboard
              <ArrowRight size={18} />
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
