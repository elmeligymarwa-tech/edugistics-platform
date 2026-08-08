'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { CourseDetail } from '@/lib/training/courses'
import { CourseForm } from './course-form'

export function CourseFormDialog({ course }: { course?: CourseDetail }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          course ? (
            <Button variant="ghost" size="icon-sm" aria-label="Edit course">
              <Pencil />
            </Button>
          ) : (
            <Button>
              <Plus /> Add course
            </Button>
          )
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit course' : 'Create course'}</DialogTitle>
        </DialogHeader>
        <CourseForm course={course} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
