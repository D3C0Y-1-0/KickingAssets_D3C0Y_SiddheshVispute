import { createContext, useContext } from 'react'

export interface TwinNavValue {
  /** Part another screen (or a connection chip) asked to bring into focus. */
  requestedPart: string | null
  /** Switch to the twin that owns this part and select it. */
  openPart: (partId: string) => void
  /** Open the scenario asset detail drawer. */
  openAsset: (assetId: string) => void
  /** Diagram switcher, shown inside the diagram header while it is full screen. */
  diagram?: {
    value: string
    options: { id: string; label: string }[]
    onChange: (id: string) => void
  }
}

const TwinNavContext = createContext<TwinNavValue>({
  requestedPart: null,
  openPart: () => {},
  openAsset: () => {},
})

export function DiagramSelect() {
  const { diagram } = useContext(TwinNavContext)
  if (!diagram) return null
  return (
    <select
      className="twin-select ts-diagram-select"
      aria-label="Choose digital twin diagram"
      value={diagram.value}
      onChange={(e) => diagram.onChange(e.target.value)}
    >
      {diagram.options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export const TwinNavProvider = TwinNavContext.Provider
export const useTwinNav = () => useContext(TwinNavContext)
