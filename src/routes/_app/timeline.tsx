import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useCallback } from 'react'
import {
  format, addDays, subDays, startOfWeek, endOfWeek,
  isToday, parseISO, addWeeks, subWeeks,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { z } from 'zod'

import { getDayOccurrences, getWeekOccurrences } from '#/server/activities'
import ActivityBlock from '#/components/ActivityBlock'
import ActivityFormSheet from '#/components/ActivityFormSheet'
import TrackModal from '#/components/TrackModal'

export const Route = createFileRoute('/_app/timeline')({
  validateSearch: z.object({
    create: z.boolean().optional(),
    prefillDate: z.string().optional(),
    prefillTime: z.string().optional(),
    prefillDuration: z.number().optional(),
    view: z.enum(['day', 'week']).optional(),
  }),
  component: TimelinePage,
})

const HOUR_HEIGHT = 64
const START_HOUR = 5
const END_HOUR = 24
const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT
const SNAP_MINUTES = 15
const MIN_DRAG_PX = 16 // minimum drag to count as intentional

function TimelinePage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qc = useQueryClient()

  const view = search.view ?? 'day'
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [trackingOccurrence, setTrackingOccurrence] = useState<any>(null)

  const showForm = search.create === true
  const dateStr = format(currentDate, 'yyyy-MM-dd')

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  function openCreate(prefill?: { date: string; time: string; duration: number }) {
    navigate({
      search: (s) => ({
        ...s,
        create: true,
        prefillDate: prefill?.date,
        prefillTime: prefill?.time,
        prefillDuration: prefill?.duration,
      }),
    })
  }

  function closeCreate() {
    navigate({ search: (s) => ({ ...s, create: undefined, prefillDate: undefined, prefillTime: undefined, prefillDuration: undefined }) })
  }

  const { data: dayOccurrences = [] } = useQuery({
    queryKey: ['day-occurrences', dateStr],
    queryFn: () => getDayOccurrences({ data: { date: dateStr } }),
    enabled: view === 'day',
  })

  const { data: weekOccurrences = {} } = useQuery({
    queryKey: ['week-occurrences', weekStartStr],
    queryFn: () => getWeekOccurrences({ data: { from: weekStartStr, to: weekEndStr } }),
    enabled: view === 'week',
  })

  function setView(v: 'day' | 'week') {
    navigate({ search: (s) => ({ ...s, view: v }) })
  }

  function prevPeriod() {
    setCurrentDate(view === 'week' ? subWeeks(currentDate, 1) : subDays(currentDate, 1))
  }
  function nextPeriod() {
    setCurrentDate(view === 'week' ? addWeeks(currentDate, 1) : addDays(currentDate, 1))
  }

  function getBlockStyle(scheduledStart: string, plannedDuration: number) {
    const d = parseISO(scheduledStart)
    const top = ((d.getHours() * 60 + d.getMinutes() - START_HOUR * 60) / 60) * HOUR_HEIGHT
    const height = Math.max((plannedDuration / 60) * HOUR_HEIGHT, 24)
    return { top, height }
  }

  const headerLabel = view === 'week'
    ? `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`
    : format(currentDate, 'MMM d, yyyy')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['day-occurrences', dateStr] })
    qc.invalidateQueries({ queryKey: ['week-occurrences', weekStartStr] })
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────── */}
      <div
        className="shrink-0 z-10 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--line)] px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="relative flex items-center py-3">
          <button onClick={prevPeriod} className="p-2 rounded-full hover:bg-[var(--line)] transition-colors">
            <ChevronLeft size={20} />
          </button>

          {/* Geometrically centered regardless of button widths on either side */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
            <p className={`text-xs font-semibold uppercase tracking-widest text-[var(--sea-ink-soft)] ${view === 'week' ? 'invisible' : ''}`}>
              {format(currentDate, 'EEEE')}
            </p>
            <p className="text-base font-bold text-[var(--sea-ink)] leading-tight">
              {headerLabel}
              {view === 'day' && isToday(currentDate) && (
                <span className="ml-1.5 text-sm font-semibold text-[var(--lagoon-deep)]">(Today)</span>
              )}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={nextPeriod} className="p-2 rounded-full hover:bg-[var(--line)] transition-colors">
              <ChevronRight size={20} />
            </button>
            <div className="hidden md:flex items-center rounded-lg border border-[var(--line)] overflow-hidden">
              {(['day', 'week'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    view === v ? 'bg-[var(--lagoon-deep)] text-white' : 'text-[var(--sea-ink-soft)] hover:bg-[var(--line)]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline content ────────────────────── */}
      {view === 'day' ? (
        <DayView
          occurrences={dayOccurrences}
          currentDate={currentDate}
          dateStr={dateStr}
          onClickOccurrence={setTrackingOccurrence}
          onDragCreate={openCreate}
          getBlockStyle={getBlockStyle}
        />
      ) : (
        <WeekView
          weekStart={weekStart}
          occurrencesByDate={weekOccurrences}
          onClickOccurrence={setTrackingOccurrence}
          onDragCreate={openCreate}
          getBlockStyle={getBlockStyle}
        />
      )}

      {/* ── FAB ── visible on both mobile and desktop */}
      <button
        onClick={() => openCreate()}
        className="fixed z-40 bottom-20 md:bottom-6 right-5 w-14 h-14 rounded-full bg-[var(--lagoon-deep)] text-white shadow-lg flex items-center justify-center active:scale-95 hover:opacity-90 transition-all"
      >
        <Plus size={26} strokeWidth={2} />
      </button>

      <ActivityFormSheet
        key={`${search.prefillTime ?? ''}-${search.prefillDuration ?? 0}`}
        open={showForm}
        onClose={closeCreate}
        defaultDate={search.prefillDate ?? dateStr}
        prefillTime={search.prefillTime}
        prefillDuration={search.prefillDuration}
        onSaved={() => { invalidate(); closeCreate() }}
      />

      {trackingOccurrence && (
        <TrackModal
          occurrence={trackingOccurrence}
          open={!!trackingOccurrence}
          onClose={() => setTrackingOccurrence(null)}
          onSaved={() => { invalidate(); setTrackingOccurrence(null) }}
        />
      )}
    </div>
  )
}

// ── Drag hook ──────────────────────────────────────────────────────────────────

function useDragCreate(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  dateStr: string,
  onDragCreate: (p: { date: string; time: string; duration: number }) => void,
) {
  const drag = useRef<{ startY: number; startMinutes: number } | null>(null)
  const [ghost, setGhost] = useState<{ top: number; height: number } | null>(null)

  function yToMinutes(clientY: number): number {
    const el = scrollRef.current!
    const rect = el.getBoundingClientRect()
    const offsetY = clientY - rect.top + el.scrollTop - 12 // 12 = pt-3
    const rawMin = (offsetY / HOUR_HEIGHT) * 60 + START_HOUR * 60
    return Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES
  }

  function minutesToPx(minutes: number) {
    return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    // Ignore clicks on activity blocks
    if ((e.target as HTMLElement).closest('[data-activity-block]')) return
    const startMinutes = yToMinutes(e.clientY)
    drag.current = { startY: e.clientY, startMinutes }

    function onMove(ev: MouseEvent) {
      if (!drag.current) return
      const dy = Math.abs(ev.clientY - drag.current.startY)
      if (dy < MIN_DRAG_PX) return
      const endMinutes = yToMinutes(ev.clientY)
      const top = minutesToPx(Math.min(drag.current.startMinutes, endMinutes))
      const height = Math.max(
        Math.abs(endMinutes - drag.current.startMinutes) / 60 * HOUR_HEIGHT,
        HOUR_HEIGHT / 4,
      )
      setGhost({ top, height })
    }

    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!drag.current) return
      const dy = Math.abs(ev.clientY - drag.current.startY)
      if (dy >= MIN_DRAG_PX) {
        const endMinutes = yToMinutes(ev.clientY)
        const startMin = Math.min(drag.current.startMinutes, endMinutes)
        const duration = Math.max(Math.abs(endMinutes - drag.current.startMinutes), SNAP_MINUTES)
        const hh = String(Math.floor(startMin / 60)).padStart(2, '0')
        const mm = String(startMin % 60).padStart(2, '0')
        onDragCreate({ date: dateStr, time: `${hh}:${mm}`, duration })
      }
      drag.current = null
      setGhost(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [dateStr, onDragCreate])

  return { ghost, onMouseDown }
}

// ── Day view ───────────────────────────────────────────────────────────────────

function DayView({ occurrences, currentDate, dateStr, onClickOccurrence, onDragCreate, getBlockStyle }: {
  occurrences: any[]
  currentDate: Date
  dateStr: string
  onClickOccurrence: (occ: any) => void
  onDragCreate: (p: { date: string; time: string; duration: number }) => void
  getBlockStyle: (start: string, duration: number) => { top: number; height: number }
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { ghost, onMouseDown } = useDragCreate(scrollRef, dateStr, onDragCreate)

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 pt-3 pb-6 select-none">
      <div className="relative flex" style={{ height: totalHeight }}>
        <HourLabels />
        <div
          className="flex-1 relative border-l border-[var(--line)] cursor-crosshair"
          onMouseDown={onMouseDown}
        >
          <GridLines />
          {isToday(currentDate) && <NowIndicator />}

          {/* Drag ghost */}
          {ghost && (
            <div
              className="absolute left-1 right-2 rounded-lg pointer-events-none z-30"
              style={{
                top: ghost.top,
                height: ghost.height,
                background: 'var(--lagoon-deep)',
                opacity: 0.25,
                border: '2px solid var(--lagoon-deep)',
              }}
            />
          )}

          {occurrences.map((occ) => {
            const { top, height } = getBlockStyle(occ.scheduledStart, occ.activity.plannedDuration)
            return (
              <div key={occ.activity.id} className="absolute left-1 right-2" style={{ top, height }}
                   data-activity-block>
                <ActivityBlock occurrence={occ} onClick={() => onClickOccurrence(occ)} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Week view ──────────────────────────────────────────────────────────────────

function WeekView({ weekStart, occurrencesByDate, onClickOccurrence, onDragCreate, getBlockStyle }: {
  weekStart: Date
  occurrencesByDate: Record<string, any[]>
  onClickOccurrence: (occ: any) => void
  onDragCreate: (p: { date: string; time: string; duration: number }) => void
  getBlockStyle: (start: string, duration: number) => { top: number; height: number }
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {/* Day header row */}
      <div className="shrink-0 flex border-b border-[var(--line)]">
        <div className="w-12 shrink-0" />
        {days.map((day) => (
          <div key={day.toISOString()} className="flex-1 text-center py-2 border-l border-[var(--line)]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              {format(day, 'EEE')}
            </p>
            <p className={`text-sm font-bold leading-tight ${isToday(day) ? 'text-[var(--lagoon-deep)]' : 'text-[var(--sea-ink)]'}`}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto min-h-0 pt-3 pb-6 select-none">
        <div className="relative flex" style={{ height: totalHeight }}>
          <HourLabels />
          <div className="flex-1 flex">
            {days.map((day) => {
              const ds = format(day, 'yyyy-MM-dd')
              const occs = occurrencesByDate[ds] ?? []
              return (
                <WeekDayColumn
                  key={ds}
                  day={day}
                  dateStr={ds}
                  occurrences={occs}
                  onClickOccurrence={onClickOccurrence}
                  onDragCreate={onDragCreate}
                  getBlockStyle={getBlockStyle}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function WeekDayColumn({ day, dateStr, occurrences, onClickOccurrence, onDragCreate, getBlockStyle }: {
  day: Date
  dateStr: string
  occurrences: any[]
  onClickOccurrence: (occ: any) => void
  onDragCreate: (p: { date: string; time: string; duration: number }) => void
  getBlockStyle: (start: string, duration: number) => { top: number; height: number }
}) {
  // Each column has its own scroll ref pointing to the shared parent —
  // we approximate by using the column's own bounding rect
  const colRef = useRef<HTMLDivElement>(null)

  function yToMinutesCol(clientY: number): number {
    // Walk up to find the scrolling ancestor
    let el: HTMLElement | null = colRef.current
    let scrollTop = 0
    while (el) {
      if (el.scrollTop > 0) { scrollTop = el.scrollTop; break }
      el = el.parentElement
    }
    const rect = colRef.current!.getBoundingClientRect()
    const offsetY = clientY - rect.top + scrollTop - 12
    const rawMin = (offsetY / HOUR_HEIGHT) * 60 + START_HOUR * 60
    return Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES
  }

  const dragRef = useRef<{ startY: number; startMinutes: number } | null>(null)
  const [ghost, setGhost] = useState<{ top: number; height: number } | null>(null)

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-activity-block]')) return
    const startMinutes = yToMinutesCol(e.clientY)
    dragRef.current = { startY: e.clientY, startMinutes }

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const dy = Math.abs(ev.clientY - dragRef.current.startY)
      if (dy < MIN_DRAG_PX) return
      const endMin = yToMinutesCol(ev.clientY)
      const top = ((Math.min(dragRef.current.startMinutes, endMin) - START_HOUR * 60) / 60) * HOUR_HEIGHT
      const height = Math.max(Math.abs(endMin - dragRef.current.startMinutes) / 60 * HOUR_HEIGHT, HOUR_HEIGHT / 4)
      setGhost({ top, height })
    }

    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!dragRef.current) return
      const dy = Math.abs(ev.clientY - dragRef.current.startY)
      if (dy >= MIN_DRAG_PX) {
        const endMin = yToMinutesCol(ev.clientY)
        const startMin = Math.min(dragRef.current.startMinutes, endMin)
        const duration = Math.max(Math.abs(endMin - dragRef.current.startMinutes), SNAP_MINUTES)
        const hh = String(Math.floor(startMin / 60)).padStart(2, '0')
        const mm = String(startMin % 60).padStart(2, '0')
        onDragCreate({ date: dateStr, time: `${hh}:${mm}`, duration })
      }
      dragRef.current = null
      setGhost(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={colRef}
      className="flex-1 relative border-l border-[var(--line)] cursor-crosshair"
      style={{ minWidth: 80 }}
      onMouseDown={onMouseDown}
    >
      <GridLines />
      {isToday(day) && <NowIndicator />}
      {isToday(day) && <div className="absolute inset-0 bg-[var(--lagoon-deep)]/[0.03] pointer-events-none" />}

      {ghost && (
        <div
          className="absolute left-0.5 right-0.5 rounded pointer-events-none z-30"
          style={{ top: ghost.top, height: ghost.height, background: 'var(--lagoon-deep)', opacity: 0.25, border: '2px solid var(--lagoon-deep)' }}
        />
      )}

      {occurrences.map((occ: any) => {
        const { top, height } = getBlockStyle(occ.scheduledStart, occ.activity.plannedDuration)
        return (
          <div key={occ.activity.id} className="absolute left-0.5 right-0.5" style={{ top, height }} data-activity-block>
            <ActivityBlock occurrence={occ} onClick={() => onClickOccurrence(occ)} compact />
          </div>
        )
      })}
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function HourLabels() {
  return (
    <div className="w-12 shrink-0 select-none">
      {hours.map((h) => (
        <div key={h} className="absolute flex items-start justify-end pr-2"
             style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 8, height: HOUR_HEIGHT, width: 48 }}>
          <span className="text-[10px] text-[var(--sea-ink-soft)] font-medium tabular-nums">
            {h === 0 ? '12' : h > 12 ? h - 12 : h}
            <span className="text-[8px]">{h >= 12 ? 'pm' : 'am'}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function GridLines() {
  return (
    <>
      {hours.map((h) => (
        <div key={h} className="absolute w-full border-t border-[var(--line)]"
             style={{ top: (h - START_HOUR) * HOUR_HEIGHT }} />
      ))}
      {/* Closing midnight line */}
      <div className="absolute w-full border-t border-[var(--line)]" style={{ top: totalHeight }} />
    </>
  )
}

function NowIndicator() {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60
  if (minutes < 0) return null
  return (
    <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
         style={{ top: (minutes / 60) * HOUR_HEIGHT }}>
      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
      <div className="flex-1 h-px bg-red-500" />
    </div>
  )
}
