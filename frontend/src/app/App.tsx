import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BookOpen,
  BrainCircuit,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  Grid2X2,
  ListChecks,
  Menu,
  Network,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  Search,
  Shield,
  Waypoints,
  X,
} from 'lucide-react'
import { Navigate, NavLink, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom'
import { useMotionValue } from 'motion/react'
import { api } from '../api/client'
import { useScenario, useLatestRun } from '../hooks/queries'
import { CursorFx } from '../components/CursorFx'
import { HalftoneBackground } from '../components/HalftoneBackground'
import { DockNavIcon } from '../components/DockNavIcon'
import { QueryState } from '../components/ui'
import Overview from '../features/overview/Overview'
import brandMark from '../assets/brand/gridinal-mark.png'
import brandWord from '../assets/brand/gridinal-wordmark.png'

const Infrastructure = lazy(() => import('../features/infrastructure/Infrastructure'))
const DigitalTwins = lazy(() => import('../features/digital-twins/DigitalTwins'))
const Intelligence = lazy(() => import('../features/intelligence/Intelligence'))
const WhatIf = lazy(() => import('../features/whatif/WhatIf'))
const Remediation = lazy(() => import('../features/remediation/Remediation'))
const Methodology = lazy(() => import('../features/methodology/Methodology'))
const MlLab = lazy(() => import('../features/ml/MlLab'))
const Resilience = lazy(() => import('../features/resilience/Resilience'))
const Defense = lazy(() => import('../features/defense/Defense'))
const LiveSimulation = lazy(() => import('../features/live/LiveSimulation'))
const AttackPaths = lazy(() => import('../features/attack-paths/AttackPaths'))
const Planner = lazy(() => import('../features/planner/Planner'))
type NavEntry = { path: string; name: string; icon: typeof Grid2X2 }
const navGroups: { label: string; items: NavEntry[] }[] = [
  {
    label: 'Monitor',
    items: [
      { path: '/', name: 'Overview', icon: Grid2X2 },
      { path: '/live', name: 'Live Simulation', icon: PlayCircle },
      { path: '/infrastructure', name: 'Infrastructure Map', icon: Network },
      { path: '/digital-twins', name: 'Digital Twins', icon: Building2 },
    ],
  },
  {
    label: 'Assess',
    items: [
      { path: '/intelligence', name: 'Risk Ranking', icon: Activity },
      { path: '/ml', name: 'AI Model', icon: BrainCircuit },
      { path: '/resilience', name: 'Weak Points', icon: Waypoints },
    ],
  },
  {
    label: 'Act',
    items: [
      { path: '/attack-paths', name: 'Attack Paths', icon: Network },
      { path: '/defend', name: 'Attack & Defend', icon: ShieldAlert },
      { path: '/resilience-planner', name: 'Resilience Planner', icon: ShieldCheck },
      { path: '/what-if', name: 'What-If', icon: FlaskConical },
      { path: '/remediation', name: 'Fix Plan', icon: ListChecks },
    ],
  },
]
const navigation = navGroups.flatMap((g) => g.items)
const NAV_KEY = 'gridinal.nav.collapsed'

export default function App({ onLogoClick }: { onLogoClick?: () => void } = {}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(NAV_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(NAV_KEY, c ? '0' : '1')
      } catch {
        /* storage unavailable: the choice just will not persist */
      }
      return !c
    })
  const [search, setSearch] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const navMouseY = useMotionValue(Infinity)
  const location = useLocation()
  const navigate = useNavigate()
  const scenarioQuery = useScenario()
  const latest = useLatestRun()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api.health(signal),
    refetchInterval: 30000,
    retry: 1,
  })
  const activeName =
    navigation.find((x) => x.path === location.pathname)?.name ??
    (location.pathname === '/methodology' ? 'Evidence' : 'Page not found')
  useEffect(() => {
    setMenuOpen(false)
    document.title = `${activeName} | Gridinal`
    window.scrollTo(0, 0)
  }, [location.pathname, activeName])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault()
        searchInput.current?.focus()
      }
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  return (
    <div className={`app-shell${collapsed ? ' nav-collapsed' : ''}`}>
      <CursorFx />
      <HalftoneBackground className="app-bg" opacity={0.1} />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {menuOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${menuOpen ? 'open' : ''}`}
        aria-label="Main navigation"
      >
        <Link
          to="/"
          className="brand"
          aria-label="Gridinal, home"
          onClick={
            onLogoClick
              ? (e) => {
                  e.preventDefault()
                  onLogoClick()
                }
              : undefined
          }
        >
          <img className="brand-mark" src={brandMark} alt="" width={40} height={40} />
          <img className="brand-word" src={brandWord} alt="Gridinal" width={110} height={26} />
        </Link>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        >
          <X size={20} />
        </button>
        <nav
          aria-label="Primary"
          onMouseMove={(e) => navMouseY.set(e.pageY)}
          onMouseLeave={() => navMouseY.set(Infinity)}
        >
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(({ path, name, icon: Icon }) => (
                <NavLink
                  key={path}
                  end={path === '/'}
                  to={path}
                  title={collapsed ? name : undefined}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <DockNavIcon mouseY={navMouseY}>
                    <Icon size={18} />
                  </DockNavIcon>
                  <span className="nav-text">{name}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink
            className={({ isActive }) => `nav-item subtle ${isActive ? 'active' : ''}`}
            to="/methodology"
            title={collapsed ? 'Evidence' : undefined}
          >
            <span className="nav-icon">
              <BookOpen size={17} />
            </span>
            <span className="nav-text">Evidence</span>
          </NavLink>
          <div className="sidebar-status">
            <span className="status-dot" aria-hidden />
            <span className="nav-text">Local demo · Aurora City</span>
          </div>
        </div>
      </aside>
      <button
        className="nav-edge-toggle"
        onClick={toggleCollapsed}
        aria-pressed={collapsed}
        aria-controls="workspace-navigation"
        aria-label={collapsed ? 'Expand navigation' : 'Minimize navigation'}
        title={collapsed ? 'Expand navigation' : 'Minimize navigation'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="city-indicator" />
            <span>{scenarioQuery.scenario?.name ?? 'Aurora City'}</span>
            <ChevronDown size={13} className="muted" />
            <span className="topbar-separator" />
            <span className="snapshot-label mono">
              {scenarioQuery.scenario?.current_snapshot_id ?? 'Connecting…'}
            </span>
          </div>
          <div className="topbar-tools">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault()
                navigate(`/intelligence?asset=${encodeURIComponent(search.trim().toUpperCase())}`)
                searchInput.current?.blur()
              }}
            >
              <Search size={15} />
              <input
                ref={searchInput}
                aria-label="Global asset search"
                placeholder="Search assets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>/</kbd>
            </form>
            <span className={`api-status ${health.isSuccess ? 'connected' : 'disconnected'}`}>
              <span className="status-dot" />
              {health.isPending ? 'Connecting' : health.isSuccess ? 'API connected' : 'API offline'}
            </span>
            <Link to="/methodology" className="icon-button" aria-label="Methodology and help">
              <CircleHelp size={18} />
            </Link>
          </div>
        </header>
        <div className="scroll-fade-bottom" aria-hidden />
        {latest.isError && (
          <div className="callout warn" role="alert">
            Simulation results are unavailable: {latest.error.message}. Cached risk values are
            hidden.
            <button className="button secondary" onClick={() => void latest.refetch()}>
              Retry simulation results
            </button>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          <Suspense fallback={<QueryState pending error={null} />}>
            {location.pathname === '/digital-twins' ? (
              <Routes>
                <Route path="/digital-twins" element={<DigitalTwins />} />
              </Routes>
            ) : scenarioQuery.isPending || scenarioQuery.isError ? (
              <QueryState
                pending={scenarioQuery.isPending}
                error={scenarioQuery.error}
                retry={scenarioQuery.refetch}
              />
            ) : !scenarioQuery.scenario ? (
              <QueryState pending={false} error={null} empty />
            ) : (
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/infrastructure" element={<Infrastructure />} />
                <Route path="/digital-twins" element={<DigitalTwins />} />
                <Route path="/assets" element={<Navigate to="/intelligence" replace />} />
                <Route path="/intelligence" element={<Intelligence />} />
                <Route path="/attack-paths" element={<AttackPaths />} />
                <Route path="/resilience-planner" element={<Planner />} />
                <Route
                  path="/curated-intelligence"
                  element={<Navigate to="/intelligence" replace />}
                />
                <Route path="/ml" element={<MlLab />} />
                <Route path="/what-if" element={<WhatIf />} />
                <Route path="/remediation" element={<Remediation />} />
                <Route path="/posture" element={<Navigate to="/" replace />} />
                <Route path="/resilience" element={<Resilience />} />
                <Route path="/coverage" element={<Navigate to="/methodology" replace />} />
                <Route path="/live" element={<LiveSimulation />} />
                <Route path="/defend" element={<Defense />} />
                <Route path="/methodology" element={<Methodology />} />
                <Route
                  path="*"
                  element={
                    <div className="query-state">
                      <h1>Page not found</h1>
                      <p>This workspace page does not exist.</p>
                      <Link className="button primary" to="/">
                        Return to command overview
                      </Link>
                    </div>
                  }
                />
              </Routes>
            )}
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>
            <Shield size={12} /> GRIDINAL <span className="muted">/</span> See the blast radius
            before the incident.
          </span>
          <span>
            PS03 · D3COY <span className="muted">/</span> Prototype v0.2
          </span>
        </footer>
      </div>
    </div>
  )
}
