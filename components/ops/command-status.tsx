'use client'

import { Check, X } from 'lucide-react'
import { clockAt } from '@/lib/mission/data'
import type { Command, CommandStage } from '@/lib/mission/types'
import { cn } from '@/lib/utils'
import { useDispatch, useMission } from './store'

const STAGES: { id: Exclude<CommandStage, 'failed'>; label: string; meaning: string }[] = [
  { id: 'proposed', label: 'Proposed', meaning: 'Approved by operator, queued at ground station' },
  { id: 'sent', label: 'Sent', meaning: 'Transmitted — not yet accepted by the aircraft' },
  { id: 'acknowledged', label: 'Acknowledged', meaning: 'Aircraft accepted the command' },
  { id: 'executing', label: 'Executing', meaning: 'Aircraft changed flight mode' },
  { id: 'completed', label: 'Completed', meaning: 'Outcome reached' },
]

const ORDER: Record<CommandStage, number> = { proposed: 0, sent: 1, acknowledged: 2, executing: 3, completed: 4, failed: -1 }

function reachedIndex(cmd: Command) {
  if (cmd.stage !== 'failed') return ORDER[cmd.stage]
  let idx = 0
  STAGES.forEach((s, i) => {
    if (cmd.stamps[s.id] !== undefined) idx = i
  })
  return idx
}

export function stageSummary(cmd: Command, droneName: string) {
  if (cmd.stage === 'failed') return cmd.failure?.startsWith('Superseded') ? 'Superseded' : 'Not acknowledged'
  if (cmd.stage === 'sent') return 'Sent · awaiting ACK'
  if (cmd.stage === 'acknowledged') return `Acknowledged by ${droneName}`
  return STAGES[ORDER[cmd.stage]].label
}

export function CommandCompact({ cmd, droneName }: { cmd: Command; droneName: string }) {
  const failed = cmd.stage === 'failed'
  const superseded = failed && cmd.failure?.startsWith('Superseded')
  const pending = cmd.stage === 'proposed' || cmd.stage === 'sent'
  return (
    <div className={cn('flex items-center gap-1.5 text-[12px]', failed && !superseded ? 'text-critical' : 'text-fg-muted')}>
      <span aria-hidden="true" className="font-mono text-fg-subtle">
        {'↳'}
      </span>
      <span className="font-medium text-fg">{cmd.label}</span>
      <span aria-hidden="true">{'·'}</span>
      <span className={cn(pending && 'italic', failed && !superseded && 'font-semibold')}>{stageSummary(cmd, droneName)}</span>
    </div>
  )
}

export function CommandLifecycle({ cmd, droneName }: { cmd: Command; droneName: string }) {
  const { elapsed, mode } = useMission()
  const dispatch = useDispatch()
  const reached = reachedIndex(cmd)
  const failed = cmd.stage === 'failed'
  const superseded = failed && cmd.failure?.startsWith('Superseded')
  const waiting = cmd.stage === 'sent' ? elapsed - (cmd.stamps.sent ?? elapsed) : 0

  return (
    <section aria-label={`Command ${cmd.label}`} className="border-l-2 border-select pl-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold">
          {cmd.label} <span className="font-normal text-fg-muted">{'→ '}{droneName}</span>
        </h3>
        <span className="font-mono text-[11px] text-fg-subtle">{mode === 'simulation' ? 'SITL' : 'RF'}</span>
      </div>
      <ol className="mt-2 flex flex-col">
        {STAGES.map((s, i) => {
          const done = i < reached || (i === reached && cmd.stage === 'completed')
          const current = i === reached && !failed && cmd.stage !== 'completed'
          const failedHere = failed && i === reached + 1 && !superseded
          const stamp = cmd.stamps[s.id]
          return (
            <li key={s.id} className="relative flex items-center gap-2.5 py-[3px]">
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4 items-center justify-center rounded-full border',
                  done && 'border-ok bg-ok text-ink',
                  current && 'border-select bg-select/20',
                  failedHere && 'border-critical bg-critical text-ink',
                  !done && !current && !failedHere && 'border-line-strong',
                )}
              >
                {done && <Check className="size-3" strokeWidth={3} />}
                {failedHere && <X className="size-3" strokeWidth={3} />}
                {current && <span className="size-1.5 animate-pulse rounded-full bg-select" />}
              </span>
              <span
                className={cn(
                  'text-[13px]',
                  done && 'text-fg',
                  current && 'font-semibold text-fg',
                  failedHere && 'font-semibold text-critical',
                  !done && !current && !failedHere && 'text-fg-subtle',
                )}
              >
                {failedHere ? 'No acknowledgement' : s.label}
              </span>
              <span className="ml-auto font-mono text-[12px] text-fg-subtle">
                {stamp !== undefined ? clockAt(stamp) : current && s.id === 'sent' ? `${waiting.toFixed(1)} s` : ''}
              </span>
            </li>
          )
        })}
      </ol>
      <p className={cn('mt-1.5 text-[12px] leading-snug', failed && !superseded ? 'text-critical' : 'text-fg-muted')}>
        {failed
          ? cmd.failure
          : cmd.stage === 'completed'
            ? 'Outcome confirmed by telemetry.'
            : STAGES[Math.min(reached + (cmd.stage === 'proposed' ? 0 : 0), 4)].meaning + '.'}
      </p>
      {failed && !superseded && (
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn" onClick={() => dispatch({ type: 'retryCommand', id: cmd.id })}>
            Retry command
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'clearCommand', id: cmd.id })}>
            Clear
          </button>
        </div>
      )}
    </section>
  )
}
