'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Copy } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  archiveMarketingTemplateAction,
  duplicateMarketingTemplateAction,
} from '@/app/training/admin/(protected)/subscribers/templates/actions'
import type { MarketingTemplateListItem } from '@/lib/training/marketing-templates'
import { MarketingTemplateFormDialog } from './marketing-template-form-dialog'

export function MarketingTemplateRowActions({ template }: { template: MarketingTemplateListItem }) {
  const router = useRouter()
  const [duplicating, startDuplicate] = useTransition()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, startArchive] = useTransition()

  function handleDuplicate() {
    startDuplicate(async () => {
      await duplicateMarketingTemplateAction(template.id)
      router.refresh()
    })
  }

  function handleArchive() {
    startArchive(async () => {
      await archiveMarketingTemplateAction(template.id)
      setArchiveOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1">
      {!template.archivedAt && <MarketingTemplateFormDialog template={template} />}
      <Button variant="ghost" size="icon-sm" aria-label="Duplicate template" onClick={handleDuplicate} disabled={duplicating}>
        <Copy />
      </Button>
      {!template.archivedAt && (
        <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Archive template"><Archive /></Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive {template.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This template stops appearing as a choice in the composer. Nothing is deleted — it can still be viewed
                here.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchive} disabled={archiving}>
                {archiving ? 'Archiving…' : 'Archive'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
