import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { cn } from '../lib/utils'

type EncryptedTextProps = {
  text: string
  className?: string
  /**
   * Time in milliseconds between revealing each subsequent real character.
   * Lower is faster. Defaults to 50ms per character.
   */
  revealDelayMs?: number
  /** Optional custom character set to use for the gibberish effect. */
  charset?: string
  /**
   * Time in milliseconds between gibberish flips for unrevealed characters.
   * Lower is more jittery. Defaults to 50ms.
   */
  flipDelayMs?: number
  /** CSS class for styling the encrypted/scrambled characters */
  encryptedClassName?: string
  /** CSS class for styling the revealed characters */
  revealedClassName?: string
  /**
   * 'reveal' (default) scrambles in from gibberish to real text, the
   * original behavior. 'hide' runs the identical per-character timing in
   * reverse, turning real text back into gibberish — used for a matching
   * "outro" when cycling between lines.
   */
  mode?: 'reveal' | 'hide'
}

const DEFAULT_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?'

function generateRandomCharacter(charset: string): string {
  const index = Math.floor(Math.random() * charset.length)
  return charset.charAt(index)
}

function generateGibberishPreservingSpaces(original: string, charset: string): string {
  if (!original) return ''
  let result = ''
  for (let i = 0; i < original.length; i += 1) {
    const ch = original[i]
    result += ch === ' ' ? ' ' : generateRandomCharacter(charset)
  }
  return result
}

/**
 * Reveals `text` character by character, with unrevealed characters cycling through
 * random gibberish until their turn. Starts once the element scrolls into view.
 * Respects prefers-reduced-motion by revealing the full text immediately.
 */
export const EncryptedText: React.FC<EncryptedTextProps> = ({
  text,
  className,
  revealDelayMs = 50,
  charset = DEFAULT_CHARSET,
  flipDelayMs = 50,
  encryptedClassName,
  revealedClassName,
  mode = 'reveal',
}) => {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const reduceMotion = useReducedMotion()

  const [revealCount, setRevealCount] = useState<number>(mode === 'hide' ? text.length : 0)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const lastFlipTimeRef = useRef<number>(0)
  const scrambleCharsRef = useRef<string[]>(
    text ? generateGibberishPreservingSpaces(text, charset).split('') : [],
  )

  useEffect(() => {
    if (!isInView) return

    // Reduced motion: skip the scramble animation and jump straight to the
    // mode's resting state (fully revealed, or fully hidden).
    if (reduceMotion) {
      setRevealCount(mode === 'hide' ? 0 : text.length)
      return
    }

    // Reset state for a fresh animation whenever dependencies change
    const initial = text ? generateGibberishPreservingSpaces(text, charset) : ''
    scrambleCharsRef.current = initial.split('')
    startTimeRef.current = performance.now()
    lastFlipTimeRef.current = startTimeRef.current
    setRevealCount(mode === 'hide' ? text.length : 0)

    let isCancelled = false

    const update = (now: number) => {
      if (isCancelled) return

      const elapsedMs = now - startTimeRef.current
      const totalLength = text.length
      const steps = Math.min(totalLength, Math.floor(elapsedMs / Math.max(1, revealDelayMs)))
      const currentRevealCount = mode === 'hide' ? totalLength - steps : steps

      setRevealCount(currentRevealCount)

      const done = mode === 'hide' ? currentRevealCount <= 0 : currentRevealCount >= totalLength
      if (done) {
        return
      }

      // Re-randomize the gibberish side of the boundary on an interval
      const timeSinceLastFlip = now - lastFlipTimeRef.current
      if (timeSinceLastFlip >= Math.max(0, flipDelayMs)) {
        for (let index = 0; index < totalLength; index += 1) {
          if (index >= currentRevealCount && text[index] !== ' ') {
            scrambleCharsRef.current[index] = generateRandomCharacter(charset)
          }
        }
        lastFlipTimeRef.current = now
      }

      animationFrameRef.current = requestAnimationFrame(update)
    }

    animationFrameRef.current = requestAnimationFrame(update)

    return () => {
      isCancelled = true
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isInView, text, revealDelayMs, charset, flipDelayMs, reduceMotion, mode])

  if (!text) return null

  return (
    <motion.span ref={ref} className={cn(className)} aria-label={text} role="text">
      {text.split('').map((char, index) => {
        const isRevealed = index < revealCount
        const displayChar = isRevealed
          ? char
          : char === ' '
            ? ' '
            : (scrambleCharsRef.current[index] ?? generateRandomCharacter(charset))

        return (
          <span key={index} className={cn(isRevealed ? revealedClassName : encryptedClassName)}>
            {displayChar}
          </span>
        )
      })}
    </motion.span>
  )
}
