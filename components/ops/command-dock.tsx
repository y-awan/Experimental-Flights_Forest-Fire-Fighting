'use client'

import { useRef, useState } from 'react'
import { clockAt } from '@/lib/mission/data'
import { interpret } from '@/lib/mission/interpret'
import type { MissionEvent, Selection } from '@/lib/mission/types'
import { cn } from '@/lib/utils'
import { Flag } from './glyph'
import { useDispatch, useMission } from './store'

const EXAMPLE = 'Keep Drone 1 surveying and send Drone 3 to investigate the detection.'

function targetToSelection(e: MissionEvent): Selection | null {
  if (e.target.type === 'drone') return { type: 'drone', id: e.target.id }
  if (e.target.type === 'detection') return { type: 'detection' }
  return null
}

function SeverityMark({ severity }: { severity: MissionEvent['severity'] }) {
  if (severity === 'critical') return <Flag kind="critical" />
  if (severity === 'warning') return <Flag kind="caution" />
  if (severity === 'operator')
    return (
      <span aria-hidden="true" className="w-[11px] text-center font-mono text-[11px] font-bold text-select">
        {'›'}
      </span>
    )
  return <span aria-hidden="true" className="mx-[3.5px] size-1 rounded-full bg-fg-subtle" />
}

function EventRow({ e }: { e: MissionEvent }) {
  const dispatch = useDispatch()
  const sel = targetToSelection(e)
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (sel) dispatch({ type: 'select', selection: sel })
          else if (e.target.type === 'sector') dispatch({ type: 'focus', focus: { kind: 'fit' } })
        }}
        className="flex w-full items-center gap-2.5 px-4 py-[3px] text-left text-[12px] hover:bg-raised"
      >
        <span className="w-[58px] shrink-0 font-mono text-fg-subtle">{clockAt(e.t)}</span>
        <SeverityMark severity={e.severity} />
        <span
          className={cn(
            'truncate',
            e.severity === 'critical' && 'text-critical',
            e.severity === 'warning' && 'text-caution',
            e.severity === 'operator' && 'text-fg',
            e.severity === 'info' && 'text-fg-muted',
          )}
        >
          {e.text}
        </span>
      </button>
    </li>
  )
}

export function CommandDock() {
  const state = useMission()
  const dispatch = useDispatch()
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const events = [...state.events].reverse()
  const latest = events[0]
  const text = state.composer

  const submit = () => {
    if (!text.trim()) return
    dispatch({ type: 'setProposal', proposal: interpret(text.trim(), state) })
  }

  return (
    <div className="shrink-0 border-t border-line bg-surface">
      <div className="flex items-center border-b border-line">
        <button
          type="button"
          aria-expanded={state.timelineOpen}
          aria-controls="event-log"
          onClick={() => dispatch({ type: 'toggleTimeline' })}
          className="flex h-8 shrink-0 items-center gap-2 border-r border-line px-4 text-[12px] font-medium text-fg hover:bg-raised"
        >
          <span aria-hidden="true" className="font-mono text-fg-subtle">
            {state.timelineOpen ? '▾' : '▸'}
          </span>
          Event log
          <span className="font-mono text-fg-subtle">{state.events.length}</span>
        </button>
        {!state.timelineOpen && latest && (
          <ul className="min-w-0 flex-1">
            <EventRow e={latest} />
          </ul>
        )}
      </div>
      {state.timelineOpen && (
        <ul id="event-log" className="max-h-44 overflow-y-auto border-b border-line py-1">
          {events.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </ul>
      )}
      <form
        className="relative flex items-center gap-3 px-4 py-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor="fleet-command" className="label shrink-0">
          Fleet command
        </label>
        <input
          ref={inputRef}
          id="fleet-command"
          value={text}
          onChange={(e) => dispatch({ type: 'setComposer', text: e.target.value })}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
          }}
          placeholder="Describe what the fleet should do, e.g. “Return Drone 1 home”"
          autoComplete="off"
          className="h-8 min-w-0 flex-1 border-b border-line-strong bg-transparent px-1 text-[14px] text-fg outline-none placeholder:text-fg-subtle focus:border-select"
        />
        {!text && (
          <button
            type="button"
            className={cn('btn btn-ghost h-7 shrink-0 px-2 text-[12px]', !focused && 'hidden xl:inline-flex')}
            onClick={() => {
              dispatch({ type: 'setComposer', text: EXAMPLE })
              inputRef.current?.focus()
            }}
          >
            Use example
          </button>
        )}
        <button type="submit" className="btn shrink-0" disabled={!text.trim()}>
          Review plan
        </button>
        <span className="hidden shrink-0 text-[11px] text-fg-subtle 2xl:inline">Nothing is sent until you approve</span>
      </form>
    </div>
  )
}
