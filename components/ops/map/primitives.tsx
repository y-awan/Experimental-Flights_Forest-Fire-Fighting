'use client'

import type L from 'leaflet'
import { useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import { PAPER } from '@/lib/mission/glyph'

type CasedLineProps = {
  positions: L.LatLngTuple[]
  color: string
  weight: number
  dash?: string
  opacity?: number
}

/** A line with a light halo underneath so it stays legible on both terrain and imagery. */
export function CasedLine({ positions, color, weight, dash, opacity = 1 }: CasedLineProps) {
  const casing = useMemo<L.PathOptions>(
    () => ({ color: PAPER, weight: weight + 2.5, opacity: 0.55 * opacity, dashArray: dash, lineCap: 'butt', interactive: false }),
    [weight, opacity, dash],
  )
  const stroke = useMemo<L.PathOptions>(
    () => ({ color, weight, opacity, dashArray: dash, lineCap: 'butt', interactive: false }),
    [color, weight, opacity, dash],
  )
  if (positions.length < 2) return null
  return (
    <>
      <Polyline smoothFactor={0} positions={positions} pathOptions={casing} />
      <Polyline smoothFactor={0} positions={positions} pathOptions={stroke} />
    </>
  )
}
