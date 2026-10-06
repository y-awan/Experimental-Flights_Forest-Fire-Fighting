import type { DroneId } from './types'

export const INK = '#15140f'
export const PAPER = '#f2f0e8'
export const CAUTION = '#e2a634'
export const CRITICAL = '#ec5a50'
export const SELECT = '#65a3f7'
const STALE_BODY = '#cfccc2'

export const DRONE_ACCENT: Record<DroneId, string> = {
  d1: '#8cc4a0',
  d2: '#b3a0e0',
  d3: '#e295b8',
}

export type GlyphOpts = {
  accent: string
  label: string
  severity: 'nominal' | 'caution' | 'critical'
  stale: boolean
  selected: boolean
  heading: number | null
  size?: number
}

const ROTORS: [number, number][] = [
  [-11.5, -11.5],
  [11.5, -11.5],
  [-11.5, 11.5],
  [11.5, 11.5],
]

function badge(severity: GlyphOpts['severity']) {
  if (severity === 'caution')
    return `<g transform="translate(14.5 -14.5)"><path d="M0 -6.2 L6.4 5 H-6.4 Z" fill="${CAUTION}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><rect x="-0.8" y="-2.6" width="1.6" height="4" fill="${INK}"/><rect x="-0.8" y="2.3" width="1.6" height="1.5" fill="${INK}"/></g>`
  if (severity === 'critical')
    return `<g transform="translate(14.5 -14.5)"><path d="M-2.6 -6.2 H2.6 L6.2 -2.6 V2.6 L2.6 6.2 H-2.6 L-6.2 2.6 V-2.6 Z" fill="${CRITICAL}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><rect x="-0.85" y="-3.6" width="1.7" height="4.4" fill="${INK}"/><rect x="-0.85" y="1.7" width="1.7" height="1.6" fill="${INK}"/></g>`
  return ''
}

export function headingPointerPath(stale: boolean) {
  return `<path d="M0,-23.5 L-4.2,-17.4 L4.2,-17.4 Z" fill="${stale ? STALE_BODY : PAPER}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" ${stale ? 'opacity="0.75"' : ''}/>`
}

/**
 * Quadcopter glyph shared by the fleet rail and the map. The body never rotates;
 * only the small nose pointer follows heading so the silhouette stays recognisable.
 */
export function glyphSvg({ accent, label, severity, stale, selected, heading, size = 36 }: GlyphOpts) {
  const bodyFill = stale ? STALE_BODY : PAPER
  const rotorOpacity = stale ? 0.18 : 0.42
  const halo = selected
    ? `<circle r="21" fill="none" stroke="${SELECT}" stroke-width="2.6" ${stale ? 'stroke-dasharray="4 2.6"' : ''}/>`
    : stale
      ? `<circle r="21" fill="none" stroke="${PAPER}" stroke-width="1.6" stroke-dasharray="3.2 2.6"/>`
      : ''
  const arms = `<path d="M-11.5 -11.5 L11.5 11.5 M11.5 -11.5 L-11.5 11.5" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M-11.5 -11.5 L11.5 11.5 M11.5 -11.5 L-11.5 11.5" stroke="#55524b" stroke-width="2" stroke-linecap="round"/>`
  const rotors = ROTORS.map(
    ([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="6.2" fill="${accent}" fill-opacity="${rotorOpacity}" stroke="${INK}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="4.3" fill="none" stroke="${accent}" stroke-width="0.9" stroke-opacity="${stale ? 0.4 : 0.9}"/><circle cx="${x}" cy="${y}" r="1.3" fill="${INK}"/>`,
  ).join('')
  const pointer = heading === null ? '' : `<g transform="rotate(${Math.round(heading)})">${headingPointerPath(stale)}</g>`
  const body = `<rect x="-8.6" y="-8.6" width="17.2" height="17.2" rx="5.6" fill="${bodyFill}" stroke="${INK}" stroke-width="1.7"/><rect x="-5" y="-8" width="10" height="2" rx="1" fill="${accent}" opacity="${stale ? 0.5 : 1}"/>`
  const number = `<text x="0" y="2.6" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="9.5" font-weight="700" fill="${INK}">${label}</text>`
  const eye = `<circle cx="0" cy="5.6" r="1.9" fill="${INK}"/><circle cx="0.6" cy="5" r="0.6" fill="${accent}"/>`
  return `<svg width="${size}" height="${size}" viewBox="-24 -24 48 48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle r="15" fill="${INK}" fill-opacity="0.3"/>${halo}${pointer}${arms}${rotors}${body}${number}${eye}${badge(severity)}</svg>`
}

export function pointerSvg(stale: boolean, size = 44) {
  return `<svg width="${size}" height="${size}" viewBox="-24 -24 48 48" xmlns="http://www.w3.org/2000/svg">${headingPointerPath(stale)}</svg>`
}

export function detectionSvg(status: 'unreviewed' | 'confirmed' | 'dismissed', selected: boolean, size = 36) {
  if (status === 'dismissed')
    return `<svg width="${size}" height="${size}" viewBox="-18 -18 36 36" xmlns="http://www.w3.org/2000/svg">${selected ? `<circle r="15" fill="none" stroke="${SELECT}" stroke-width="2.5"/>` : ''}<circle r="9" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/><path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="${INK}" stroke-width="2"/></svg>`
  const confirmed = status === 'confirmed'
  return `<svg width="${size}" height="${size}" viewBox="-18 -18 36 36" xmlns="http://www.w3.org/2000/svg">${selected ? `<circle r="16" fill="none" stroke="${SELECT}" stroke-width="2.5"/>` : ''}<path d="M0 -13 V-6.5 M0 6.5 V13 M-13 0 H-6.5 M6.5 0 H13" stroke="${INK}" stroke-width="4.5"/><path d="M0 -13 V-6.5 M0 6.5 V13 M-13 0 H-6.5 M6.5 0 H13" stroke="${CRITICAL}" stroke-width="2.2"/><path d="M0 -6.5 L6.5 0 L0 6.5 L-6.5 0 Z" fill="${confirmed ? CRITICAL : PAPER}" stroke="${INK}" stroke-width="1.6"/><circle r="1.8" fill="${confirmed ? INK : CRITICAL}"/></svg>`
}

export function homeSvg(size = 26) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="20" height="20" rx="2" fill="${PAPER}" stroke="${INK}" stroke-width="2"/><text x="13" y="17.6" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="12" font-weight="700" fill="${INK}">H</text></svg>`
}

const FLAG_CAUTION = `<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 L11.5 11 H0.5 Z" fill="${CAUTION}" stroke="${INK}" stroke-width="1"/><rect x="5.3" y="4.3" width="1.4" height="3.6" fill="${INK}"/><rect x="5.3" y="8.6" width="1.4" height="1.4" fill="${INK}"/></svg>`
const FLAG_CRITICAL = `<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 0.5 H8.5 L11.5 3.5 V8.5 L8.5 11.5 H3.5 L0.5 8.5 V3.5 Z" fill="${INK}" /><rect x="5.3" y="2.8" width="1.4" height="4.4" fill="${CRITICAL}"/><rect x="5.3" y="8.1" width="1.4" height="1.4" fill="${CRITICAL}"/></svg>`
const FLAG_STALE = `<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 1.4"/><path d="M6 3 V6 L8 7.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`

export function flagSvg(kind: 'caution' | 'critical' | 'stale') {
  return kind === 'caution' ? FLAG_CAUTION : kind === 'critical' ? FLAG_CRITICAL : FLAG_STALE
}
