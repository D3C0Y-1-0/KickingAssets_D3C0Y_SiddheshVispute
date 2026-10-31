import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combine class names, letting a later Tailwind utility override an earlier one. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
