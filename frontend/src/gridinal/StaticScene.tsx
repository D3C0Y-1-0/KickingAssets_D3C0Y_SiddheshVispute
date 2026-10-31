import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { SUBSTATION_ASSETS, SUBSTATION_LINKS } from './substation'
import { AssetList, AssetPanel, Legend, TopBar, type AssetFacts } from './ui'

/**
 * The same story without WebGL or scroll-scrubbing: used on small screens, with reduced motion,
 * without WebGL, or if the graphics context is lost. Nothing here animates by scroll.
 */
export default function StaticScene({
  selectedId,
  onSelect,
  facts,
  railRef,
  scene,
  onGo,
  reason,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  facts: Record<string, AssetFacts>
  railRef: RefObject<HTMLElement | null>
  scene: string
  onGo: (p: number) => void
  reason: string | null
}) {
  const selected = SUBSTATION_ASSETS.find((a) => a.id === selectedId) ?? null
  // Plan view of the substation: x and z of each marker, scaled into the SVG viewBox.
  const W = 520
  const H = 340
  const pos = (id: string) => {
    const a = SUBSTATION_ASSETS.find((x) => x.id === id)!
    return { x: W / 2 + a.anchor[0] * 32, y: H / 2 + a.anchor[2] * 34 - 20 }
  }
  return (
    <>
      <TopBar railRef={railRef} scene={scene} onGo={onGo} />
      <main className="gx-static" id="gx-top">
        <section className="gx-static-hero" aria-labelledby="gx-h1">
          <p className="gx-eyebrow">GRIDINAL — INSIDE THE GRID</p>
          <h1 id="gx-h1">GRIDINAL</h1>
          <p className="gx-tagline">Every Asset. Every Connection. Every Risk.</p>
          <p className="gx-lede">
            Cyber-risk analysis for critical infrastructure, shown on a simulated city. Real
            vulnerability data, assumed assets, projected outcomes.
          </p>
          {reason && (
            <p className="gx-note" role="status">
              {reason}
            </p>
          )}
          <div className="gx-actions">
            <a className="gx-btn primary" href="#gx-infrastructure">
              Explore the Grid
            </a>
            <Link className="gx-btn" to="/">
              Enter Command Center <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>

        <section className="gx-static-scene" id="gx-infrastructure" aria-labelledby="gx-s2">
          <p className="gx-eyebrow">SCENE 02</p>
          <h2 id="gx-s2">Enter the infrastructure</h2>
          <p className="gx-lede">North Energy Campus, Aurora City. Simulated scenario assets.</p>
          <div className="gx-static-grid">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label="Plan view of six substation assets and their connections"
              className="gx-plan"
            >
              {SUBSTATION_LINKS.map((l) => {
                const a = pos(l.from)
                const b = pos(l.to)
                return (
                  <line
                    key={`${l.from}-${l.to}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={l.kind === 'data' ? 'gx-line data' : 'gx-line op'}
                  />
                )
              })}
              {SUBSTATION_ASSETS.map((a) => {
                const p = pos(a.id)
                return (
                  <g
                    key={a.id}
                    transform={`translate(${p.x} ${p.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${a.name}, ${a.id}`}
                    aria-pressed={a.id === selectedId}
                    className={`gx-node ${a.id === selectedId ? 'on' : ''} ${a.exposure === 'external' ? 'ext' : ''}`}
                    onClick={() => onSelect(a.id === selectedId ? null : a.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(a.id === selectedId ? null : a.id)
                      }
                    }}
                  >
                    <circle r="11" />
                    <text y="26" textAnchor="middle">
                      {a.id}
                    </text>
                  </g>
                )
              })}
            </svg>
            <div className="gx-static-side">
              <AssetList assets={SUBSTATION_ASSETS} selectedId={selectedId} onSelect={onSelect} />
              <AssetPanel
                asset={selected}
                facts={selected ? facts[selected.id] : undefined}
                onClose={() => onSelect(null)}
              />
              <Legend />
            </div>
          </div>
        </section>

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
          </div>
        </section>
      </main>
    </>
  )
}
