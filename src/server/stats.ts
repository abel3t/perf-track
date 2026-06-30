import { createServerFn } from '@tanstack/react-start'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'

import { Activities, ActivityLogs, ActivityStreaks } from '#/db/schema'
import { calculateDayStats } from '#/lib/score'

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

// ─── Day stats ─────────────────────────────────────────────────────────────────

export const getDayStats = createServerFn({ method: 'GET' })
  .validator(z.object({ date: z.string() }))
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])

    const logs = await db
      .select({
        score: ActivityLogs.score,
        status: ActivityLogs.status,
        plannedDuration: Activities.plannedDuration,
        multiplier: Activities.multiplier,
      })
      .from(ActivityLogs)
      .innerJoin(Activities, eq(ActivityLogs.activityId, Activities.id))
      .where(
        and(
          eq(ActivityLogs.userId, user.id),
          eq(ActivityLogs.scheduledDate, data.date),
        ),
      )

    const stats = calculateDayStats(
      logs.map((l) => ({
        plannedDuration: l.plannedDuration,
        multiplier: l.multiplier,
        score: l.status === 'completed' ? (l.score ?? 0) : null,
      })),
    )

    const completed = logs.filter((l) => l.status === 'completed').length
    const skipped = logs.filter((l) => l.status === 'skipped').length
    const pending = logs.filter((l) => l.status === 'pending').length

    return { ...stats, completed, skipped, pending, total: logs.length }
  })

// ─── Range stats (for week/month charts) ──────────────────────────────────────

export const getRangeStats = createServerFn({ method: 'GET' })
  .validator(z.object({ from: z.string(), to: z.string() }))
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])

    const rows = await db
      .select({
        date: ActivityLogs.scheduledDate,
        score: sql<number>`coalesce(sum(${ActivityLogs.score}), 0)`.as('score'),
        plannedScore: sql<number>`sum(${Activities.plannedDuration} * ${Activities.multiplier})`.as('plannedScore'),
        completed: sql<number>`count(*) filter (where ${ActivityLogs.status} = 'completed')`.as('completed'),
        total: sql<number>`count(*)`.as('total'),
      })
      .from(ActivityLogs)
      .innerJoin(Activities, eq(ActivityLogs.activityId, Activities.id))
      .where(
        and(
          eq(ActivityLogs.userId, user.id),
          gte(ActivityLogs.scheduledDate, data.from),
          lte(ActivityLogs.scheduledDate, data.to),
        ),
      )
      .groupBy(ActivityLogs.scheduledDate)
      .orderBy(ActivityLogs.scheduledDate)

    return rows.map((r) => ({
      date: r.date,
      totalScore: Number(r.score),
      baselineScore: Number(r.plannedScore),
      efficiencyPct:
        Number(r.plannedScore) === 0
          ? 0
          : Math.round((Number(r.score) / Number(r.plannedScore)) * 100),
      completed: Number(r.completed),
      total: Number(r.total),
    }))
  })

// ─── All-time daily stats (for line chart + heatmap) ──────────────────────────

export const getAllTimeStats = createServerFn({ method: 'GET' }).handler(async () => {
  const [db, user] = await Promise.all([getDb(), requireUser()])

  const rows = await db
    .select({
      date: ActivityLogs.scheduledDate,
      score: sql<number>`coalesce(sum(${ActivityLogs.score}), 0)`.as('score'),
      plannedScore: sql<number>`sum(${Activities.plannedDuration} * ${Activities.multiplier})`.as('plannedScore'),
      completed: sql<number>`count(*) filter (where ${ActivityLogs.status} = 'completed')`.as('completed'),
      total: sql<number>`count(*)`.as('total'),
    })
    .from(ActivityLogs)
    .innerJoin(Activities, eq(ActivityLogs.activityId, Activities.id))
    .where(eq(ActivityLogs.userId, user.id))
    .groupBy(ActivityLogs.scheduledDate)
    .orderBy(ActivityLogs.scheduledDate)

  return rows.map((r) => ({
    date: r.date,
    totalScore: Number(r.score),
    efficiencyPct:
      Number(r.plannedScore) === 0
        ? 0
        : Math.round((Number(r.score) / Number(r.plannedScore)) * 100),
    completed: Number(r.completed),
    total: Number(r.total),
  }))
})

// ─── Streaks summary ───────────────────────────────────────────────────────────

export const getStreaksSummary = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [db, user] = await Promise.all([getDb(), requireUser()])

    return db
      .select({
        activityId: ActivityStreaks.activityId,
        title: Activities.title,
        color: Activities.color,
        currentStreak: ActivityStreaks.currentStreak,
        longestStreak: ActivityStreaks.longestStreak,
        consecutiveSkips: ActivityStreaks.consecutiveSkips,
        lastCompletedDate: ActivityStreaks.lastCompletedDate,
      })
      .from(ActivityStreaks)
      .innerJoin(Activities, eq(ActivityStreaks.activityId, Activities.id))
      .where(
        and(eq(ActivityStreaks.userId, user.id), eq(Activities.recurrenceType, 'recurring')),
      )
      .orderBy(ActivityStreaks.currentStreak)
  },
)
