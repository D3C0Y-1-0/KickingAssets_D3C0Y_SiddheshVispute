/**
 * Which scenario assets sit behind each part of a digital twin. This is a scenario assumption
 * (a physical part has no CVEs of its own; the controller, relay or gateway attached to it does).
 * Parts that are purely mechanical or civil have no cyber asset and are left unmapped.
 */
export const TWIN_LINKS: Record<string, string[]> = {
  // Power substation
  'sub-control-cabinet': ['PWR-001', 'PWR-002'],
  'sub-circuit-breaker': ['PWR-007'],
  'sub-transformer': ['PWR-006'],
  'sub-busbar-gantry': ['PWR-003'],
  // Water treatment plant
  'water-intake': ['WTR-002'],
  'water-coagulation': ['WTR-003'],
  'water-clarifiers': ['WTR-005'],
  'water-filters': ['WTR-009'],
  'water-chemical': ['WTR-001'],
  'water-booster-pumps': ['WTR-007'],
  'water-reservoir': ['WTR-006'],
  // Hospital
  'hosp-tower': ['HLT-001', 'HLT-005'],
  'hosp-trauma': ['HLT-009'],
  'hosp-oxygen': ['HLT-007'],
  'hosp-generator': ['HLT-010'],
  // Integrated smart city: a campus is the worst of its sector's assets
  'city-substation': [
    'PWR-001',
    'PWR-002',
    'PWR-003',
    'PWR-004',
    'PWR-005',
    'PWR-006',
    'PWR-007',
    'PWR-008',
    'PWR-009',
    'PWR-010',
  ],
  'city-hospital': [
    'HLT-001',
    'HLT-002',
    'HLT-003',
    'HLT-004',
    'HLT-005',
    'HLT-006',
    'HLT-007',
    'HLT-008',
    'HLT-009',
    'HLT-010',
  ],
  'city-water': [
    'WTR-001',
    'WTR-002',
    'WTR-003',
    'WTR-004',
    'WTR-005',
    'WTR-007',
    'WTR-008',
    'WTR-009',
    'WTR-010',
  ],
  'city-reservoir': ['WTR-006'],
}
