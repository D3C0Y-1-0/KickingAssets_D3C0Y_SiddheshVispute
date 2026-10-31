/** Isolated visual design fixtures. Never sent to the backend or treated as analysis. */
export type DemoCategory = 'critical' | 'high' | 'medium' | 'low'
export const categoryLabels: DemoCategory[] = ['critical', 'high', 'medium', 'low']
export const demoRisk = {
  cityIndex: 64,
  label: 'Illustrative preview · not calculated',
  assets: {
    'PWR-001': { score: 91, category: 'critical' },
    'WTR-002': { score: 84, category: 'high' },
    'HLT-001': { score: 79, category: 'high' },
    'PWR-002': { score: 73, category: 'high' },
    'WTR-004': { score: 62, category: 'medium' },
    'HLT-008': { score: 48, category: 'medium' },
    'PWR-010': { score: 24, category: 'low' },
  } satisfies Record<string, { score: number; category: DemoCategory }>,
}
export const demoFor = (id: string): { score: number; category: DemoCategory } | undefined =>
  demoRisk.assets[id as keyof typeof demoRisk.assets]

export const actionCatalog = [
  {
    type: 'enable_mfa',
    name: 'Require multifactor authentication',
    description: 'Review remote access identity controls and enrollment prerequisites.',
    applicable: (mfa: boolean | null | undefined, remote: boolean | null | undefined) =>
      mfa === false && remote === true,
    effort: 'Identity review required',
    disruption: 'Enrollment window; preserve an emergency access procedure.',
  },
  {
    type: 'restrict_remote_access',
    name: 'Restrict remote management',
    description: 'Review an allowlist and a managed access path for remote administration.',
    applicable: (_mfa: boolean | null | undefined, remote: boolean | null | undefined) =>
      remote === true,
    effort: 'Network review required',
    disruption: 'Remote operator access may be interrupted.',
  },
  {
    type: 'patch_review',
    name: 'Plan a compatibility and patch review',
    description: 'Confirm vendor support, applicability and rollback before a maintenance window.',
    applicable: () => true,
    effort: 'Vendor validation required',
    disruption: 'A restart may affect service; no change is applied here.',
  },
] as const
