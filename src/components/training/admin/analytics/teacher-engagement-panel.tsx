import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat-tile'
import type { TeacherEngagementBreakdown } from '@/lib/training/analytics'
import { AnalyticsEmptyState } from './empty-state'

const SEGMENTS = [
  { key: 'new', label: 'New', color: 'var(--chart-1)' },
  { key: 'engaged', label: 'Engaged', color: 'var(--chart-2)' },
  { key: 'highlyEngaged', label: 'Highly engaged', color: 'var(--chart-3)' },
] as const

export function TeacherEngagementPanel({ breakdown }: { breakdown: TeacherEngagementBreakdown }) {
  const total = breakdown.new + breakdown.engaged + breakdown.highlyEngaged

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teacher engagement</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {total === 0 ? (
          <AnalyticsEmptyState message="No confirmed registrations for the current filters." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="New teachers" value={breakdown.new} hint="Exactly 1 confirmed registration" />
              <StatTile
                label="Returning teachers"
                value={breakdown.returning}
                hint={`${breakdown.engaged} engaged, ${breakdown.highlyEngaged} highly engaged`}
              />
            </div>
            <div>
              <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
                {SEGMENTS.map((segment) => {
                  const value = breakdown[segment.key]
                  if (value === 0) return null
                  return (
                    <div
                      key={segment.key}
                      style={{ width: `${(value / total) * 100}%`, backgroundColor: segment.color }}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                    />
                  )
                })}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {SEGMENTS.map((segment) => (
                  <li key={segment.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.label} ({breakdown[segment.key]})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
