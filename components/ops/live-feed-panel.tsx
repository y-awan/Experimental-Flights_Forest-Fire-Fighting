'use client'

import { Camera, CameraOff, ChevronDown, Expand, Maximize2, Minimize2, Radio, ScanLine, Volume2, VolumeX, X } from 'lucide-react'
import { useState } from 'react'
import type { Drone } from '@/lib/mission/types'
import { cn } from '@/lib/utils'

const CAMERAS = ['EO', 'THERMAL', 'LOW-LIGHT'] as const

type LiveFeedPanelProps = {
  drone: Drone
  onClose: () => void
}

export function LiveFeedPanel({ drone, onClose }: LiveFeedPanelProps) {
  const [open, setOpen] = useState(false)
  const [camera, setCamera] = useState<(typeof CAMERAS)[number]>('THERMAL')
  const [muted, setMuted] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [feedState, setFeedState] = useState<'live' | 'buffering'>('live')

  if (!open) {
    return (
      <button
        type="button"
        className="pointer-events-auto absolute bottom-[72px] right-3 z-[620] flex items-center gap-2 border border-select bg-surface px-3 py-2 text-left shadow-xl lg:bottom-4"
        onClick={() => setOpen(true)}
      >
        <span className="relative flex size-7 items-center justify-center border border-line-strong bg-raised text-select">
          <Camera className="size-4" aria-hidden="true" />
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-live" />
        </span>
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-live">Live feed</span>
          <span className="block font-mono text-[12px] text-fg">{drone.short} · {drone.name}</span>
        </span>
        <Expand className="ml-2 size-4 text-fg-muted" aria-hidden="true" />
      </button>
    )
  }

  return (
    <section
      aria-label={`${drone.name} live video`}
      className={cn(
        'pointer-events-auto absolute z-[620] overflow-hidden border border-line-strong bg-surface shadow-2xl',
        fullscreen ? 'inset-2' : 'bottom-3 right-3 w-[min(440px,calc(100%-24px))] lg:w-[440px]',
        'bottom-[68px] lg:bottom-3',
      )}
    >
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-live">
          <Radio className="size-3.5" aria-hidden="true" /> Live
        </span>
        <span className="truncate font-mono text-[12px] text-fg">{drone.short} · {drone.name}</span>
        <span className="ml-auto font-mono text-[11px] text-ok">{drone.linkDown ? 'LINK LOST' : '● 82%'}</span>
        <button type="button" aria-label="Minimize live feed" className="btn btn-ghost size-7 p-0" onClick={() => setOpen(false)}><Minimize2 className="size-4" /></button>
        <button type="button" aria-label="Close live feed" className="btn btn-ghost size-7 p-0" onClick={onClose}><X className="size-4" /></button>
      </header>

      <div className="relative aspect-video overflow-hidden bg-[#33362d]">
        <div className={cn('absolute inset-0 opacity-70', camera === 'THERMAL' ? 'bg-[radial-gradient(circle_at_62%_44%,#d69b4d_0,#7e5b43_18%,#303a3a_47%,#1b2429_100%)]' : 'bg-[linear-gradient(135deg,#56636a,#263137_52%,#11191d)]')} />
        <div className="absolute inset-0 opacity-20 [background:repeating-linear-gradient(0deg,transparent_0,transparent_3px,#d5e0d2_4px)]" />
        <div className="absolute left-3 top-3 border border-white/40 bg-black/40 px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-white">{camera} · 1280×720</div>
        <div className="absolute right-3 top-3 font-mono text-[10px] text-white/80">14:21:16 Z</div>
        {feedState === 'buffering' && <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[12px] font-medium text-caution">BUFFERING · SIGNAL DEGRADED</div>}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 font-mono text-[11px] text-white/80"><ScanLine className="size-3.5" /> ALT {Math.round(drone.reported.altitude)}m · {Math.round(drone.reported.groundspeed)} m/s</div>
      </div>

      <div className="flex items-center gap-1 border-b border-line bg-bg px-2 py-1.5">
        {CAMERAS.map((item) => <button key={item} type="button" aria-pressed={camera === item} onClick={() => setCamera(item)} className={cn('px-2 py-1 font-mono text-[10px] tracking-[0.1em]', camera === item ? 'bg-select text-ink' : 'text-fg-muted hover:bg-raised hover:text-fg')}>{item}</button>)}
        <span className="ml-auto font-mono text-[10px] text-fg-subtle">{feedState === 'live' ? 'RTSP · 240 ms' : 'RECONNECTING'}</span>
      </div>

      <footer className="flex items-center gap-1 px-2 py-2">
        <button type="button" className="btn h-8 px-2 text-[11px]" onClick={() => setFeedState((state) => state === 'live' ? 'buffering' : 'live')}><CameraOff className="size-3.5" /> Snapshot</button>
        <button type="button" aria-label={muted ? 'Unmute feed' : 'Mute feed'} className="btn btn-ghost size-8 p-0" onClick={() => setMuted(!muted)}>{muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button>
        <button type="button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} className="btn btn-ghost ml-auto size-8 p-0" onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
      </footer>
    </section>
  )
}

export function FeedLauncher({ drone, onOpen }: { drone: Drone; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="btn h-8 gap-1.5 border-select px-2 text-[11px] text-select"><Camera className="size-3.5" /> Watch live</button>
}
