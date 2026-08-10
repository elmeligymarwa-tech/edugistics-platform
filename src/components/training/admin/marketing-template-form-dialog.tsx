'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { MarketingTemplateListItem } from '@/lib/training/marketing-templates'
import { MarketingTemplateForm } from './marketing-template-form'

export function MarketingTemplateFormDialog({ template }: { template?: MarketingTemplateListItem }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          template ? (
            <Button variant="ghost" size="icon-sm" aria-label="Edit template">
              <Pencil />
            </Button>
          ) : (
            <Button>
              <Plus /> New template
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit template' : 'Create template'}</DialogTitle>
        </DialogHeader>
        <MarketingTemplateForm template={template} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
