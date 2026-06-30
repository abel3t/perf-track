import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNull, lte, gte, or } from 'drizzle-orm'
import { z } from 'zod'
import { rruleBetween } from '#/lib/recurrence'
import { addMinutes, parseISO } from 'date-fns'

import { Activities, ActivityLogs, ActivityStreaks } from '#/db/schema'
import { calculateScore } from '#/lib/score'
import { scheduleNextReminder, cancelReminder } from '#/server/push'

const getDb = async () => import('#/db').then((m) => m.db)

async function requireUser() {
  const [{ auth }, { getRequest }] = await Promise.all([
    import('#/lib/auth'),
    import('@tanstack/react-start/server'),
  ])
  const req = getRequest()
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

// ─── Shared input schemas ──────────────────────────────────────────────────────

const activityPayload = z.object({
  title: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  type: z.enum(['event', 'task']),
  multiplier: z.number().int().min(1).max(10),
  plannedDuration: z.number().int().min(1),
  color: z.string().default('#3B82F6'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  recurrenceType: z.enum(['once', 'recurring']),
  rrule: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  reminderMinutes: z.number().int().min(1).nullable().optional(),
})

// ─── List activities ───────────────────────────────────────────────────────────

export const listActivities = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [db, user] = await Promise.all([getDb(), requireUser()])
    return db
      .select()
      .from(Activities)
      .where(and(eq(Activities.userId, user.id), isNull(Activities.deletedAt)))
      .orderBy(Activities.startTime)
  },
)

// ─── Create activity ───────────────────────────────────────────────────────────

export const createActivity = createServerFn({ method: 'POST' })
  .validator(activityPayload)
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])
    const [activity] = await db
      .insert(Activities)
      .values({ ...data, userId: user.id })
      .returning()
    await db.insert(ActivityStreaks).values({
      activityId: activity.id,
      userId: user.id,
    })
    if (activity.reminderMinutes) {
      await scheduleNextReminder(activity)
    }
    return activity
  })

// ─── Update activity ───────────────────────────────────────────────────────────

export const updateActivity = createServerFn({ method: 'POST' })
  .validator(activityPayload.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])
    const { id, ...rest } = data

    const old = await db.query.Activities.findFirst({
      where: and(eq(Activities.id, id!), eq(Activities.userId, user.id)),
    })
    await cancelReminder(old?.qstashMessageId ?? null)

    const [updated] = await db
      .update(Activities)
      .set({ ...rest, updatedAt: new Date(), qstashMessageId: null })
      .where(and(eq(Activities.id, id!), eq(Activities.userId, user.id)))
      .returning()

    if (updated.reminderMinutes) {
      await scheduleNextReminder(updated)
    }
    return updated
  })

// ─── Delete activity (soft) ────────────────────────────────────────────────────

export const deleteActivity = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])
    const old = await db.query.Activities.findFirst({
      where: and(eq(Activities.id, data.id), eq(Activities.userId, user.id)),
    })
    await cancelReminder(old?.qstashMessageId ?? null)
    await db
      .update(Activities)
      .set({ deletedAt: new Date() })
      .where(and(eq(Activities.id, data.id), eq(Activities.userId, user.id)))
  })

// ─── Shared: build occurrences for one date ────────────────────────────────────

function buildOccurrencesForDate(
  dateStr: string,
  allActivities: (typeof Activities.$inferSelect)[],
  logsByDate: Map<string, Map<string, typeof ActivityLogs.$inferSelect>>,
  streaksByActivityId: Map<string, typeof ActivityStreaks.$inferSelect>,
) {
  const targetDate = parseISO(dateStr)

  const occurring = allActivities.filter((a) => {
    if (a.recurrenceType === 'once') return a.startDate === dateStr
    if (!a.rrule) return false
    const dayStart = new Date(
      Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
    )
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    return rruleBetween(a.rrule, dayStart, dayEnd).length > 0
  })

  const logsForDate = logsByDate.get(dateStr) ?? new Map()

  return occurring.map((activity) => {
    const [hh, mm] = activity.startTime.split(':').map(Number)
    // startTime is in GMT+7; shift to UTC for the ISO string the client will parseISO
    const scheduledStart = new Date(
      Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hh - 7, mm),
    )
    const scheduledEnd = addMinutes(scheduledStart, activity.plannedDuration)
    return {
      activity,
      log: logsForDate.get(activity.id) ?? null,
      streak: streaksByActivityId.get(activity.id) ?? null,
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      scheduledDate: dateStr,
    }
  })
}

