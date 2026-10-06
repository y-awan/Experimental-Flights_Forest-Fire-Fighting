'use client'

import { memo } from 'react'
import { Marker } from 'react-leaflet'
import { BOUNDARY, HOME } from '@/lib/mission/data'
import { INK } from '@/lib/mission/glyph'
import { cachedIcon, htmlIcon, ll } from '../leaflet-utils'
import { homeIcon } from '../icons'
import { CasedLine } from '../primitives'

const BOUNDARY_LATLNGS = [...BOUNDARY, BOUNDARY[0]].map(ll)
const HOME_LATLNG = ll(HOME)

export const BoundaryLayer = memo(function BoundaryLayer() {
  return <CasedLine positions={BOUNDARY_LATLNGS} color={INK} weight={2} />
})

export const HomeLayer = memo(function HomeLayer() {
  const { key, html } = homeIcon()
  return <Marker position={HOME_LATLNG} icon={cachedIcon(key, () => htmlIcon(html))} interactive={false} keyboard={false} />
})
