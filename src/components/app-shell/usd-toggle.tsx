'use client'

import { Button } from '@/components/ui/button'
import { useActiveProject } from '@/store/project-store'
import { useCurrencyDisplayStore } from '@/store/currency-display-store'

/**
 * Switches every reporting figure across the app between the project's own
 * currency and USD, converted year by year via exchangeRate/toUsd. Hidden
 * when the active project already reports in USD, since the toggle would be
 * a no-op.
 */
export function UsdToggle() {
  const project = useActiveProject()
  const showUsd = useCurrencyDisplayStore((state) => state.showUsd)
  const toggleShowUsd = useCurrencyDisplayStore((state) => state.toggleShowUsd)

  if (!project || project.meta.currencyCode === 'USD') return null

  return (
    <Button
      type="button"
      variant={showUsd ? 'default' : 'outline'}
      size="sm"
      onClick={toggleShowUsd}
      aria-pressed={showUsd}
    >
      {showUsd ? 'USD' : project.meta.currencyCode}
    </Button>
  )
}
