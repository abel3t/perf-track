/**
 * Performance Points formula:
 *   Score = actualDuration × multiplier × onTimeFactor × streakBonus × skipPenalty
 *
 * streakBonus  = min(1 + streak × 0.01, 1.4)   → caps at 40 days
 * onTimeFactor = 1.1 (on time) | 0.9 (late)
 * skipPenalty  = max(0.5, 1 - (consecutiveSkips - 1) × 0.1)  — only when > 0 skips preceded this
 */

export interface ScoreParams {
  actualDuration: number   // minutes
  multiplier: number       // 1–10
  onTime: boolean
  currentStreak: number    // streak before this completion
  consecutiveSkips: number // skips immediately before this completion (0 = none)
}

export function calculateScore(p: ScoreParams): number {
  const onTimeFactor = p.onTime ? 1.1 : 0.9
  const streakBonus = Math.min(1 + p.currentStreak * 0.01, 1.4)
  const skipPenalty =
    p.consecutiveSkips > 0
      ? Math.max(0.5, 1 - (p.consecutiveSkips - 1) * 0.1)
      : 1.0

  return p.actualDuration * p.multiplier * onTimeFactor * streakBonus * skipPenalty
}

export interface DayStats {
  totalScore: number
  baselineScore: number
  efficiencyPct: number // can be > 100%
}

export interface PlannedActivity {
  plannedDuration: number
  multiplier: number
  score: number | null // null = not yet completed
}

/**
 * Baseline = sum of (plannedDuration × multiplier) for all planned activities today.
 * Efficiency = totalAchieved / baseline × 100.
 */
export function calculateDayStats(activities: PlannedActivity[]): DayStats {
  const baselineScore = activities.reduce(
    (sum, a) => sum + a.plannedDuration * a.multiplier,
    0,
  )
  const totalScore = activities.reduce((sum, a) => sum + (a.score ?? 0), 0)
  const efficiencyPct =
    baselineScore === 0 ? 0 : Math.round((totalScore / baselineScore) * 100)

  return { totalScore, baselineScore, efficiencyPct }
}

/** Format PP for display: rounds to 1 decimal */
export function formatScore(score: number): string {
  return score % 1 === 0 ? score.toString() : score.toFixed(1)
}
