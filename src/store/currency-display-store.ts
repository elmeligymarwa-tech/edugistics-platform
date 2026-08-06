import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { idbStorage } from './project-store'

/**
 * UI-only preference for the top bar's USD toggle: whether reporting
 * surfaces show figures converted to USD via exchangeRate/toUsd, or in the
 * project's own currency. Not domain data, so it lives in its own persisted
 * slice exactly like consultant-ui-store.ts.
 */

export const CURRENCY_DISPLAY_STORAGE_NAME = 'edugistics-currency-display'

interface CurrencyDisplayState {
  showUsd: boolean
  toggleShowUsd: () => void
}

export const useCurrencyDisplayStore = create<CurrencyDisplayState>()(
  persist(
    (set) => ({
      showUsd: false,
      toggleShowUsd: () => set((state) => ({ showUsd: !state.showUsd })),
    }),
    {
      name: CURRENCY_DISPLAY_STORAGE_NAME,
      storage: createJSONStorage(() => idbStorage),
    },
  ),
)
