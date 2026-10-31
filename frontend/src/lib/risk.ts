export type Category = 'critical' | 'high' | 'medium' | 'low'
export const categoryLabels: Category[] = ['critical', 'high', 'medium', 'low']
export const percent = (value: number | null | undefined, digits = 0) =>
  value == null ? '—' : `${(value * 100).toFixed(digits)}%`
