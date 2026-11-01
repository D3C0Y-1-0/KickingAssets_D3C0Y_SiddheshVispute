import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import {
  Activity,
  BookOpen,
  BrainCircuit,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FlaskConical,
  Grid2X2,
  Layers,
  ListChecks,
  Menu,
  Network,
  PlayCircle,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Search,
  Shield,
  Waypoints,
  X,
} from 'lucide-react'
import { NavLink, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useScenario } from '../hooks/queries'
import { CursorFx } from '../components/CursorFx'
import { QueryState } from '../components/ui'
import Overview from '../features/overview/Overview'
import brandMark from '../assets/brand/gridinal-mark.png'
import brandWord from '../assets/brand/gridinal-wordmark.png'

const Infrastructure = lazy(() => import('../features/infrastructure/Infrastructure'))
const DigitalTwins = lazy(() => import('../features/digital-twins/DigitalTwins'))
const Assets = lazy(() => import('../features/assets/Assets'))
const Intelligence = lazy(() => import('../features/intelligence/Intelligence'))
const CuratedIntelligence = lazy(() => import('../features/intelligence/CuratedIntelligence'))
const WhatIf = lazy(() => import('../features/whatif/WhatIf'))
const Remediation = lazy(() => import('../features/remediation/Remediation'))
const Methodology = lazy(() => import('../features/methodology/Methodology'))
const MlLab = lazy(() => import('../features/ml/MlLab'))
const Posture = lazy(() => import('../features/posture/Posture'))
const Resilience = lazy(() => import('../features/resilience/Resilience'))
const Coverage = lazy(() => import('../features/coverage/Coverage'))
const Defense = lazy(() => import('../features/defense/Defense'))
const LiveSimulation = lazy(() => import('../features/live/LiveSimulation'))
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
      { path: '/assets', name: 'Assets & Risk', icon: Layers },
      { path: '/intelligence', name: 'Risk Ranking', icon: Activity },
      { path: '/curated-intelligence', name: 'Curated CVE Assessment', icon: ShieldCheck },
      { path: '/ml', name: 'AI Model', icon: BrainCircuit },
      { path: '/posture', name: 'Trends & Activity', icon: Radar },
      { path: '/resilience', name: 'Weak Points', icon: Waypoints },
    ],
  },
  {
    label: 'Act',
    items: [
      { path: '/defend', name: 'Attack & Defend', icon: ShieldAlert },
      { path: '/what-if', name: 'What-If', icon: FlaskConical },
      { path: '/remediation', name: 'Fix Plan', icon: ListChecks },
    ],
  },
  {
    label: 'Evidence',
    items: [
      { path: '/coverage', name: 'Challenge Coverage', icon: ClipboardCheck },
      { path: '/methodology', name: 'Methodology', icon: BookOpen },
    ],
  },
]
const navigation = navGroups.flatMap((g) => g.items)
const NAV_KEY = 'gridinal.nav.collapsed'

function NavDockItem({
  mouseY,
  path,
  name,
  icon: Icon,
  collapsed,
  subtle = false,
  onClick,
}: {
  mouseY: MotionValue<number>
  path: string
  name: string
  icon: typeof Grid2X2
  collapsed: boolean
  subtle?: boolean
  onClick?: () => void
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const [hovered, setHovered] = useState(false)

  const distance = useTransform(mouseY, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 }
    return val - bounds.y - bounds.height / 2
  })

  // Vertical spring dock magnification with smooth bell-curve falloff
  const iconBoxTransform = useTransform(distance, (val) => {
    const maxDelta = 110
    const base = collapsed ? 38 : 36
    const peak = collapsed ? 50 : 42
    if (Math.abs(val) > maxDelta) return base
    const pct = 1 - Math.abs(val) / maxDelta
    const ease = 0.5 - 0.5 * Math.cos(pct * Math.PI)
    return base + (peak - base) * ease
  })

  const iconScaleTransform = useTransform(distance, (val) => {
    const maxDelta = 110
    const base = subtle ? 16 : 18
    const peak = collapsed ? 24 : 21
    if (Math.abs(val) > maxDelta) return base
    const pct = 1 - Math.abs(val) / maxDelta
    const ease = 0.5 - 0.5 * Math.cos(pct * Math.PI)
    return base + (peak - base) * ease
  })

  const iconBoxSize = useSpring(iconBoxTransform, {
    mass: 0.1,
    stiffness: 180,
    damping: 14,
  })

  const iconSize = useSpring(iconScaleTransform, {
    mass: 0.1,
    stiffness: 180,
    damping: 14,
  })

  return (
    <NavLink
      ref={ref}
      to={path}
      end={path === '/'}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? name : undefined}
      className={({ isActive }) =>
        `nav-item nav-dock-item ${subtle ? 'subtle' : ''} ${isActive ? 'active' : ''}`
      }
    >
      <motion.span
        style={{ width: iconBoxSize, height: iconBoxSize }}
        className="nav-icon nav-dock-icon"
      >
        <motion.span
          style={{ width: iconSize, height: iconSize }}
          className="inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
        >
          <Icon size={18} />
        </motion.span>
      </motion.span>
      <span className="nav-text">{name}</span>
      {collapsed && (
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0, x: -8, y: '-50%' }}
              animate={{ opacity: 1, x: 0, y: '-50%' }}
              exit={{ opacity: 0, x: -6, y: '-50%' }}
              transition={{ duration: 0.15 }}
              className="nav-dock-tooltip"
            >
              {name}
            </motion.span>
          )}
        </AnimatePresence>
      )}
    </NavLink>
  )
}

export default function App() {
  const navMouseY = useMotionValue(Infinity)
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
  const location = useLocation()
  const navigate = useNavigate()
  const scenarioQuery = useScenario()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api.health(signal),
    refetchInterval: 30000,
    retry: 1,
  })
  const activeName =
    navigation.find((x) => x.path === location.pathname)?.name ??
    (location.pathname === '/methodology' ? 'Methodology' : 'Page not found')
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
        onMouseMove={(e) => navMouseY.set(e.pageY)}
        onMouseLeave={() => navMouseY.set(Infinity)}
      >
        <Link to="/" className="brand" aria-label="Gridinal, home">
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
        <nav aria-label="Primary">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(({ path, name, icon: Icon }) => (
                <NavDockItem
                  key={path}
                  mouseY={navMouseY}
                  path={path}
                  name={name}
                  icon={Icon}
                  collapsed={collapsed}
                  onClick={() => setMenuOpen(false)}
                />
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavDockItem
            mouseY={navMouseY}
            path="/methodology"
            name="Methodology & Evidence"
            icon={BookOpen}
            collapsed={collapsed}
            subtle
            onClick={() => setMenuOpen(false)}
          />
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
                navigate(`/assets?q=${encodeURIComponent(search)}`)
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
                <Route path="/assets" element={<Assets />} />
                <Route path="/intelligence" element={<Intelligence />} />
                <Route path="/curated-intelligence" element={<CuratedIntelligence />} />
                <Route path="/ml" element={<MlLab />} />
                <Route path="/what-if" element={<WhatIf />} />
                <Route path="/remediation" element={<Remediation />} />
                <Route path="/posture" element={<Posture />} />
                <Route path="/resilience" element={<Resilience />} />
                <Route path="/coverage" element={<Coverage />} />
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
