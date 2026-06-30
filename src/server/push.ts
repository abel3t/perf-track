import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { Client } from '@upstash/qstash'
import { rruleAfter } from '#/lib/recurrence'

import { Activities, PushSubscriptions } from '#/db/schema'

const getDb = async () => import('#/db').then((m) => m.db)

function qstashClient() {
  return new Client({
    baseUrl: "https://qstash-us-east-1.upstash.io",
    token: process.env.QSTASH_TOKEN!
  })
}

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

// ─── VAPID public key ─────────────────────────────────────────────────────────

export const getVapidPublicKey = createServerFn({ method: 'GET' }).handler(() => ({
  publicKey: process.env.VAPID_PUBLIC_KEY!,
}))

// ─── Subscribe / unsubscribe ───────────────────────────────────────────────────

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
})

export const subscribePush = createServerFn({ method: 'POST' })
  .validator(subscribeSchema)
  .handler(async ({ data }) => {
    const [db, user] = await Promise.all([getDb(), requireUser()])
    await db
      .insert(PushSubscriptions)
      .values({ userId: user.id, ...data })
      .onConflictDoUpdate({
        target: PushSubscriptions.endpoint,
        set: { p256dh: data.p256dh, auth: data.auth },
      })
  })

export const unsubscribePush = createServerFn({ method: 'POST' }).handler(async () => {
  const [db, user] = await Promise.all([getDb(), requireUser()])
  await db.delete(PushSubscriptions).where(eq(PushSubscriptions.userId, user.id))
})

export const getPushSubscriptionStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const [db, user] = await Promise.all([getDb(), requireUser()])
  const sub = await db.query.PushSubscriptions.findFirst({
    where: eq(PushSubscriptions.userId, user.id),
  })
  return { subscribed: !!sub }
})

// ─── Send push to one activity occurrence ─────────────────────────────────────

export async function sendActivityNotification(activityId: string, scheduledDate: string) {
  const [{ default: webpush }, db] = await Promise.all([import('web-push'), getDb()])
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  const activity = await db.query.Activities.findFirst({
    where: and(eq(Activities.id, activityId), isNull(Activities.deletedAt)),
  })
  if (!activity || !activity.reminderMinutes) return

  const subscriptions = await db
    .select()
    .from(PushSubscriptions)
    .where(eq(PushSubscriptions.userId, activity.userId))

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: activity.title,
          body: `Starts in ${activity.reminderMinutes} min`,
          tag: `activity-${activity.id}-${scheduledDate}`,
          url: '/',
        }),
      )
    } catch (err: unknown) {
      if ((err as { statusCode?: number }).statusCode === 410) {
        await db.delete(PushSubscriptions).where(eq(PushSubscriptions.endpoint, sub.endpoint))
      }
    }
  }

  // Chain: schedule the next occurrence for recurring activities
  if (activity.recurrenceType === 'recurring') {
    await scheduleNextReminder(activity, scheduledDate)
  } else {
    await db
      .update(Activities)
      .set({ qstashMessageId: null })
      .where(eq(Activities.id, activityId))
  }
}

// ─── Schedule next reminder via QStash ────────────────────────────────────────

export async function scheduleNextReminder(
  activity: typeof Activities.$inferSelect,
  afterDate?: string, // find next occurrence strictly after this date
) {
  if (!activity.reminderMinutes) return

  const now = new Date()
  const targetDate = resolveNextOccurrenceDate(activity, afterDate, now)
  if (!targetDate) return

  if (activity.endDate && targetDate > activity.endDate) return

  const [hh, mm] = activity.startTime.split(':').map(Number)
  const [y, mo, d] = targetDate.split('-').map(Number)
  const notifyAt = new Date(y, mo - 1, d, hh, mm - activity.reminderMinutes)

  // Already passed — recurse to the next occurrence
  if (notifyAt <= now) {
    if (activity.recurrenceType === 'recurring') {
      await scheduleNextReminder(activity, targetDate)
    }
    return
  }

  const delaySeconds = Math.floor((notifyAt.getTime() - now.getTime()) / 1000)

  const response = await qstashClient().publishJSON({
    url: `${process.env.APP_URL}/api/push/send-one`,
    delay: delaySeconds,
    body: { activityId: activity.id, scheduledDate: targetDate },
  })

  const db = await getDb()
  await db
    .update(Activities)
    .set({ qstashMessageId: response.messageId })
    .where(eq(Activities.id, activity.id))
}

function resolveNextOccurrenceDate(
  activity: typeof Activities.$inferSelect,
  afterDate: string | undefined,
  now: Date,
): string | null {
  if (activity.recurrenceType === 'once') {
    return activity.startDate
  }

  if (!activity.rrule) return null

  let searchAfter: Date
  if (afterDate) {
    const [y, m, d] = afterDate.split('-').map(Number)
    // Search strictly after midnight of afterDate in UTC
    searchAfter = new Date(Date.UTC(y, m - 1, d, 23, 59, 59))
  } else {
    searchAfter = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
    )
  }

  const next = rruleAfter(activity.rrule, searchAfter)
  return next ? next.toISOString().slice(0, 10) : null
}

// ─── Cancel a pending QStash reminder ─────────────────────────────────────────

export async function cancelReminder(messageId: string | null) {
  if (!messageId) return
  try {
    await qstashClient().messages.delete(messageId)
  } catch {
    // Already delivered or invalid — ignore
  }
}
