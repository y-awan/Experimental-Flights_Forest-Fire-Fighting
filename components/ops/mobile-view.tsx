'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Presentation-only state for small screens (< lg). The map stays mounted at all times;
 * the fleet panel overlays it when `panel === 'fleet'`. Desktop ignores this state because
 * the fleet rail is always visible from `lg` upward (pure CSS, no JS media queries).
 */
export type MobilePanel = 'map' | 'fleet'

type MobileViewContext = { panel: MobilePanel; setPanel: (p: MobilePanel) => void }

const Ctx = createContext<MobileViewContext>({ panel: 'map', setPanel: () => {} })

export function MobileViewProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<MobilePanel>('map')
  const value = useMemo(() => ({ panel, setPanel }), [panel])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMobileView() {
  return useContext(Ctx)
}
