import { AlertTriangle } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import type { ProjectMeta } from '@/domain/schema'
import { formatMoney } from '@/lib/format'

/**
 * Opening share capital should fund the opening balance sheet — cash plus
 * any fixed assets already on the books. A mismatch means the balance sheet
 * won't tie from day one, so it's flagged here rather than only surfacing
 * once the statements are generated.
 */
export function CapitalStructureWarning({
  meta,
  openingShareCapital,
  openingCash,
  openingFixedAssets,
}: {
  meta: ProjectMeta
  openingShareCapital: number
  openingCash: number
  openingFixedAssets: number
}) {
  const expected = openingCash + openingFixedAssets
  const mismatch = Math.abs(openingShareCapital - expected) > 0.01
  if (!mismatch) return null

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="flex-row items-start gap-3 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <p className="text-sm text-destructive">
          Opening share capital of {formatMoney(openingShareCapital, meta).text} does not equal opening cash plus
          opening fixed assets ({formatMoney(expected, meta).text}).
        </p>
      </CardContent>
    </Card>
  )
}
