'use client'

import Link from 'next/link'
import { ListOrdered } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCourseFee } from '@/domain/training/format'
import { COURSE_CATEGORY_LABELS } from '@/domain/training/schema'
import type { AdminCourseListItem } from '@/lib/training/courses'
import { ArchiveCourseDialog } from './archive-course-dialog'
import { CourseActiveToggle } from './course-active-toggle'
import { CourseFormDialog } from './course-form-dialog'
import { CourseStatusBadge } from './course-status-badge'

function formatCourseDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function CoursesTable({ courses }: { courses: AdminCourseListItem[] }) {
  if (courses.length === 0) {
    return <p className="text-sm text-muted-foreground">No courses yet. Add the first one to get started.</p>
  }

  return (
    <Table className="data-table">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Registrations</TableHead>
          <TableHead>Waitlist</TableHead>
          <TableHead>Capacity</TableHead>
          <TableHead>Fee</TableHead>
          <TableHead>Active</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {courses.map((course) => (
          <TableRow key={course.id}>
            <TableCell className="font-medium text-foreground">{course.name}</TableCell>
            <TableCell>{formatCourseDate(course.courseDate)}</TableCell>
            <TableCell>{COURSE_CATEGORY_LABELS[course.category]}</TableCell>
            <TableCell>
              <CourseStatusBadge isActive={course.isActive} archivedAt={course.archivedAt} />
            </TableCell>
            <TableCell>{course.confirmedCount}</TableCell>
            <TableCell>{course.waitlistEnabled ? course.waitlistedCount : '—'}</TableCell>
            <TableCell>{course.maxCapacity ?? 'Unlimited'}</TableCell>
            <TableCell>{course.feeAmount > 0 ? formatCourseFee(course.feeAmount, course.currency) : 'Free'}</TableCell>
            <TableCell>
              <CourseActiveToggle courseId={course.id} isActive={course.isActive} disabled={Boolean(course.archivedAt)} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {course.waitlistEnabled && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="View waitlist"
                    render={<Link href={`/training/admin/courses/${course.id}/waitlist`} />}
                  >
                    <ListOrdered />
                  </Button>
                )}
                <CourseFormDialog course={course} />
                {!course.archivedAt && <ArchiveCourseDialog courseId={course.id} courseName={course.name} />}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
