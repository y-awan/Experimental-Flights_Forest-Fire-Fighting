import { HOME_NAME } from '@/lib/mission/data'
import { droneHealth } from '@/lib/mission/derive'
import { CRITICAL, DRONE_ACCENT, INK, PAPER, SELECT, flagSvg, glyphSvg } from '@/lib/mission/glyph'
import type { Detection, Drone } from '@/lib/mission/types'

/**
 * Pure HTML builders for DivIcon markers. Each returns a `key` that changes only when the
 * rendered output changes, so `cachedIcon(key, …)` can reuse the icon instance.
 */

export function sectorLabel(id: string, pct: number, owned: boolean) {
  const style = owned ? `background:${SELECT};color:#0b1626` : 'background:rgba(21,20,15,.82)'
  return {
    key: `sec-${id}-${pct}-${owned}`,
    html: `<span class="ops-chip" style="transform:translate(-50%,0);${style}">SECTOR ${id}<span style="opacity:.75;font-weight:500">${pct}%</span></span>`,
  }
}

export function routeLabel(droneId: string, label: string, selected: boolean) {
  return {
    key: `route-${droneId}-${label}-${selected}`,
    html: `<span class="ops-chip" ${selected ? 'data-state="selected"' : ''} style="transform:translate(-50%,-50%)">${label}</span>`,
  }
}

export function detectionIcon(detection: Detection, selected: boolean) {
  const s = detection.status
  const r = Math.round(detection.uncertainty)
  const key = `det-${s}-${r}-${selected}-${Math.round(detection.confidence * 100)}`
  if (s === 'dismissed') {
    return {
      key,
      html: `<div style="position:relative;width:22px;height:22px;transform:translate(-50%,-50%)"><svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/><path d="M7 7 L15 15 M15 7 L7 15" stroke="${INK}" stroke-width="2"/></svg><span class="ops-chip" style="position:absolute;left:26px;top:2px;background:rgba(21,20,15,.85);color:#aeaba1">${detection.id} · dismissed</span></div>`,
    }
  }
  const confirmed = s === 'confirmed'
  const chip = confirmed
    ? `${flagSvg('critical')} FIRE CONFIRMED`
    : `<span style="color:${CRITICAL}">POSSIBLE FIRE</span> ${Math.round(detection.confidence * 100)}% · ±${r} m`
  return {
    key,
    html: `<div style="position:relative;width:30px;height:30px;transform:translate(-50%,-50%)"><svg width="30" height="30" viewBox="-15 -15 30 30">${selected ? `<circle r="14" fill="none" stroke="${SELECT}" stroke-width="2.5"/>` : ''}<path d="M0 -12 V-6 M0 6 V12 M-12 0 H-6 M6 0 H12" stroke="${PAPER}" stroke-width="4"/><path d="M0 -12 V-6 M0 6 V12 M-12 0 H-6 M6 0 H12" stroke="${CRITICAL}" stroke-width="2"/><path d="M0 -6 L6 0 L0 6 L-6 0 Z" fill="${confirmed ? CRITICAL : PAPER}" stroke="${INK}" stroke-width="1.5"/><circle r="1.6" fill="${confirmed ? INK : CRITICAL}"/></svg><span class="ops-chip" ${confirmed ? 'data-severity="critical"' : ''} style="position:absolute;left:32px;top:6px;${confirmed ? '' : `box-shadow:0 0 0 1px ${CRITICAL}`}">${chip}</span></div>`,
  }
}

export function droneIcon(d: Drone, idx: number, elapsed: number, selected: boolean, hovered: boolean) {
  const h = droneHealth(d, elapsed, idx)
  const r = d.reported
  const airborne = r.altitude > 0.5
  const svg = glyphSvg({ accent: DRONE_ACCENT[d.id], label: d.short.slice(1), severity: h.level, stale: h.stale, selected: selected || hovered, heading: airborne ? r.heading : null })
  let chip = `${d.short}<span style="opacity:.7;font-weight:500">${Math.round(r.altitude)} m</span>`
  let attrs = ''
  if (h.level === 'caution') {
    chip = `<span class="ops-chip-flag">${flagSvg('caution')}</span>${d.short} ${Math.round(r.battery)}%`
    attrs = 'data-severity="caution"'
  }
  if (h.stale) {
    chip = `${flagSvg('stale')}${d.short} LAST KNOWN ${Math.floor(h.age)} s`
    attrs = 'data-stale="true"'
  }
  if (h.level === 'critical') {
    chip = `${flagSvg('critical')}${d.short} ${h.linkLost ? 'LINK LOST' : `${Math.round(r.battery)}%`}`
    attrs = 'data-severity="critical"'
  }
  if (selected) attrs += ' data-state="selected"'
  return {
    key: `${d.id}-${Math.round(r.heading / 6)}-${h.level}-${h.stale}-${selected}-${hovered}-${chip}`,
    html: `<div style="position:relative;width:34px;height:34px;transform:translate(-50%,-50%)">${svg}<span class="ops-chip" ${attrs} style="position:absolute;left:31px;top:9px">${chip}</span></div>`,
  }
}

export function homeIcon() {
  return {
    key: 'home',
    html: `<div style="position:relative;transform:translate(-50%,-50%);width:24px;height:24px"><svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" fill="${PAPER}" stroke="${INK}" stroke-width="2"/><text x="12" y="16.5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="12" font-weight="700" fill="${INK}">H</text></svg><span class="ops-chip" style="position:absolute;left:28px;top:4px">${HOME_NAME}</span></div>`,
  }
}

export function vertexIcon(closing: boolean) {
  return {
    key: `vertex-${closing}`,
    html: closing
      ? `<div style="transform:translate(-50%,-50%);width:16px;height:16px;background:${SELECT};border:2px solid ${INK}"></div>`
      : `<div style="transform:translate(-50%,-50%);width:9px;height:9px;background:${PAPER};border:2px solid ${SELECT}"></div>`,
  }
}
