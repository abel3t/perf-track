import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Clock, Flame, Trash2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { completeActivity, skipActivity, deleteActivity } from '#/server/activities'
import { calculateScore, formatScore } from '#/lib/score'

interface Occurrence {
  activity: {
    id: string
    title: string
    color: string
    multiplier: number
    plannedDuration: number
    type: 'event' | 'task'
  }
  log: {
    status: 'pending' | 'completed' | 'skipped'
    actualDuration: number | null
    onTime: boolean | null
    score: number | null
  } | null
  streak: { currentStreak: number; consecutiveSkips: number } | null
  scheduledDate: string
  scheduledStart: string
  scheduledEnd: string
}

interface Props {
  occurrence: Occurrence
  open: boolean
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
}

export default function TrackModal({ occurrence, open, onClose, onSaved, onDelete }: Props) {
  const { activity, log, streak } = occurrence
  const alreadyDone = log?.status === 'completed'

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [actualDuration, setActualDuration] = useState(
    log?.actualDuration ?? activity.plannedDuration,
  )
  const [onTime, setOnTime] = useState(log?.onTime ?? true)
  const [notes, setNotes] = useState('')

  const currentStreak = streak?.currentStreak ?? 0
  const consecutiveSkips = streak?.consecutiveSkips ?? 0

  const previewScore = calculateScore({
    actualDuration,
    multiplier: activity.multiplier,
    onTime,
    currentStreak,
    consecutiveSkips,
  })

  const remove = useMutation({
    mutationFn: () => deleteActivity({ data: { id: activity.id } }),
    onSuccess: () => { onClose(); onDelete?.() },
  })

  const complete = useMutation({
    mutationFn: () =>
      completeActivity({
        data: {
          activityId: activity.id,
          scheduledDate: occurrence.scheduledDate,
          scheduledStart: occurrence.scheduledStart,
          scheduledEnd: occurrence.scheduledEnd,
          actualDuration,
          onTime,
          notes: notes || undefined,
        },
      }),
    onSuccess: onSaved,
  })

  const skip = useMutation({
    mutationFn: () =>
      skipActivity({
        data: {
          activityId: activity.id,
          scheduledDate: occurrence.scheduledDate,
          scheduledStart: occurrence.scheduledStart,
          scheduledEnd: occurrence.scheduledEnd,
        },
      }),
    onSuccess: onSaved,
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl px-5" showCloseButton={false}>
        {/* Toolbar — Google Calendar style: icons top-right, no absolute overlap */}
        <div className="flex items-center justify-end gap-1 -mt-1 -mr-1">
          {deleteConfirm ? (
            <>
              <span className="text-xs text-[var(--sea-ink-soft)] mr-1">Delete?</span>
              <button
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                {remove.isPending ? '…' : 'Yes'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--line)] text-[var(--sea-ink-soft)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="p-1.5 rounded-lg hover:bg-[var(--line)] text-[var(--sea-ink-soft)] hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--line)] text-[var(--sea-ink-soft)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>

        <DialogHeader className="-mt-2">
          <DialogTitle className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: activity.color }}
            />
            {activity.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Info row */}
          <div className="flex gap-3 text-sm text-[var(--sea-ink-soft)]">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {activity.plannedDuration}m planned
            </span>
            <span className="font-bold" style={{ color: activity.color }}>
              x{activity.multiplier}
            </span>
            {currentStreak > 0 && (
              <span className="flex items-center gap-1 text-orange-500">
                <Flame size={14} />
                {currentStreak} streak
              </span>
            )}
          </div>

          {/* On time toggle */}
          <div className="space-y-1.5">
            <Label>On time?</Label>
            <div className="flex rounded-xl overflow-hidden border border-[var(--line)]">
              <button
                onClick={() => setOnTime(true)}
                className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                  onTime ? 'bg-emerald-500 text-white' : 'text-[var(--sea-ink-soft)]'
                }`}
              >
                <CheckCircle2 size={16} /> Yes
              </button>
              <button
                onClick={() => setOnTime(false)}
                className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                  !onTime ? 'bg-red-400 text-white' : 'text-[var(--sea-ink-soft)]'
                }`}
              >
                <XCircle size={16} /> Late
              </button>
            </div>
          </div>

          {/* Actual duration */}
          <div className="space-y-1.5">
            <Label>Actual duration (minutes)</Label>
            <Input
              type="number"
              min={1}
              value={actualDuration}
              onChange={(e) => setActualDuration(Number(e.target.value))}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="How did it go?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Score preview */}
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: `${activity.color}18`, border: `1px solid ${activity.color}30` }}
          >
            <p className="text-xs text-[var(--sea-ink-soft)] mb-0.5">Score preview</p>
            <p className="text-2xl font-bold" style={{ color: activity.color }}>
              {formatScore(previewScore)} <span className="text-sm font-normal">PP</span>
            </p>
            <p className="text-[10px] text-[var(--sea-ink-soft)] mt-0.5">
              {actualDuration}m × x{activity.multiplier} × {onTime ? '1.1' : '0.9'} × {Math.min(1 + currentStreak * 0.01, 1.4).toFixed(2)}
              {consecutiveSkips > 0 && ` × ${Math.max(0.5, 1 - (consecutiveSkips - 1) * 0.1).toFixed(1)} skip`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 text-red-500 border-red-200"
              onClick={() => skip.mutate()}
              disabled={skip.isPending || complete.isPending}
            >
              {skip.isPending ? '…' : 'Skip'}
            </Button>
            <Button
              className="flex-1 bg-[var(--lagoon-deep)] text-white hover:bg-[var(--lagoon-deep)]/90"
              onClick={() => complete.mutate()}
              disabled={complete.isPending || skip.isPending}
            >
              {complete.isPending ? 'Saving…' : alreadyDone ? 'Update' : 'Complete'}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
