import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Slider } from '#/components/ui/slider'
import { Calendar } from '#/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { createActivity, updateActivity } from '#/server/activities'
import type { Activity } from '#/db/schema'
import ResponsiveModal from '#/components/ResponsiveModal'

const COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#14B8A6', '#6366F1',
]

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'One time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
]

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_VALUES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

interface Props {
  open: boolean
  onClose: () => void
  defaultDate: string
  prefillTime?: string
  prefillDuration?: number
  onSaved: () => void
  activity?: Activity
}

export default function ActivityFormSheet({
  open, onClose, defaultDate, prefillTime, prefillDuration, onSaved, activity,
}: Props) {
  const isEdit = !!activity

  const [title, setTitle] = useState(activity?.title ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [type, setType] = useState<'event' | 'task'>(activity?.type ?? 'task')
  const [multiplier, setMultiplier] = useState(activity?.multiplier ?? 5)
  const [startTime, setStartTime] = useState(activity?.startTime ?? prefillTime ?? '08:00')
  const [plannedDuration, setPlannedDuration] = useState(activity?.plannedDuration ?? prefillDuration ?? 30)
  const [color, setColor] = useState(activity?.color ?? COLORS[0])
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    activity?.reminderMinutes ?? null,
  )
  const [startDate, setStartDate] = useState<Date>(
    activity?.startDate ? parseISO(activity.startDate) : parseISO(defaultDate),
  )
  const [endDate, setEndDate] = useState<Date | undefined>(
    activity?.endDate ? parseISO(activity.endDate) : undefined,
  )
  const [recurrence, setRecurrence] = useState<string>(
    activity ? (activity.recurrenceType === 'once' ? 'once' : 'daily') : 'once',
  )
  const [customDays, setCustomDays] = useState<string[]>(['MO'])

  function buildRrule(): string | undefined {
    if (recurrence === 'once') return undefined
    if (recurrence === 'daily') return 'FREQ=DAILY'
    if (recurrence === 'weekdays') return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    if (recurrence === 'weekly') {
      const day = DAY_VALUES[startDate.getDay()]
      return `FREQ=WEEKLY;BYDAY=${day}`
    }
    if (recurrence === 'custom') return `FREQ=WEEKLY;BYDAY=${customDays.join(',')}`
    return undefined
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description: description || null,
        type,
        multiplier,
        startTime,
        plannedDuration,
        color,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        recurrenceType: recurrence === 'once' ? ('once' as const) : ('recurring' as const),
        rrule: buildRrule() ?? null,
        reminderMinutes: reminderMinutes ?? null,
      }
      if (isEdit && activity) return updateActivity({ data: { id: activity.id, ...payload } })
      return createActivity({ data: payload })
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  function toggleCustomDay(day: string) {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  const footer = (
    <div className="space-y-2">
      {save.isError && (
        <p className="text-sm text-red-500 text-center">{(save.error as Error).message}</p>
      )}
      <Button
        className="w-full"
        onClick={() => save.mutate()}
        disabled={!title || save.isPending}
      >
        {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create activity'}
      </Button>
    </div>
  )

  return (
    <ResponsiveModal open={open} onClose={onClose} title={isEdit ? 'Edit activity' : 'New activity'} footer={footer}>
      <div className="space-y-5">

        {/* Type toggle */}
        <div className="flex rounded-xl overflow-hidden border border-[var(--line)]">
          {(['task', 'event'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 text-sm font-semibold capitalize transition-colors cursor-pointer ${
                type === t ? 'bg-[var(--lagoon-deep)] text-white' : 'text-[var(--sea-ink-soft)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input
            placeholder="e.g. Morning workout"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label>Description <span className="text-[var(--sea-ink-soft)] font-normal">(optional)</span></Label>
          <Textarea
            placeholder="Notes…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        {/* Multiplier */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Importance</Label>
            <span className="text-lg font-bold text-[var(--lagoon-deep)]">×{multiplier}</span>
          </div>
          <Slider
            min={1} max={10} step={1}
            value={[multiplier]}
            onValueChange={([v]) => setMultiplier(v)}
          />
          <div className="flex justify-between text-[10px] text-[var(--sea-ink-soft)]">
            <span>×1 low</span>
            <span>×10 critical</span>
          </div>
        </div>

        {/* Time + Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Start time</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Duration (min)</Label>
            <Input
              type="number" min={1}
              value={plannedDuration}
              onChange={(e) => setPlannedDuration(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Reminder */}
        <div className="space-y-2">
          <Label>Remind me before</Label>
          <div className="flex gap-2 flex-wrap">
            {([null, 5, 10, 15, 30, 60] as (number | null)[]).map((mins) => (
              <button
                key={mins ?? 'none'}
                type="button"
                onClick={() => setReminderMinutes(mins)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                  reminderMinutes === mins
                    ? 'border-[var(--lagoon-deep)] bg-[var(--lagoon-deep)] text-white'
                    : 'border-[var(--line)] text-[var(--sea-ink-soft)]'
                }`}
              >
                {mins === null ? 'Off' : `${mins} min`}
              </button>
            ))}
          </div>
        </div>

        {/* Start date */}
        <div className="space-y-1.5">
          <Label>Start date</Label>
          <DatePicker value={startDate} onChange={(d) => d && setStartDate(d)} />
        </div>

        {/* Recurrence */}
        <div className="space-y-2">
          <Label>Repeat</Label>
          <div className="grid grid-cols-3 gap-2">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRecurrence(opt.value)}
                className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                  recurrence === opt.value
                    ? 'border-[var(--lagoon-deep)] bg-[var(--lagoon-deep)] text-white'
                    : 'border-[var(--line)] text-[var(--sea-ink-soft)] hover:border-[var(--lagoon-deep)]/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {recurrence === 'custom' && (
            <div className="flex gap-1.5 mt-2">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={DAY_VALUES[i]}
                  onClick={() => toggleCustomDay(DAY_VALUES[i])}
                  className={`flex-1 aspect-square rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    customDays.includes(DAY_VALUES[i])
                      ? 'bg-[var(--lagoon-deep)] text-white border-[var(--lagoon-deep)]'
                      : 'border-[var(--line)] text-[var(--sea-ink-soft)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {recurrence !== 'once' && (
            <div className="space-y-1.5 pt-1">
              <Label>End date <span className="text-[var(--sea-ink-soft)] font-normal">(optional)</span></Label>
              <DatePicker value={endDate} onChange={setEndDate} placeholder="No end date" />
            </div>
          )}
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full transition-transform active:scale-90 cursor-pointer"
                style={{
                  background: c,
                  outline: color === c ? `3px solid ${c}` : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

      </div>
    </ResponsiveModal>
  )
}

// ── Date picker ────────────────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
}: {
  value: Date | undefined
  onChange: (d: Date | undefined) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-full flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-transparent text-sm text-left transition-colors hover:bg-accent cursor-pointer ${
            !value ? 'text-muted-foreground' : 'text-[var(--sea-ink)]'
          }`}
        >
          <CalendarIcon size={15} className="shrink-0 text-muted-foreground" />
          <span className="flex-1">{value ? format(value, 'MMM d, yyyy') : placeholder}</span>
          {value && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(undefined) }}
              className="text-muted-foreground hover:text-foreground text-xs px-1 cursor-pointer"
            >
              ×
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => { onChange(d as Date | undefined); setOpen(false) }}
        />
      </PopoverContent>
    </Popover>
  )
}
