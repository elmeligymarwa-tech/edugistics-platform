'use client'

import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface CourseOption {
  id: string
  name: string
}

export function PromoCodeCourseMultiSelect({
  courses,
  value,
  onChange,
  disabled,
}: {
  courses: CourseOption[]
  value: string[]
  onChange: (courseIds: string[]) => void
  disabled?: boolean
}) {
  const summary =
    value.length === 0
      ? 'Select courses…'
      : value.length === 1
        ? (courses.find((course) => course.id === value[0])?.name ?? '1 course selected')
        : `${value.length} courses selected`

  function toggle(courseId: string) {
    onChange(value.includes(courseId) ? value.filter((id) => id !== courseId) : [...value, courseId])
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" disabled={disabled} className="w-full justify-between font-normal">
            <span className="truncate">{summary}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent className="w-full min-w-64 p-2">
        {courses.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No courses yet.</p>
        ) : (
          <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {courses.map((course) => (
              <label key={course.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox checked={value.includes(course.id)} onCheckedChange={() => toggle(course.id)} />
                <span className="truncate">{course.name}</span>
              </label>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
