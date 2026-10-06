'use client'

import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import { initialState, reducer, type Action, type MissionState } from '@/lib/mission/sim'

const StateCtx = createContext<MissionState | null>(null)
const DispatchCtx = createContext<Dispatch<Action> | null>(null)

const TICK_MS = 200

export function MissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      dispatch({ type: 'tick', dt: Math.min(1, (now - last) / 1000) })
      last = now
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  )
}

export function useMission() {
  const s = useContext(StateCtx)
  if (!s) throw new Error('useMission outside MissionProvider')
  return s
}

export function useDispatch() {
  const d = useContext(DispatchCtx)
  if (!d) throw new Error('useDispatch outside MissionProvider')
  return d
}
