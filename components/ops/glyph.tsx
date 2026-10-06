import { cn } from '@/lib/utils'
import { flagSvg, glyphSvg, type GlyphOpts } from '@/lib/mission/glyph'
import type { Health } from '@/lib/mission/derive'

export function DroneGlyph({ className, ...opts }: GlyphOpts & { className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0', className)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: glyphSvg(opts) }}
    />
  )
}

export function Flag({ kind, className }: { kind: 'caution' | 'critical' | 'stale'; className?: string }) {
  return <span className={cn('inline-flex shrink-0', className)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: flagSvg(kind) }} />
}

export function HealthTag({ health }: { health: Health }) {
  if (health.linkLost || health.level === 'critical')
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-critical px-1.5 py-px text-[12px] font-semibold text-ink">
        <Flag kind="critical" />
        {health.linkLost ? 'Link lost' : 'Critical'}
      </span>
    )
  if (health.stale)
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-dashed border-fg px-1.5 text-[12px] font-semibold text-fg">
        <Flag kind="stale" />
        Stale
      </span>
    )
  if (health.level === 'caution')
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-caution">
        <Flag kind="caution" />
        Caution
      </span>
    )
  return null
}
