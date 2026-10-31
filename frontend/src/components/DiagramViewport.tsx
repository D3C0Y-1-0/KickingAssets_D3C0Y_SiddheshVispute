import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Fit the authored SVG coordinate space; each viewer retains its own pan/zoom controls. */
export function DiagramViewport({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const plateWidth = width + 40
  const plateHeight = height + 72

  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const fit = () =>
      setScale(Math.min(element.clientWidth / plateWidth, element.clientHeight / plateHeight, 1))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [plateWidth, plateHeight])

  return (
    <div ref={container} className="diagram-viewport">
      <div
        className="diagram-coordinate-space"
        style={{
          width: plateWidth,
          height: plateHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
