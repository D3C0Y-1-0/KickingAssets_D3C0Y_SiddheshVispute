import { cloneElement, isValidElement, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import Landing from '../features/landing/Landing'

const SEEN_KEY = 'gridinal.landing.seen'

function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Gates the dashboard (App, untouched) behind the scroll intro (Landing) on
 * first load of a browser session. Entering the dashboard sets a
 * sessionStorage flag, so a refresh or route change mid-session skips
 * straight back to the dashboard rather than replaying the intro. Clicking
 * the sidebar logo (App's onLogoClick, injected here) flips back to the
 * intro on demand.
 */
export default function AppGate({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useState(() => hasSeenIntro())

  if (!entered) {
    return (
      <Landing
        onEnter={() => {
          try {
            sessionStorage.setItem(SEEN_KEY, '1')
          } catch {
            /* storage unavailable: intro will just replay on next load */
          }
          window.scrollTo(0, 0)
          setEntered(true)
        }}
      />
    )
  }

  if (isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onLogoClick?: () => void }>, {
      onLogoClick: () => {
        try {
          sessionStorage.removeItem(SEEN_KEY)
        } catch {
          /* storage unavailable: intro still replays for this render */
        }
        window.scrollTo(0, 0)
        setEntered(false)
      },
    })
  }

  return <>{children}</>
}
