---
name: project-perf-tracker
description: Performance Tracker PWA — architecture, stack, and feature overview
metadata:
  type: project
---

Personal daily activity tracker PWA. Goal: track events/tasks to measure personal performance by day, month, year.

**Why:** Self-optimization — user wants to see efficiency scores over time and identify patterns.

**How to apply:** When adding features, always think about how they affect the scoring formula and stats views. Mobile-first (iPhone primary).

## Stack
- TanStack Start (SSR) + TanStack Router (file-based)
- Drizzle ORM + PostgreSQL
- Better Auth (email/password)
- Tailwind CSS v4 + shadcn/ui (new-york style)
- Bun as package manager + runtime
- vite-plugin-pwa for PWA
- rrule for recurrence, date-fns for dates

## Key files
- `src/db/schema.ts` — all DB tables (Users, Sessions, Accounts, Verifications, Activities, ActivityLogs, ActivityStreaks)
- `src/lib/score.ts` — scoring formula (pure functions)
- `src/server/activities.ts` — server functions: CRUD + complete/skip
- `src/server/stats.ts` — server functions: day stats, range stats, streaks
- `src/routes/_app/timeline.tsx` — day timeline view (default route)
- `src/routes/_app/stats.tsx` — stats dashboard
- `src/components/ActivityFormSheet.tsx` — create/edit activity bottom sheet
- `src/components/TrackModal.tsx` — mark complete/skip with score preview
- `src/components/ActivityBlock.tsx` — timeline block component
- `src/components/BottomNav.tsx` — bottom tab nav (Timeline | Stats)

## Routes
- `/` → redirects to `/timeline`
- `/_app/timeline` — day timeline
- `/_app/stats` — stats dashboard

## DB conventions
- Table names: PascalCase (e.g., `Activities`, `ActivityLogs`)
- Column names: camelCase (e.g., `plannedDuration`, `scheduledStart`)
- Soft deletes on Activities via `deletedAt`
