import type { Asset } from '../api/client'
import type { InfrastructureAsset, InfrastructureSector } from '../types/infrastructure'
import type { TwinRisk } from '../hooks/twinRisk'
import { TWIN_LINKS } from './twinLinks'

const SECTOR: Record<Asset['sector'], InfrastructureSector> = {
  power: 'power',
  water: 'water',
  healthcare: 'healthcare',
}
const LEVEL = { essential: 'critical', important: 'high', supporting: 'medium' } as const
/** Ordinal rank of the scenario's criticality tier, not a measurement. */
const RANK = { essential: 100, important: 66, supporting: 33 } as const

/**
 * The diagrams select scenario assets, not invented ones. Each diagram part is represented by the
 * highest-scoring asset linked to it in the latest run (or the first linked asset before any run),
 * so the side panel, the radar and the Assets page all talk about the same record.
 */
export function buildTwinAssets(
  assets: Asset[] | undefined,
  risk: Record<string, TwinRisk>,
): InfrastructureAsset[] {
  const byId = new Map((assets ?? []).map((a) => [a.id, a]))
  const out: InfrastructureAsset[] = []
  for (const [part, ids] of Object.entries(TWIN_LINKS)) {
    const id = risk[part]?.assetId ?? ids.find((candidate) => byId.has(candidate))
    const asset = id ? byId.get(id) : undefined
    if (!asset) continue
    out.push({
      id: asset.id,
      name: asset.name,
      assetType: asset.asset_type,
      sector: SECTOR[asset.sector],
      site: asset.site,
      description: asset.description,
      status: 'operational',
      criticalityScore: RANK[asset.criticality],
      criticalityLevel: LEVEL[asset.criticality],
      operationalImportance: 0,
      safetyImpact: 0,
      serviceDisruptionImpact: 0,
      redundancyScore: 0,
      dependencies: [],
      dependents: [],
      lastUpdated: '',
      ...(part.startsWith('city-')
        ? { smartCityComponentId: part }
        : { substationComponentId: part }),
    })
  }
  return out
}
