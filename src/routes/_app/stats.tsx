import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  format, subDays, startOfMonth, endOfMonth,
  eachDayOfInterval, parseISO, startOfYear, startOfWeek,
} from 'date-fns'
import HeatMap from '@uiw/react-heat-map'
import { Flame, CheckCircle2, Target, Zap, XCircle } from 'lucide-react'
import {
  Bar, Line, ComposedChart, Area,
  RadialBar, RadialBarChart, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '#/components/ui/chart'
import { getDayStats, getRangeStats, getStreaksSummary, getAllTimeStats } from '#/server/stats'
import { formatScore } from '#/lib/score'

export const Route = createFileRoute('/_app/stats')({
  component: StatsPage,
})

const weekChartConfig = {
  totalScore: { label: 'Score', color: 'var(--lagoon-deep)' },
  efficiencyPct: { label: 'Efficiency %', color: '#f97316' },
} satisfies ChartConfig

const allTimeConfig = {
  totalScore: { label: 'Score', color: 'var(--lagoon-deep)' },
  ma7: { label: '7-day avg', color: '#f97316' },
} satisfies ChartConfig

// ── Moving average ─────────────────────────────────────────────────────────────
function movingAvg<T extends { totalScore: number }>(data: T[], window: number): (T & { ma7: number })[] {
  return data.map((d, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1)
    const avg = slice.reduce((s, x) => s + x.totalScore, 0) / slice.length
    return { ...d, ma7: Math.round(avg) }
  })
}

function StatsPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekStart = format(subDays(new Date(), 6), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd')

  const { data: dayStats } = useQuery({
    queryKey: ['day-stats', today],
    queryFn: () => getDayStats({ data: { date: today } }),
  })
  const { data: rawWeekData = [] } = useQuery({
    queryKey: ['range-stats', weekStart, today],
    queryFn: () => getRangeStats({ data: { from: weekStart, to: today } }),
  })
  const { data: rawMonthData = [] } = useQuery({
    queryKey: ['range-stats', monthStart, monthEnd],
    queryFn: () => getRangeStats({ data: { from: monthStart, to: monthEnd } }),
  })
  const { data: allTime = [] } = useQuery({
    queryKey: ['all-time-stats'],
    queryFn: () => getAllTimeStats(),
  })
  const { data: streaks = [] } = useQuery({
    queryKey: ['streaks-summary'],
    queryFn: () => getStreaksSummary(),
  })

  // ── 7-day data ──────────────────────────────────────────────────────────────
  const weekDays = eachDayOfInterval({ start: parseISO(weekStart), end: parseISO(today) })
  const weekMap = new Map(rawWeekData.map((d) => [d.date, d]))
  const weekData = weekDays.map((d) => {
    const ds = format(d, 'yyyy-MM-dd')
    const e = weekMap.get(ds)
    return { label: format(d, 'EEE'), totalScore: e?.totalScore ?? 0, efficiencyPct: e?.efficiencyPct ?? 0 }
  })

  // ── All-time line (with MA7) ─────────────────────────────────────────────────
  const allTimeWithMa = movingAvg(allTime, 7).map((d) => ({
    ...d,
    label: format(parseISO(d.date), 'MMM d, yy'),
    shortLabel: format(parseISO(d.date), 'MMM yy'),
  }))

  // Percentile thresholds — GitHub-style, deduped so sparse data doesn't collapse levels
  const heatmapColors = (() => {
    const scores = allTime.map((d) => d.totalScore).filter((s) => s > 0).sort((a, b) => a - b)
    const max = scores[scores.length - 1] ?? 1
    const levels = [
      { threshold: 0,           color: 'var(--line)' },
      { threshold: 1,           color: 'color-mix(in srgb, var(--lagoon-deep) 20%, transparent)' },
      { threshold: max * 0.2,   color: 'color-mix(in srgb, var(--lagoon-deep) 40%, transparent)' },
      { threshold: max * 0.4,   color: 'color-mix(in srgb, var(--lagoon-deep) 60%, transparent)' },
      { threshold: max * 0.65,  color: 'color-mix(in srgb, var(--lagoon-deep) 82%, transparent)' },
      { threshold: max * 0.85,  color: 'var(--lagoon-deep)' },
    ]
    // Dedupe: if two consecutive thresholds are identical, drop the earlier one
    const seen = new Set<number>()
    const result: Record<number, string> = {}
    for (const { threshold, color } of levels) {
      const key = Math.round(threshold)
      if (!seen.has(key)) { seen.add(key); result[key] = color }
      else result[key] = color // later color wins (higher level)
    }
    return result
  })()

  const weekTotal = rawWeekData.reduce((s, d) => s + d.totalScore, 0)
  const monthTotal = rawMonthData.reduce((s, d) => s + d.totalScore, 0)
  const monthAvgEff =
    rawMonthData.length > 0
      ? Math.round(rawMonthData.reduce((s, d) => s + d.efficiencyPct, 0) / rawMonthData.length)
      : 0

  const efficiency = dayStats?.efficiencyPct ?? 0
  const effColor = efficiency >= 100 ? '#22c55e' : efficiency >= 70 ? '#eab308' : '#ef4444'
  const gaugeData = [{ value: Math.min(efficiency, 150), fill: effColor }]

  return (
    <div className="flex flex-col h-full">
    <div
      className="flex-1 overflow-y-auto min-h-0 px-4 space-y-4 pb-6"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      <h1 className="text-xl font-bold text-[var(--sea-ink)]">Performance</h1>

      {/* ── Today ──────────────────────────────────────────────────────────── */}
      <div className="island-shell rounded-2xl p-4">
        <p className="island-kicker text-[10px] text-[var(--sea-ink-soft)] mb-3">
          Today — {format(new Date(), 'MMM d, yyyy')}
        </p>
        <div className="flex items-center gap-4">
          <div className="relative w-28 h-28 shrink-0">
            <RadialBarChart
              width={112} height={112} cx={56} cy={56}
              innerRadius={36} outerRadius={52} startAngle={220} endAngle={-40}
              data={gaugeData}
            >
              <PolarRadiusAxis tick={false} axisLine={false} />
              <RadialBar dataKey="value" max={150} background={{ fill: 'var(--line)' }} cornerRadius={8} />
            </RadialBarChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none" style={{ color: effColor }}>{efficiency}%</span>
              <span className="text-[9px] text-[var(--sea-ink-soft)] font-medium uppercase tracking-wider mt-0.5">efficiency</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] text-[var(--sea-ink-soft)] font-semibold uppercase tracking-wider">Score</p>
              <p className="text-3xl font-bold text-[var(--sea-ink)] leading-none">
                {dayStats ? formatScore(dayStats.totalScore) : '—'}
                <span className="text-sm font-normal text-[var(--sea-ink-soft)] ml-1">PP</span>
              </p>
            </div>
            {dayStats && (
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} />{dayStats.completed} done</span>
                <span className="flex items-center gap-1 text-red-400"><XCircle size={12} />{dayStats.skipped} skipped</span>
                <span className="flex items-center gap-1 text-[var(--sea-ink-soft)]"><Target size={12} />{dayStats.pending} left</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 7-day combo ────────────────────────────────────────────────────── */}
      <div className="island-shell rounded-2xl p-4">
        <div className="flex justify-between items-baseline mb-1">
          <p className="island-kicker text-[10px] text-[var(--sea-ink-soft)]">Last 7 days</p>
          <span className="text-sm font-bold text-[var(--lagoon-deep)]">{formatScore(weekTotal)} PP</span>
        </div>
        <p className="text-[10px] text-[var(--sea-ink-soft)] mb-3">Bars = score &nbsp;·&nbsp; line = efficiency %</p>
        <ChartContainer config={weekChartConfig} className="h-36 w-full">
          <ComposedChart data={weekData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--sea-ink-soft)' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="score" hide />
            <YAxis yAxisId="pct" orientation="right" hide domain={[0, 150]} />
            <ReferenceLine yAxisId="pct" y={100} stroke="#22c55e" strokeDasharray="4 2" strokeOpacity={0.6} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => n === 'totalScore' ? [`${formatScore(Number(v))} PP`, 'Score'] : [`${v}%`, 'Efficiency']} />} />
            <Bar yAxisId="score" dataKey="totalScore" fill="var(--lagoon-deep)" radius={[4, 4, 0, 0]} opacity={0.85} />
            <Line yAxisId="pct" dataKey="efficiencyPct" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316' }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ChartContainer>
      </div>

      {/* ── All-time line (forex style) ─────────────────────────────────────── */}
      {allTimeWithMa.length > 0 && (
        <div className="island-shell rounded-2xl p-4">
          <div className="flex justify-between items-baseline mb-1">
            <p className="island-kicker text-[10px] text-[var(--sea-ink-soft)]">All time</p>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded bg-[var(--lagoon-deep)] inline-block" />
                Daily
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <span className="w-3 h-0.5 rounded bg-orange-400 inline-block" />
                MA7
              </span>
            </div>
          </div>
          <p className="text-[10px] text-[var(--sea-ink-soft)] mb-3">
            {allTimeWithMa.length} days tracked &nbsp;·&nbsp; total {formatScore(allTime.reduce((s, d) => s + d.totalScore, 0))} PP
          </p>
          <ChartContainer config={allTimeConfig} className="h-44 w-full">
            <ComposedChart data={allTimeWithMa} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="allTimeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--lagoon-deep)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--lagoon-deep)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 9, fill: 'var(--sea-ink-soft)' }}
                axisLine={false} tickLine={false}
                interval={Math.max(Math.floor(allTimeWithMa.length / 6) - 1, 0)}
                minTickGap={40}
              />
              <YAxis hide />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelKey="label"
                    formatter={(v, n) =>
                      n === 'totalScore'
                        ? [`${formatScore(Number(v))} PP`, 'Score']
                        : [`${formatScore(Number(v))} PP`, '7-day avg']
                    }
                  />
                }
              />
              <Area dataKey="totalScore" stroke="var(--lagoon-deep)" strokeWidth={1.5} fill="url(#allTimeGrad)" dot={false} />
              <Line dataKey="ma7" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="0" />
            </ComposedChart>
          </ChartContainer>
        </div>
      )}

      {/* ── Year heatmap ─────────────────────────────────────────────────────── */}
      <div className="island-shell rounded-2xl p-4">
        <div className="flex justify-between items-baseline mb-3">
          <p className="island-kicker text-[10px] text-[var(--sea-ink-soft)]">
            {format(new Date(), 'yyyy')} heatmap
          </p>
          <div className="flex items-center gap-1 text-[9px] text-[var(--sea-ink-soft)]">
            <span>low</span>
            {[0.15, 0.35, 0.6, 0.85, 1].map((op) => (
              <span key={op} className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--lagoon-deep)', opacity: op }} />
            ))}
            <span>high</span>
          </div>
        </div>
        <HeatMap
          value={allTime.map((d) => ({ date: d.date, count: d.totalScore }))}
          startDate={startOfWeek(parseISO(yearStart), { weekStartsOn: 0 })}
          endDate={new Date()}
          width="100%"
          style={{ width: '100%' }}
          weekLabels={['', 'M', '', 'W', '', 'F', '']}
          monthLabels={['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']}
          rectSize={14}
          space={3}
          rectProps={{ rx: 3 }}
          legendCellSize={0}
          panelColors={heatmapColors}
        />
      </div>

      {/* ── Month + streaks ───────────────────────────────────────────────────── */}
      <div className="island-shell rounded-2xl p-4">
        <div className="flex justify-between items-baseline">
          <p className="island-kicker text-[10px] text-[var(--sea-ink-soft)]">{format(new Date(), 'MMMM yyyy')}</p>
          <span className="text-sm font-bold text-[var(--lagoon-deep)]">{formatScore(monthTotal)} PP</span>
        </div>
        <p className="text-[10px] text-[var(--sea-ink-soft)] mt-0.5">
          Avg efficiency: <span className="font-semibold" style={{ color: effColor }}>{monthAvgEff}%</span>
        </p>
      </div>

      {streaks.length > 0 && (
        <div className="island-shell rounded-2xl p-4">
          <p className="island-kicker text-[10px] text-[var(--sea-ink-soft)] mb-3">Streaks</p>
          <div className="space-y-3">
            {[...streaks].sort((a, b) => b.currentStreak - a.currentStreak).map((s) => {
              const pct = s.longestStreak > 0 ? Math.round((s.currentStreak / s.longestStreak) * 100) : 0
              return (
                <div key={s.activityId} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="flex-1 text-sm text-[var(--sea-ink)] truncate font-medium">{s.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.currentStreak > 0
                        ? <span className="flex items-center gap-0.5 text-sm font-bold text-orange-500"><Flame size={13} />{s.currentStreak}</span>
                        : <span className="text-xs text-[var(--sea-ink-soft)]">—</span>}
                      <span className="text-[10px] text-[var(--sea-ink-soft)]">/ {s.longestStreak} best</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden ml-4">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: s.currentStreak > 0 ? s.color : 'var(--sea-ink-soft)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-1 pb-2 text-[10px] text-[var(--sea-ink-soft)]">
        <Zap size={10} className="text-[var(--lagoon-deep)]" />
        <span>PP = Performance Points &nbsp;·&nbsp; 100% efficiency = baseline achieved</span>
      </div>
    </div>
    </div>
  )
}

