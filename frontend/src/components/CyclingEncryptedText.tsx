import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { EncryptedText } from './EncryptedText'

type CyclingEncryptedTextProps = {
  lines: string[]
  /** Total time each line is shown for, including its own reveal/hide animation. */
  intervalMs?: number
  revealDelayMs?: number
  flipDelayMs?: number
  encryptedClassName?: string
  revealedClassName?: string
}

/**
 * Cycles EncryptedText through a list of lines, replaying the same
 * scramble animation for both the intro (EncryptedText's own
 * mode="reveal") and the outro (mode="hide", the same per-character timing
 * run in reverse) so every line enters and exits the same way.
 */
export function CyclingEncryptedText({
  lines,
  intervalMs = 5000,
  revealDelayMs = 35,
  flipDelayMs = 40,
  encryptedClassName,
  revealedClassName,
}: CyclingEncryptedTextProps) {
  const [index, setIndex] = useState(0)
  const [hiding, setHiding] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (lines.length <= 1 || reduceMotion) return
    const outroMs = Math.min(600, intervalMs / 4)
    const hideTimer = setTimeout(() => setHiding(true), intervalMs - outroMs)
    const advanceTimer = setTimeout(() => {
      setIndex((i) => (i + 1) % lines.length)
      setHiding(false)
    }, intervalMs)
    return () => {
      clearTimeout(hideTimer)
      clearTimeout(advanceTimer)
    }
  }, [index, lines.length, intervalMs, reduceMotion])

  return (
    <EncryptedText
      key={index}
      text={lines[index] ?? ''}
      mode={hiding ? 'hide' : 'reveal'}
      revealDelayMs={revealDelayMs}
      flipDelayMs={flipDelayMs}
      encryptedClassName={encryptedClassName}
      revealedClassName={revealedClassName}
    />
  )
}
