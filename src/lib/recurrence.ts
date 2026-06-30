const BYDAY: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
}

function parseRule(rule: string): { freq: string; days?: number[] } {
  const parts: Record<string, string> = {}
  for (const seg of rule.split(';')) {
    const eq = seg.indexOf('=')
    if (eq !== -1) parts[seg.slice(0, eq)] = seg.slice(eq + 1)
  }
  return {
    freq: parts['FREQ'] ?? '',
    days: parts['BYDAY']?.split(',').map((d) => BYDAY[d]).filter((n) => n !== undefined),
  }
}

function matchesDay(parsed: ReturnType<typeof parseRule>, date: Date): boolean {
  if (parsed.freq === 'DAILY') return true
  if (parsed.freq === 'WEEKLY' && parsed.days) return parsed.days.includes(date.getUTCDay())
  return false
}

export function rruleBetween(rule: string, start: Date, end: Date): Date[] {
  const parsed = parseRule(rule)
  const result: Date[] = []
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  while (cur.getTime() < end.getTime()) {
    if (matchesDay(parsed, cur)) result.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return result
}

export function rruleAfter(rule: string, after: Date): Date | null {
  const parsed = parseRule(rule)
  const cur = new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate()))
  cur.setUTCDate(cur.getUTCDate() + 1)
  for (let i = 0; i < 366; i++) {
    if (matchesDay(parsed, cur)) return new Date(cur)
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return null
}
