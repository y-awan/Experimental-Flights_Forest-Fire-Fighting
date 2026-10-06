export function fmtDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function fmtAgo(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} s ago`
  return `${Math.floor(s / 60)} min ${s % 60} s ago`
}

export function fmtSpoken(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r} s` : `${m} min`
}

export function fmtMeters(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}
