'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { PromoCodeListItem } from '@/lib/training/promo-codes'
import type { CourseOption } from './promo-code-course-multi-select'
import { PromoCodeForm } from './promo-code-form'

export function PromoCodeFormDialog({ promoCode, courses }: { promoCode?: PromoCodeListItem; courses: CourseOption[] }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          promoCode ? (
            <Button variant="ghost" size="icon-sm" aria-label="Edit promo code">
              <Pencil />
            </Button>
          ) : (
            <Button>
              <Plus /> Add promo code
            </Button>
          )
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{promoCode ? 'Edit promo code' : 'Create promo code'}</DialogTitle>
        </DialogHeader>
        <PromoCodeForm promoCode={promoCode} courses={courses} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
