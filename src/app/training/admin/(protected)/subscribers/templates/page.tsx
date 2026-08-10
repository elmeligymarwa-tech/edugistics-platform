import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

import { listMarketingTemplatesForAdmin } from '@/lib/training/marketing-templates'
import { Button } from '@/components/ui/button'
import { MarketingTemplateFormDialog } from '@/components/training/admin/marketing-template-form-dialog'
import { MarketingTemplatesTable } from '@/components/training/admin/marketing-templates-table'

export const metadata: Metadata = {
  title: 'Email Templates — Edugistics Training Admin',
}

export default async function TrainingAdminMarketingTemplatesPage() {
  const templates = await listMarketingTemplatesForAdmin()

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" render={<Link href="/training/admin/subscribers" />} className="w-fit">
        <ArrowLeft /> Back to subscribers
      </Button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-heading">Email Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">Starting points for the composer. Never sent directly.</p>
        </div>
        <MarketingTemplateFormDialog />
      </div>
      <MarketingTemplatesTable templates={templates} />
    </div>
  )
}
