// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { chooseMode } from '../src/gridinal/capability'
import {
  cameraAt,
  distance,
  layers,
  SCENE_2_START,
  SCENES,
  sceneAt,
  scrollTopFor,
  SUBSTATION_POS,
} from '../src/gridinal/scenes'
import { buildWorld } from '../src/gridinal/world'
import { SUBSTATION_ASSETS, SUBSTATION_LINKS } from '../src/gridinal/substation'
import StaticScene from '../src/gridinal/StaticScene'

afterEach(cleanup)

const scenario = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/scenarios/aurora-city.json'), 'utf-8'),
)

describe('camera path', () => {
  it('moves steadily toward the substation without jumps', () => {
    let previous = cameraAt(0).pos
    let remaining = distance(previous, SUBSTATION_POS)
    for (let i = 1; i <= 400; i++) {
      const pos = cameraAt(i / 400).pos
      expect(distance(previous, pos)).toBeLessThan(1.6) // no teleporting between scroll steps
      previous = pos
    }
    expect(distance(previous, SUBSTATION_POS)).toBeLessThan(remaining * 0.4)
    remaining = distance(cameraAt(0.5).pos, SUBSTATION_POS)
    expect(remaining).toBeLessThan(distance(cameraAt(0.2).pos, SUBSTATION_POS))
    expect(remaining).toBeGreaterThan(distance(cameraAt(0.9).pos, SUBSTATION_POS))
  })

  it('is continuous in velocity across the scene boundary (no stop-start at the cut)', () => {
    const step = 0.002
    const speed = (p: number) =>
      distance(cameraAt(p - step).pos, cameraAt(p + step).pos) / (2 * step)
    const before = speed(SCENE_2_START - 0.01)
    const after = speed(SCENE_2_START + 0.01)
    expect(Math.abs(before - after) / Math.max(before, after)).toBeLessThan(0.25)
  })

  it('clamps out-of-range progress', () => {
    expect(cameraAt(-3)).toEqual(cameraAt(0))
    expect(cameraAt(7)).toEqual(cameraAt(1))
  })
})

describe('scene map and scroll maths', () => {
  it('reports scene 1 then scene 2 and only advertises scenes that are built', () => {
    expect(sceneAt(0).id).toBe('awakens')
    expect(sceneAt(SCENE_2_START - 0.01).id).toBe('awakens')
    expect(sceneAt(SCENE_2_START + 0.01).id).toBe('infrastructure')
    expect(SCENES.filter((s) => s.ready).map((s) => s.number)).toEqual([1, 2])
    expect(SCENES.filter((s) => !s.ready).every((s) => s.at === null)).toBe(true)
  })

  it('maps progress to a scroll offset inside the track', () => {
    expect(scrollTopFor(100, 5000, 1000, 0)).toBe(100)
    expect(scrollTopFor(100, 5000, 1000, 1)).toBe(4100)
    expect(scrollTopFor(100, 5000, 1000, 2)).toBe(4100)
  })

  it('layers hand over smoothly and reverse exactly', () => {
    expect(layers(0).hero).toBe(1)
    expect(layers(0.4).hero).toBe(0)
    expect(layers(0).substation).toBe(0)
    expect(layers(1).markers).toBe(1)
    expect(layers(0.5)).toEqual(layers(0.5)) // pure: scrolling back gives the same frame
  })
})

describe('world', () => {
  it('is deterministic and every edge points at real nodes', () => {
    const a = buildWorld()
    const b = buildWorld()
    expect(a).toEqual(b)
    expect(a.nodes[0].kind).toBe('substation')
    for (const e of a.edges) {
      expect(a.nodes[e.a]).toBeDefined()
      expect(a.nodes[e.b]).toBeDefined()
      expect(e.a).not.toBe(e.b)
    }
    expect(a.edges.filter((e) => e.a === 0 || e.b === 0).length).toBeGreaterThanOrEqual(7)
  })
})

describe('capability', () => {
  const full = { webgl: true, reducedMotion: false, compact: false }
  it('uses the cinematic path only when it is safe', () => {
    expect(chooseMode(full)).toBe('cinematic')
    expect(chooseMode({ ...full, webgl: false })).toBe('static')
    expect(chooseMode({ ...full, reducedMotion: true })).toBe('static')
    expect(chooseMode({ ...full, compact: true })).toBe('static')
  })
  it('lets a query override force the static story but never force WebGL that is missing', () => {
    expect(chooseMode(full, 'static')).toBe('static')
    expect(chooseMode({ ...full, webgl: false }, 'cinematic')).toBe('static')
    expect(chooseMode({ ...full, compact: true }, 'cinematic')).toBe('cinematic')
  })
})

