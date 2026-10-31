import type { Vec3 } from './scenes'

/**
 * The substation scene shows real scenario assets (Aurora City, North Energy Campus). Names, types,
 * criticality and exposure below are copied from the scenario definition; live product and risk are
 * added at render time from the API when a simulation exists. The 3D positions are illustrative.
 */
export type SubstationAsset = {
  id: string
  name: string
  kind: 'gateway' | 'controller' | 'server' | 'sensor' | 'backup'
  criticality: 'essential' | 'important' | 'supporting'
  exposure: 'external' | 'internal' | 'isolated'
  /** What this asset is for in the scene (scenario description, not a measurement). */
  role: string
  /** Marker position relative to the substation origin. */
  anchor: Vec3
}

export const SUBSTATION_ASSETS: SubstationAsset[] = [
  {
    id: 'PWR-001',
    name: 'North Grid Gateway',
    kind: 'gateway',
    criticality: 'important',
    exposure: 'external',
    role: 'Remote-access boundary between the energy campus and outside networks.',
    anchor: [6.2, 6.4, 2.8],
  },
  {
    id: 'PWR-008',
    name: 'Dispatch Control Server',
    kind: 'server',
    criticality: 'essential',
    exposure: 'internal',
    role: 'Issues dispatch commands to the substation controllers over OPC UA.',
    anchor: [4.6, 3.1, -1.0],
  },
  {
    id: 'PWR-002',
    name: 'North Substation PLC',
    kind: 'controller',
    criticality: 'essential',
    exposure: 'internal',
    role: 'Controls the north substation and feeds the feeder protection relay.',
    anchor: [1.5, 2.8, -2.5],
  },
  {
    id: 'PWR-007',
    name: 'Feeder Protection Relay',
    kind: 'controller',
    criticality: 'essential',
    exposure: 'internal',
    role: 'Protects the feeder that supplies the water and healthcare sectors.',
    anchor: [-0.5, 2.3, 2.6],
  },
  {
    id: 'PWR-006',
    name: 'Transformer Sensor Array',
    kind: 'sensor',
    criticality: 'supporting',
    exposure: 'internal',
    role: 'Reports transformer condition to the historian and the north PLC.',
    anchor: [-4, 3.9, -1.5],
  },
  {
    id: 'PWR-010',
    name: 'Emergency Power Backup',
    kind: 'backup',
    criticality: 'important',
    exposure: 'isolated',
    role: 'Backup supply for the dispatch control server.',
    anchor: [-6.2, 2.2, 3],
  },
]

export type SubstationLink = {
  from: string
  to: string
  kind: 'data' | 'operational'
  label: string
}

/** Only relationships that exist in the scenario graphs. PWR-001 reaches PWR-008 through PWR-004. */
export const SUBSTATION_LINKS: SubstationLink[] = [
  {
    from: 'PWR-001',
    to: 'PWR-008',
    kind: 'data',
    label: 'Cyber route via PWR-004 (HTTPS, then OPC UA)',
  },
  { from: 'PWR-008', to: 'PWR-002', kind: 'data', label: 'Cyber route (OPC UA)' },
  { from: 'PWR-008', to: 'PWR-007', kind: 'data', label: 'Cyber route (OPC UA)' },
  {
    from: 'PWR-006',
    to: 'PWR-002',
    kind: 'operational',
    label: 'Operational dependency (sensing)',
  },
  { from: 'PWR-002', to: 'PWR-007', kind: 'operational', label: 'Operational dependency' },
  {
    from: 'PWR-010',
    to: 'PWR-008',
    kind: 'operational',
    label: 'Operational dependency (backup power)',
  },
]

export const KIND_LABEL: Record<SubstationAsset['kind'], string> = {
  gateway: 'Gateway',
  controller: 'Controller',
  server: 'Server',
  sensor: 'Sensor',
  backup: 'Backup power',
}
