import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useAssets, useLatestRun } from '../hooks/queries'
import { chooseMode, useCapability } from './capability'
import { sceneAt, scrollTopFor, SCENES, type SceneId } from './scenes'
import { SUBSTATION_ASSETS } from './substation'
import StaticScene from './StaticScene'
import { AssetList, AssetPanel, Legend, TopBar, type AssetFacts } from './ui'
import './gridinal.css'

const CinematicCanvas = lazy(() => import('./CinematicCanvas'))

/** Real facts for the substation assets, from the API when available. Never invented. */
function useSubstationFacts(): Record<string, AssetFacts> {
  const run = useLatestRun().data
  useAssets() // warms the shared cache for the pages this scene links to
  return useMemo(() => {
    const out: Record<string, AssetFacts> = {}
    for (const a of run?.assets ?? []) {
      if (SUBSTATION_ASSETS.some((s) => s.id === a.asset_id)) {
        out[a.asset_id] = {
          product: a.product.label,
          risk: { score: a.risk.score ?? null, category: a.risk.category ?? null },
        }
      }
    }
    return out
  }, [run])
}

export default function GridinalExperience() {
  const capability = useCapability()
  const [params] = useSearchParams()
  const [contextLost, setContextLost] = useState(false)
  const [driverFailed, setDriverFailed] = useState(false)
  const mode = contextLost || driverFailed ? 'static' : chooseMode(capability, params.get('mode'))
  const facts = useSubstationFacts()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scene, setScene] = useState<SceneId>('awakens')
  const [active, setActive] = useState(true)

  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLElement>(null)
  const progress = useRef(0)

  useEffect(() => {
    document.title = 'Inside the Grid | GRIDINAL'
  }, [])

  const goTo = useCallback(
    (p: number) => {
      const el = track.current
      const behavior = capability.reducedMotion ? 'auto' : 'smooth'
      if (mode === 'cinematic' && el) {
        const top = el.getBoundingClientRect().top + window.scrollY
        window.scrollTo({
          top: scrollTopFor(top, el.offsetHeight, window.innerHeight, p),
          behavior,
        })
      } else {
        document
          .getElementById(p > 0.3 ? 'gx-infrastructure' : 'gx-top')
          ?.scrollIntoView({ behavior })
      }
    },
    [capability.reducedMotion, mode],
  )

  // Scroll driver: one master progress value; overlays are scrubbed from the same scroll.
  useEffect(() => {
    if (mode !== 'cinematic' || !track.current || !root.current) return
    let ctx: gsap.Context | undefined
    try {
      gsap.registerPlugin(ScrollTrigger)
      ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: track.current,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            progress.current = self.progress
            setScene(sceneAt(self.progress).id)
            if (rail.current) rail.current.style.transform = `scaleX(${self.progress})`
            root.current?.toggleAttribute('data-hero-hidden', self.progress > 0.26)
          },
        })
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: track.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.6,
          },
        })
        tl.fromTo('.gx-cue', { opacity: 1 }, { opacity: 0, duration: 0.05 }, 0)
          .fromTo(
            '.gx-hero',
            { opacity: 1, y: 0, scale: 1 },
            { opacity: 0, y: -80, scale: 1.03, duration: 0.2 },
            0.08,
          )
          .fromTo('.gx-s2-title', { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.12 }, 0.44)
          .to('.gx-s2-title', { opacity: 0.0, y: -20, duration: 0.1 }, 0.74)
          .fromTo('.gx-s2-side', { opacity: 0, x: 48 }, { opacity: 1, x: 0, duration: 0.12 }, 0.66)
          .to({}, { duration: 0 }, 1)
      }, root)
    } catch {
      setDriverFailed(true)
    }
    return () => ctx?.revert()
  }, [mode])

  // Pause rendering whenever the stage is off screen or the tab is hidden.
  useEffect(() => {
    if (mode !== 'cinematic' || !track.current) return
    const el = track.current
    let visible = true
    const apply = () => setActive(visible && document.visibilityState === 'visible')
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      apply()
    })
    io.observe(el)
    document.addEventListener('visibilitychange', apply)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', apply)
    }
  }, [mode])

  const selected = SUBSTATION_ASSETS.find((a) => a.id === selectedId) ?? null

  if (mode === 'static') {
    return (
      <div ref={root} className="gx" data-mode="static">
        <StaticScene
          selectedId={selectedId}
          onSelect={setSelectedId}
          facts={facts}
          railRef={rail}
          scene={scene}
          onGo={goTo}
          reason={
            contextLost
              ? 'The graphics context was lost, so the 3D scene was replaced by this static version.'
              : driverFailed
                ? 'Scroll animation is unavailable, so this static version is shown.'
                : null
          }
        />
      </div>
    )
  }

  return (
    <div ref={root} className="gx" data-mode="cinematic">
      <TopBar railRef={rail} scene={scene} onGo={goTo} />
      <div ref={track} className="gx-track" id="gx-top">
        <div className="gx-stage">
          <Suspense
            fallback={
              <div className="gx-loading" role="status">
                Loading the grid…
              </div>
            }
          >
            <CinematicCanvas
              progress={progress}
              active={active}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onContextLost={() => setContextLost(true)}
            />
          </Suspense>
          <div className="gx-vignette" aria-hidden />

          <section className="gx-hero" aria-labelledby="gx-h1">
            <p className="gx-eyebrow">GRIDINAL — INSIDE THE GRID</p>
            <h1 id="gx-h1">GRIDINAL</h1>
            <p className="gx-tagline">Every Asset. Every Connection. Every Risk.</p>
            <p className="gx-lede">
              Cyber-risk analysis for critical infrastructure, shown on a simulated city. Real
              vulnerability data, assumed assets, projected outcomes.
            </p>
            <div className="gx-actions">
              <button
                type="button"
                className="gx-btn primary"
                onClick={() => goTo(SCENES[1].at ?? 0.62)}
              >
                Explore the Grid <ArrowDown size={16} aria-hidden />
              </button>
              <Link className="gx-btn" to="/">
                Enter Command Center <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </section>

          <div className="gx-cue" aria-hidden>
            <span>Scroll</span>
            <i />
          </div>

          <div className="gx-s2-title" aria-live="polite">
            <p className="gx-eyebrow">SCENE 02</p>
            <h2>Enter the infrastructure</h2>
            <p>North Energy Campus, Aurora City. Simulated scenario assets.</p>
          </div>

          <aside className="gx-s2-side" aria-label="Substation assets">
            <AssetList
              assets={SUBSTATION_ASSETS}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <AssetPanel
              asset={selected}
              facts={selected ? facts[selected.id] : undefined}
              onClose={() => setSelectedId(null)}
            />
            <Legend />
          </aside>
        </div>
      </div>

      <section className="gx-outro" aria-labelledby="gx-outro-h">
        <h2 id="gx-outro-h">Continue into the operation</h2>
        <p>
          The threat, intelligence and command-center scenes are not built yet. Everything the
          platform actually does is available now in the command center.
        </p>
        <div className="gx-actions">
          <Link className="gx-btn primary" to="/">
            Enter Command Center <ArrowRight size={16} aria-hidden />
          </Link>
          <Link className="gx-btn" to="/live">
            Run the live simulation
          </Link>
          <Link className="gx-btn" to="/infrastructure">
            Open the infrastructure map
          </Link>
        </div>
      </section>
    </div>
  )
}