// ─── Get occurrences for a single date ────────────────────────────────────────

export const getDayOccurrences = createServerFn({ method: 'GET' })
  .validator(z.object({ date: z.string() }))
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])

    const allActivities = await db
      .select()
      .from(Activities)
      .where(
        and(
          eq(Activities.userId, user.id),
          isNull(Activities.deletedAt),
          lte(Activities.startDate, data.date),
          or(isNull(Activities.endDate), gte(Activities.endDate, data.date)),
        ),
      )

    const logs = await db
      .select()
      .from(ActivityLogs)
      .where(and(eq(ActivityLogs.userId, user.id), eq(ActivityLogs.scheduledDate, data.date)))

    const logsByDate = new Map([[data.date, new Map(logs.map((l) => [l.activityId, l]))]])

    const streaks = await db.select().from(ActivityStreaks).where(eq(ActivityStreaks.userId, user.id))
    const streaksByActivityId = new Map(streaks.map((s) => [s.activityId, s]))

    return buildOccurrencesForDate(data.date, allActivities, logsByDate, streaksByActivityId)
  })

// ─── Get occurrences for a date range (week view) ─────────────────────────────

export const getWeekOccurrences = createServerFn({ method: 'GET' })
  .validator(z.object({ from: z.string(), to: z.string() }))
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])

    const allActivities = await db
      .select()
      .from(Activities)
      .where(
        and(
          eq(Activities.userId, user.id),
          isNull(Activities.deletedAt),
          lte(Activities.startDate, data.to),
          or(isNull(Activities.endDate), gte(Activities.endDate, data.from)),
        ),
      )

    const logs = await db
      .select()
      .from(ActivityLogs)
      .where(
        and(
          eq(ActivityLogs.userId, user.id),
          gte(ActivityLogs.scheduledDate, data.from),
          lte(ActivityLogs.scheduledDate, data.to),
        ),
      )

    // Group logs by date → activityId
    const logsByDate = new Map<string, Map<string, typeof ActivityLogs.$inferSelect>>()
    for (const log of logs) {
      if (!logsByDate.has(log.scheduledDate)) logsByDate.set(log.scheduledDate, new Map())
      logsByDate.get(log.scheduledDate)!.set(log.activityId, log)
    }

    const streaks = await db.select().from(ActivityStreaks).where(eq(ActivityStreaks.userId, user.id))
    const streaksByActivityId = new Map(streaks.map((s) => [s.activityId, s]))

    // Build result keyed by date string
    const result: Record<string, ReturnType<typeof buildOccurrencesForDate>> = {}
    const fromDate = parseISO(data.from)
    for (let i = 0; i < 7; i++) {
      const d = new Date(fromDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      result[dateStr] = buildOccurrencesForDate(dateStr, allActivities, logsByDate, streaksByActivityId)
    }

    return result
  })

// ─── Complete an activity occurrence ──────────────────────────────────────────

