'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Download, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatCourseDateLong } from '@/domain/training/format'
import type { CourseFilterOption } from '@/lib/training/registrations'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const EMAIL_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All email statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
]

const CONSENT_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'true', label: 'Consented' },
  { value: 'false', label: 'Not consented' },
]

export function RegistrationsFilters({ courseOptions }: { courseOptions: CourseFilterOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false)
  const [attendancePromptError, setAttendancePromptError] = useState<string | null>(null)
  const [includeWaitlisted, setIncludeWaitlisted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'ALL') params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (search === current) return
    const timeout = setTimeout(() => updateParam('q', search || null), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const courseItems = [
    { value: 'ALL', label: 'All courses' },
    ...courseOptions.map((course) => ({ value: course.id, label: course.name })),
  ]

  const exportParams = new URLSearchParams(searchParams.toString())
  exportParams.delete('page')

  const selectedCourseId = searchParams.get('courseId')
  const selectedCourse = selectedCourseId ? courseOptions.find((course) => course.id === selectedCourseId) : undefined

  // The sheet is always for one course, never "all courses" — reusing this
  // page's own Course filter as the selection, rather than a second course
  // picker, keeps there being exactly one place to pick a course on this
  // screen.
  function handleOpenAttendanceSheet() {
    if (!selectedCourseId || selectedCourseId === 'ALL' || !selectedCourse) {
      setAttendancePromptError('Select a course above first — an attendance sheet is for one course at a time.')
      return
    }
    setAttendancePromptError(null)
    setIncludeWaitlisted(false)
    setSessionId(null)
    setAttendanceDialogOpen(true)
  }

  const sessionRequiredButMissing = Boolean(selectedCourse?.isMultiDay) && !sessionId

  const attendanceSheetParams = new URLSearchParams()
  if (selectedCourseId) attendanceSheetParams.set('courseId', selectedCourseId)
  if (includeWaitlisted) attendanceSheetParams.set('includeWaitlisted', 'true')
  if (sessionId) attendanceSheetParams.set('sessionId', sessionId)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="registrations-search">
          Search
        </label>
        <Input
          id="registrations-search"
          placeholder="Name, email, school or reference"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Course</span>
        <Select
          items={courseItems}
          value={searchParams.get('courseId') ?? 'ALL'}
          onValueChange={(value) => updateParam('courseId', value)}
          triggerClassName="w-48"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Status</span>
        <Select
          items={STATUS_OPTIONS}
          value={searchParams.get('status') ?? 'ALL'}
          onValueChange={(value) => updateParam('status', value)}
          triggerClassName="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Email status</span>
        <Select
          items={EMAIL_STATUS_OPTIONS}
          value={searchParams.get('emailStatus') ?? 'ALL'}
          onValueChange={(value) => updateParam('emailStatus', value)}
          triggerClassName="w-44"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Marketing consent</span>
        <Select
          items={CONSENT_OPTIONS}
          value={searchParams.get('consent') ?? 'ALL'}
          onValueChange={(value) => updateParam('consent', value)}
          triggerClassName="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="registrations-from">
          From
        </label>
        <Input
          id="registrations-from"
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(event) => updateParam('from', event.target.value || null)}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="registrations-to">
          To
        </label>
        <Input
          id="registrations-to"
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(event) => updateParam('to', event.target.value || null)}
          className="w-40"
        />
      </div>
      <Button
        variant="outline"
        render={<a href={`/api/training/admin/registrations/export?${exportParams.toString()}`} />}
      >
        <Download /> Export to Excel
      </Button>
      <div className="flex flex-col gap-1">
        <Button type="button" variant="outline" onClick={handleOpenAttendanceSheet}>
          <Printer /> Print Attendance Sheet
        </Button>
        {attendancePromptError && <p className="text-xs text-destructive">{attendancePromptError}</p>}
      </div>

      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Print attendance sheet</DialogTitle>
            <DialogDescription>
              {selectedCourse ? `For ${selectedCourse.name}.` : ''} Lists confirmed registrations by default.
            </DialogDescription>
          </DialogHeader>

          {selectedCourse?.isMultiDay && (
            <Field>
              <FieldLabel htmlFor="attendance-session">Session date</FieldLabel>
              <Select
                id="attendance-session"
                items={selectedCourse.sessions.map((session) => ({
                  value: session.id,
                  label: formatCourseDateLong(session.sessionDate),
                }))}
                value={sessionId ?? ''}
                onValueChange={setSessionId}
              />
              <FieldDescription>
                This is a multi-day course — the sheet covers one session at a time.
              </FieldDescription>
            </Field>
          )}

          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="attendance-include-waitlisted">Include waitlisted registrations</FieldLabel>
              <Switch
                id="attendance-include-waitlisted"
                checked={includeWaitlisted}
                onCheckedChange={setIncludeWaitlisted}
              />
            </div>
            <FieldDescription>
              Waitlisted rows are marked clearly on the sheet so staff can see they did not hold a confirmed place.
            </FieldDescription>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAttendanceDialogOpen(false)}>
              Cancel
            </Button>
            {sessionRequiredButMissing ? (
              <div className="flex flex-col items-end gap-1">
                <Button type="button" disabled>
                  <Printer /> Open sheet
                </Button>
                <p className="text-xs text-destructive">Select a session date first.</p>
              </div>
            ) : (
              <Button
                type="button"
                render={
                  <a
                    href={`/api/training/admin/registrations/attendance-sheet?${attendanceSheetParams.toString()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setAttendanceDialogOpen(false)}
                  />
                }
              >
                <Printer /> Open sheet
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
