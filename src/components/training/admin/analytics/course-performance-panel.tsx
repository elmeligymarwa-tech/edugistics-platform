import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { COURSE_CATEGORY_LABELS } from '@/domain/training/schema'
import type { CoursePerformanceRow } from '@/lib/training/analytics'
import { AnalyticsBarChart } from './analytics-bar-chart'
import { AnalyticsEmptyState } from './empty-state'

function formatUtilisation(utilisation: number | null): string {
  return utilisation == null ? '—' : `${Math.round(utilisation)}%`
}

export function CoursePerformancePanel({
  rows,
  averageRegistrationsPerCourse,
}: {
  rows: CoursePerformanceRow[]
  averageRegistrationsPerCourse: number | null
}) {
  const chartData = rows.map((row) => ({ label: row.courseName, value: row.confirmed }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course performance</CardTitle>
        {averageRegistrationsPerCourse != null ? (
          <p className="text-xs text-muted-foreground">
            Average registrations per course: <span className="font-medium tabular-nums text-foreground">{averageRegistrationsPerCourse.toFixed(1)}</span>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <AnalyticsEmptyState message="No courses with registrations for the current filters." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="h-64">
              <AnalyticsBarChart data={chartData} seriesName="Confirmed registrations" />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Confirmed</TableHead>
                    <TableHead className="text-right">Waitlisted</TableHead>
                    <TableHead className="text-right">Capacity</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Utilisation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.courseId}>
                      <TableCell className="font-medium text-foreground">{row.courseName}</TableCell>
                      <TableCell className="text-muted-foreground">{COURSE_CATEGORY_LABELS[row.category]}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.confirmed}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.waitlisted}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.capacity ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.remaining ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUtilisation(row.utilisation)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