const completeInput = z.object({
  activityId: z.string().uuid(),
  scheduledDate: z.string(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  actualDuration: z.number().min(1),
  onTime: z.boolean(),
  notes: z.string().optional(),
})

export const completeActivity = createServerFn({ method: 'POST' })
  .validator(completeInput)
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])

    const streak = await db.query.ActivityStreaks.findFirst({
      where: and(
        eq(ActivityStreaks.activityId, data.activityId),
        eq(ActivityStreaks.userId, user.id),
      ),
    })

    const currentStreak = streak?.currentStreak ?? 0
    const consecutiveSkips = streak?.consecutiveSkips ?? 0
    const multiplier = await getMultiplier(data.activityId)

    const score = calculateScore({
      actualDuration: data.actualDuration,
      multiplier,
      onTime: data.onTime,
      currentStreak,
      consecutiveSkips,
    })

    const newStreak = currentStreak + 1
    const longestStreak = Math.max(streak?.longestStreak ?? 0, newStreak)

    const existingLog = await db.query.ActivityLogs.findFirst({
      where: and(
        eq(ActivityLogs.activityId, data.activityId),
        eq(ActivityLogs.scheduledDate, data.scheduledDate),
      ),
    })

    if (existingLog) {
      await db
        .update(ActivityLogs)
        .set({
          status: 'completed',
          actualDuration: data.actualDuration,
          onTime: data.onTime,
          score,
          streakAtCompletion: newStreak,
          consecutiveSkipsAtCompletion: consecutiveSkips,
          notes: data.notes ?? null,
          completedAt: new Date(),
        })
        .where(eq(ActivityLogs.id, existingLog.id))
    } else {
      await db.insert(ActivityLogs).values({
        activityId: data.activityId,
        userId: user.id,
        scheduledDate: data.scheduledDate,
        scheduledStart: new Date(data.scheduledStart),
        scheduledEnd: new Date(data.scheduledEnd),
        status: 'completed',
        actualDuration: data.actualDuration,
        onTime: data.onTime,
        score,
        streakAtCompletion: newStreak,
        consecutiveSkipsAtCompletion: consecutiveSkips,
        notes: data.notes ?? null,
        completedAt: new Date(),
      })
    }

    await db
      .update(ActivityStreaks)
      .set({
        currentStreak: newStreak,
        longestStreak,
        consecutiveSkips: 0,
        lastCompletedDate: data.scheduledDate,
      })
      .where(
        and(
          eq(ActivityStreaks.activityId, data.activityId),
          eq(ActivityStreaks.userId, user.id),
        ),
      )

    return { score }
  })

// ─── Skip an activity occurrence ──────────────────────────────────────────────

const skipInput = z.object({
  activityId: z.string().uuid(),
  scheduledDate: z.string(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
})

export const skipActivity = createServerFn({ method: 'POST' })
  .validator(skipInput)
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])

    const existingLog = await db.query.ActivityLogs.findFirst({
      where: and(
        eq(ActivityLogs.activityId, data.activityId),
        eq(ActivityLogs.scheduledDate, data.scheduledDate),
      ),
    })

    if (existingLog) {
      await db
        .update(ActivityLogs)
        .set({ status: 'skipped', completedAt: new Date() })
        .where(eq(ActivityLogs.id, existingLog.id))
    } else {
      await db.insert(ActivityLogs).values({
        activityId: data.activityId,
        userId: user.id,
        scheduledDate: data.scheduledDate,
        scheduledStart: new Date(data.scheduledStart),
        scheduledEnd: new Date(data.scheduledEnd),
        status: 'skipped',
        completedAt: new Date(),
      })
    }

    const streak = await db.query.ActivityStreaks.findFirst({
      where: and(
        eq(ActivityStreaks.activityId, data.activityId),
        eq(ActivityStreaks.userId, user.id),
      ),
    })

    await db
      .update(ActivityStreaks)
      .set({
        currentStreak: 0,
        consecutiveSkips: (streak?.consecutiveSkips ?? 0) + 1,
      })
      .where(
        and(
          eq(ActivityStreaks.activityId, data.activityId),
          eq(ActivityStreaks.userId, user.id),
        ),
      )
  })

async function getMultiplier(activityId: string): Promise<number> {
  const db = await getDb()
  const activity = await db.query.Activities.findFirst({
    where: eq(Activities.id, activityId),
  })
  return activity?.multiplier ?? 1
}
