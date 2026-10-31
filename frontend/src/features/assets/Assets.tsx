import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useAssets } from '../../hooks/queries'
import { AssetDrawer } from '../../components/AssetDrawer'
import {
  EmptyState,
  PageHeading,
  Panel,
  QueryState,
  SampleBadge,
  SectorBadge,
} from '../../components/ui'
import type { Asset } from '../../api/client'

type SortKey = 'name' | 'sector' | 'asset_type' | 'criticality' | 'exposure'
export default function Assets() {
  const query = useAssets()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const [sector, setSector] = useState('all')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState<SortKey>('name')
  const [descending, setDescending] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const rows = useMemo(
    () =>
      (query.data ?? [])
        .filter(
          (a) =>
            (sector === 'all' || a.sector === sector) &&
            (type === 'all' || a.asset_type === type) &&
            [a.name, a.id, a.product, a.site].some((v) =>
              v.toLowerCase().includes(search.toLowerCase()),
            ),
        )
        .sort((a, b) => {
          const order =
            sort === 'criticality'
              ? { essential: 0, important: 1, supporting: 2 }[a.criticality] -
                { essential: 0, important: 1, supporting: 2 }[b.criticality]
              : a[sort].localeCompare(b[sort])
          return descending ? -order : order
        }),
    [query.data, sector, type, search, sort, descending],
  )
  const sortColumn = (key: SortKey) => {
    if (sort === key) setDescending(!descending)
    else {
      setSort(key)
      setDescending(false)
    }
  }
  const header = (key: SortKey, label: string) => (
    <th aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}>
      <button className="sort-header" onClick={() => sortColumn(key)}>
        {label}
        {sort === key ? (
          descending ? (
            <ArrowDown size={12} />
          ) : (
            <ArrowUp size={12} />
          )
        ) : (
          <ArrowUpDown size={12} />
        )}
      </button>
    </th>
  )
  return (
    <>
      <PageHeading
        title="Asset & risk register"
        description="Inspect the infrastructure, configuration and evidence behind each asset."
        actions={<SampleBadge>Scenario inventory</SampleBadge>}
      />
      <Panel
        title="Infrastructure inventory"
        aside={<span className="subtle-label mono">{query.data?.length ?? '—'} TOTAL ASSETS</span>}
      >
        <div className="filter-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search asset inventory"
              placeholder="Search by name, ID, product or site…"
              value={search}
              onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {})}
            />
          </label>
          <SlidersHorizontal size={16} className="muted" />
          <label className="sr-only" htmlFor="sector-filter">
            Sector
          </label>
          <select id="sector-filter" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="all">All sectors</option>
            <option value="power">Power</option>
            <option value="water">Water</option>
            <option value="healthcare">Healthcare</option>
          </select>
          <label className="sr-only" htmlFor="type-filter">
            Asset type
          </label>
          <select id="type-filter" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All asset types</option>
            {(
              [
                'gateway',
                'controller',
                'workstation',
                'server',
                'sensor',
                'backup',
              ] satisfies Asset['asset_type'][]
            ).map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
        {query.isSuccess && (
          <>
            <div className="table-scroll">
              <table className="inventory-table">
                <thead>
                  <tr>
                    {header('name', 'ASSET / PRODUCT')}
                    {header('sector', 'SECTOR')}
                    {header('asset_type', 'TYPE')}
                    {header('criticality', 'CRITICALITY')}
                    {header('exposure', 'EXPOSURE')}
                    <th>ASSESSMENT</th>
                    <th>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <button className="asset-name" onClick={() => setSelected(a.id)}>
                          {a.name}
                        </button>
                        <small className="mono muted">
                          {a.id} · {a.product} {a.version}
                        </small>
                      </td>
                      <td>
                        <SectorBadge sector={a.sector} />
                      </td>
                      <td className="capitalize">{a.asset_type}</td>
                      <td>
                        <span className={`criticality ${a.criticality}`}>{a.criticality}</span>
                      </td>
                      <td>
                        <span className={`exposure ${a.exposure}`}>{a.exposure}</span>
                      </td>
                      <td>
                        <span className="muted">Not assessed</span>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          onClick={() => setSelected(a.id)}
                          aria-label={`Inspect ${a.name}`}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <EmptyState title="No matching assets">
                Try a different search or clear the sector and type filters.
              </EmptyState>
            )}
            <div className="table-footer">
              <span>
                Showing {rows.length} of {query.data.length} assets
              </span>
              <span>
                <span className="status-dot" />
                Source: Aurora City fixture v1 · Scenario assumptions
              </span>
            </div>
          </>
        )}
      </Panel>
      <div className="preview-notice">
        <span>
          Calculated risk and vulnerability findings will appear here after the relevant engines are
          implemented. Missing scores are never treated as zero.
        </span>
      </div>
      <AssetDrawer id={selected} onClose={() => setSelected(null)} />
    </>
  )
}
