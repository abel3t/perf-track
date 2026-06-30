import {
  boolean,
  date,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'

// ─── Better Auth tables ────────────────────────────────────────────────────────

export const Users = pgTable('Users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

export const Sessions = pgTable('Sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => Users.id, { onDelete: 'cascade' }),
})

export const Accounts = pgTable('Accounts', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => Users.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

export const Verifications = pgTable('Verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
})

// ─── App tables ────────────────────────────────────────────────────────────────

export const Activities = pgTable('Activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => Users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull().$type<'event' | 'task'>(),
  multiplier: integer('multiplier').notNull().default(1), // 1–10
  plannedDuration: integer('plannedDuration').notNull(), // minutes
  color: text('color').notNull().default('#3B82F6'),
  startTime: text('startTime').notNull(), // "HH:MM"

  // Recurrence
  recurrenceType: text('recurrenceType').notNull().$type<'once' | 'recurring'>(),
  rrule: text('rrule'), // iCal RRULE string when recurring
  startDate: date('startDate').notNull(),
  endDate: date('endDate'), // null = recurring forever

  reminderMinutes: integer('reminderMinutes'), // null = no reminder
  qstashMessageId: text('qstashMessageId'), // pending QStash message to cancel on update/delete

  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  deletedAt: timestamp('deletedAt'),
})

export const ActivityLogs = pgTable('ActivityLogs', {
  id: uuid('id').defaultRandom().primaryKey(),
  activityId: uuid('activityId')
    .notNull()
    .references(() => Activities.id, { onDelete: 'cascade' }),
  userId: text('userId')
    .notNull()
    .references(() => Users.id, { onDelete: 'cascade' }),

  // Which occurrence
  scheduledDate: date('scheduledDate').notNull(),
  scheduledStart: timestamp('scheduledStart').notNull(),
  scheduledEnd: timestamp('scheduledEnd').notNull(),

  // Tracking result (filled on completion)
  status: text('status')
    .notNull()
    .default('pending')
    .$type<'pending' | 'completed' | 'skipped'>(),
  actualDuration: integer('actualDuration'), // minutes
  onTime: boolean('onTime'),

  // Score (computed on completion)
  score: real('score'),
  streakAtCompletion: integer('streakAtCompletion'),
  consecutiveSkipsAtCompletion: integer('consecutiveSkipsAtCompletion'),

  notes: text('notes'),
  completedAt: timestamp('completedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
})

export const PushSubscriptions = pgTable('PushSubscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => Users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
})

export const ActivityStreaks = pgTable('ActivityStreaks', {
  id: uuid('id').defaultRandom().primaryKey(),
  activityId: uuid('activityId')
    .notNull()
    .references(() => Activities.id, { onDelete: 'cascade' }),
  userId: text('userId')
    .notNull()
    .references(() => Users.id, { onDelete: 'cascade' }),
  currentStreak: integer('currentStreak').notNull().default(0),
  longestStreak: integer('longestStreak').notNull().default(0),
  consecutiveSkips: integer('consecutiveSkips').notNull().default(0),
  lastCompletedDate: date('lastCompletedDate'),
})

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Activity = typeof Activities.$inferSelect
export type ActivityLog = typeof ActivityLogs.$inferSelect
export type ActivityStreak = typeof ActivityStreaks.$inferSelect
export type PushSubscription = typeof PushSubscriptions.$inferSelect

// ─── Zod schemas ───────────────────────────────────────────────────────────────

export const activitySelectSchema = createSelectSchema(Activities)
export const activityInsertSchema = createInsertSchema(Activities, {
  title: (s) => s.min(1).max(100),
  multiplier: (s) => s.min(1).max(10),
  plannedDuration: (s) => s.min(1),
  startTime: (s) => s.regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM'),
  type: () => z.enum(['event', 'task']),
  recurrenceType: () => z.enum(['once', 'recurring']),
})
export const activityUpdateSchema = createUpdateSchema(Activities)

export const activityLogSelectSchema = createSelectSchema(ActivityLogs)
export const activityLogInsertSchema = createInsertSchema(ActivityLogs)

export const completeLogSchema = activityLogInsertSchema.pick({
  actualDuration: true,
  onTime: true,
  notes: true,
})
