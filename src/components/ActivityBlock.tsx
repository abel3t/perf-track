import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { formatScore } from '#/lib/score'

interface Occurrence {
  activity: {
    id: string
    title: string
    type: 'event' | 'task'
    color: string
    multiplier: number
    plannedDuration: number
  }
  log: {
    status: 'pending' | 'completed' | 'skipped'
    score: number | null
    actualDuration: number | null
    onTime: boolean | null
  } | null
  streak: { currentStreak: number } | null
  scheduledStart: string
  scheduledEnd: string
}

interface Props {
  occurrence: Occurrence
  onClick: () => void
  compact?: boolean
}

const STATUS_STYLES = {
  pending: 'opacity-100',
  completed: 'opacity-90',
  skipped: 'opacity-40',
}

export default function ActivityBlock({ occurrence, onClick, compact = false }: Props) {
  const { activity, log, streak } = occurrence
  const status = log?.status ?? 'pending'
  const isShort = activity.plannedDuration <= 20 || compact

  const bg = hexToRgba(activity.color, status === 'skipped' ? 0.15 : 0.18)
  const border = hexToRgba(activity.color, 0.5)

  return (
    <button
      onClick={onClick}
      className={`w-full h-full rounded-lg px-2 py-1 text-left flex flex-col justify-between overflow-hidden transition-all active:scale-[0.98] ${STATUS_STYLES[status]}`}
      style={{ background: bg, borderLeft: `3px solid ${activity.color}`, borderTop: `1px solid ${border}` }}
    >
      <div className="flex items-start justify-between gap-1 min-w-0">
        <span
          className="text-xs font-semibold leading-tight truncate"
          style={{ color: activity.color }}
        >
          {activity.title}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {/* Multiplier badge */}
          <span
            className="text-[9px] font-bold px-1 rounded"
            style={{ background: hexToRgba(activity.color, 0.25), color: activity.color }}
          >
            x{activity.multiplier}
          </span>

          {/* Status icon */}
          {status === 'completed' && <CheckCircle2 size={13} className="text-emerald-500" />}
          {status === 'skipped' && <XCircle size={13} className="text-red-400" />}
          {status === 'pending' && <Clock size={13} className="text-[var(--sea-ink-soft)]" />}
        </div>
      </div>

      {!isShort && (
        <div className="flex items-end justify-between mt-0.5">
          <span className="text-[10px] text-[var(--sea-ink-soft)]">
            {activity.plannedDuration}m
            {streak && streak.currentStreak > 0 && (
              <span className="ml-1">🔥{streak.currentStreak}</span>
            )}
          </span>

          {log?.score != null && (
            <span className="text-[10px] font-bold" style={{ color: activity.color }}>
              {formatScore(log.score)} PP
            </span>
          )}
        </div>
      )}
    </button>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
