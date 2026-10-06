'use client'

import { cn } from '@/lib/utils'
import { CommandDock } from './command-dock'
import { DetectionBar } from './detection-bar'
import { FleetRail } from './fleet-rail'
import { MapStage } from './map-stage'
import { MobileViewProvider, useMobileView } from './mobile-view'
import { TopBar } from './top-bar'

function Workspace() {
  const { panel } = useMobileView()
  return (
    <main className="relative grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
      <FleetRail className={cn(panel === 'fleet' ? 'absolute inset-0 z-[800] flex' : 'hidden', 'lg:static lg:z-auto lg:flex')} />
      <MapStage />
    </main>
  )
}

/** Responsive app frame. Desktop: rail + map grid. Mobile: full-bleed map with an on-demand fleet panel. */
export function OpsShell() {
  return (
    <MobileViewProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
        <TopBar />
        <DetectionBar />
        <Workspace />
        <CommandDock />
      </div>
    </MobileViewProvider>
  )
}
