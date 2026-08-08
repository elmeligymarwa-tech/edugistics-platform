'use client'

import { useTransition } from 'react'

import { Switch } from '@/components/ui/switch'
import { toggleCourseActiveAction } from '@/app/training/admin/(protected)/courses/actions'

export function CourseActiveToggle({
  courseId,
  isActive,
  disabled,
}: {
  courseId: string
  isActive: boolean
  disabled?: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(next: boolean) {
    startTransition(async () => {
      await toggleCourseActiveAction(courseId, next)
    })
  }

  return (
    <Switch
      checked={isActive}
      onCheckedChange={handleChange}
      disabled={disabled || isPending}
      aria-label={isActive ? 'Deactivate course' : 'Activate course'}
    />
  )
}
