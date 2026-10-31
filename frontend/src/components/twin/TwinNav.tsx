import { createContext, useContext } from 'react'

export interface TwinNavValue {
  /** Part another screen (or a connection chip) asked to bring into focus. */
  requestedPart: string | null
  /** Switch to the twin that owns this part and select it. */
  openPart: (partId: string) => void
  /** Open the scenario asset detail drawer. */
  openAsset: (assetId: string) => void
}

const TwinNavContext = createContext<TwinNavValue>({
  requestedPart: null,
  openPart: () => {},
  openAsset: () => {},
})

export const TwinNavProvider = TwinNavContext.Provider
export const useTwinNav = () => useContext(TwinNavContext)