describe('substation scene data matches the scenario', () => {
  const byId = new Map<string, Record<string, string>>(
    scenario.assets.map((a: Record<string, string>) => [a.id, a]),
  )
  it('uses real scenario assets with their real type, criticality and exposure', () => {
    for (const a of SUBSTATION_ASSETS) {
      const real = byId.get(a.id)
      expect(real, a.id).toBeDefined()
      expect(real!.name).toBe(a.name)
      expect(real!.asset_type).toBe(a.kind)
      expect(real!.criticality).toBe(a.criticality)
      expect(real!.exposure).toBe(a.exposure)
    }
  })
  it('draws only relationships that exist in the cyber or operational graph', () => {
    const cyber = new Set(
      scenario.cyber_edges.map(
        (e: Record<string, string>) => `${e.source_asset_id}>${e.target_asset_id}`,
      ),
    )
    const operational = new Set(
      scenario.operational_edges.map(
        (e: Record<string, string>) => `${e.source_asset_id}>${e.target_asset_id}`,
      ),
    )
    for (const l of SUBSTATION_LINKS) {
      const key = `${l.from}>${l.to}`
      if (l.kind === 'operational') expect(operational.has(key), key).toBe(true)
      else if (key === 'PWR-001>PWR-008') {
        // Two real hops: PWR-001 -> PWR-004 -> PWR-008.
        expect(cyber.has('PWR-001>PWR-004') && cyber.has('PWR-004>PWR-008')).toBe(true)
      } else expect(cyber.has(key), key).toBe(true)
    }
  })
})

describe('static fallback', () => {
  const renderStatic = (selectedId: string | null = null, reason: string | null = null) => {
    const onSelect = () => {}
    return render(
      <MemoryRouter>
        <StaticScene
          selectedId={selectedId}
          onSelect={onSelect}
          facts={{}}
          railRef={{ current: null }}
          scene="awakens"
          onGo={() => {}}
          reason={reason}
        />
      </MemoryRouter>,
    )
  }

  it('shows the brand, the headline and a direct way into the command center', () => {
    renderStatic()
    expect(screen.getByRole('heading', { level: 1, name: 'GRIDINAL' })).toBeTruthy()
    expect(screen.getByText('Every Asset. Every Connection. Every Risk.')).toBeTruthy()
    const enter = screen.getAllByRole('link', { name: /Enter Command Center/ })
    expect(enter.length).toBeGreaterThanOrEqual(2)
    expect(enter.every((a) => a.getAttribute('href') === '/')).toBe(true)
    expect(screen.getAllByText(/Simulated scenario/).length).toBeGreaterThan(0)
  })

  it('lists every asset as a keyboard-operable button and explains missing risk honestly', async () => {
    const calls: (string | null)[] = []
    render(
      <MemoryRouter>
        <StaticScene
          selectedId="PWR-007"
          onSelect={(id) => calls.push(id)}
          facts={{}}
          railRef={{ current: null }}
          scene="awakens"
          onGo={() => {}}
          reason="The graphics context was lost."
        />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('button', { pressed: false }).length).toBeGreaterThan(5)
    expect(screen.getByRole('region', { name: /Feeder Protection Relay details/ })).toBeTruthy()
    expect(screen.getByText('Not assessed')).toBeTruthy() // no run: no invented score
    expect(screen.getByText(/Scenario definition \(simulated\)/)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/graphics context was lost/)
    const list = screen.getByRole('list', { name: 'Substation assets' })
    await userEvent.click(within(list).getByRole('button', { name: /PWR-001/ }))
    expect(calls).toEqual(['PWR-001'])
  })

  it('shows a real risk figure only when the run provides one', () => {
    render(
      <MemoryRouter>
        <StaticScene
          selectedId="PWR-001"
          onSelect={() => {}}
          facts={{
            'PWR-001': { product: 'Fortinet FortiOS', risk: { score: 97.3, category: 'critical' } },
          }}
          railRef={{ current: null }}
          scene="awakens"
          onGo={() => {}}
          reason={null}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/critical · 97\.3/)).toBeTruthy()
    expect(screen.getByText('Fortinet FortiOS')).toBeTruthy()
  })
})
