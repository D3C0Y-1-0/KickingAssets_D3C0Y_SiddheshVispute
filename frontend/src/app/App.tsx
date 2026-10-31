import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Building2,
  ChevronDown,
  CircleHelp,
  Command,
  FlaskConical,
  Grid2X2,
  Layers,
  ListChecks,
  Menu,
  Network,
  Search,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react'
import { NavLink, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useScenario } from '../hooks/queries'
import { QueryState } from '../components/ui'
import Overview from '../features/overview/Overview'

const Infrastructure = lazy(() => import('../features/infrastructure/Infrastructure'))
const DigitalTwins = lazy(() => import('../features/digital-twins/DigitalTwins'))
const Assets = lazy(() => import('../features/assets/Assets'))
const Intelligence = lazy(() => import('../features/intelligence/Intelligence'))
const WhatIf = lazy(() => import('../features/whatif/WhatIf'))
const Remediation = lazy(() => import('../features/remediation/Remediation'))
const Methodology = lazy(() => import('../features/methodology/Methodology'))
const MlLab = lazy(() => import('../features/ml/MlLab'))
const navigation: { path: string; name: string; icon: typeof Grid2X2; tag?: string }[] = [
  { path: '/', name: 'Command Overview', icon: Grid2X2 },
  { path: '/infrastructure', name: 'Infrastructure Map', icon: Network },
  { path: '/digital-twins', name: 'Digital Twins', icon: Building2, tag: 'ANATOMY' },
  { path: '/assets', name: 'Asset & Risk Register', icon: Layers },
  { path: '/intelligence', name: 'Risk Intelligence', icon: Activity },
  { path: '/ml', name: 'ML Lab', icon: BrainCircuit },
  { path: '/what-if', name: 'What-If Lab', icon: FlaskConical },
  { path: '/remediation', name: 'Remediation Plan', icon: ListChecks },
]

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
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
    navigation.find((x) => x.path === location.pathname)?.name ?? 'Methodology & Evidence'
  useEffect(() => {
    setMenuOpen(false)
    document.title = `${activeName} | GridSentinel`
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
    <div className="app-shell">
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
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Shield size={27} />
            <Grid2X2 size={12} />
          </span>
          <span>
            Grid<span className="brand-light">Sentinel</span>
            <small>INFRASTRUCTURE INTELLIGENCE</small>
          </span>
        </Link>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-card">
          <span className="workspace-icon">
            <Command size={18} />
          </span>
          <div>
            Aurora City<small>Critical infrastructure workspace</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(({ path, name, icon: Icon, tag }) => (
            <NavLink
              key={path}
              end={path === '/'}
              to={path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{name}</span>
              {tag ? (
                <span className="nav-tag">{tag}</span>
              ) : (
                path === '/what-if' && <span className="nav-tag">ACT</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            to="/methodology"
          >
            <BookOpen size={18} />
            Methodology & Evidence
          </NavLink>
          <div className="foundation-note">
            <div>
              <span className="status-dot" />
              PROTOTYPE · LIVE WORKFLOW
            </div>
            <p>
              Simulate, assess with ML,
              <br />
              then act.
            </p>
            <Link to="/methodology">
              How it works
              <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="sidebar-footer">
            <span className="avatar">GS</span>
            <div>
              Local demonstration<small>Fictional city · real CVE data</small>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
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
                <Route path="/ml" element={<MlLab />} />
                <Route path="/what-if" element={<WhatIf />} />
                <Route path="/remediation" element={<Remediation />} />
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
            <Shield size={12} /> GRIDSENTINEL <span className="muted">/</span> See the blast radius
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
