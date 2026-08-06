import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { BRITISH_CURRICULUM_EGYPT_PRESET } from '@/lib/presets/british-curriculum-egypt'
import type { Preset, PresetPatch } from '@/lib/presets/preset-schema'

import { idbStorage } from './project-store'

export const PRESET_STORAGE_NAME = 'edugistics-presets'

/** Built-in presets, kept out of persisted user data entirely so a bad merge can never corrupt them. */
const BUILT_IN_PRESETS: Preset[] = [BRITISH_CURRICULUM_EGYPT_PRESET]

interface PresetState {
  presets: Record<string, Preset>
  savePreset: (name: string, patch: PresetPatch, description?: string) => string
  deletePreset: (id: string) => void
}

export const usePresetStore = create<PresetState>()(
  persist(
    (set) => ({
      presets: {},

      savePreset: (name, patch, description) => {
        const id = globalThis.crypto.randomUUID()
        set((state) => ({ presets: { ...state.presets, [id]: { id, name, description, patch } } }))
        return id
      },

      deletePreset: (id) =>
        set((state) => {
          const rest = { ...state.presets }
          delete rest[id]
          return { presets: rest }
        }),
    }),
    {
      name: PRESET_STORAGE_NAME,
      storage: createJSONStorage(() => idbStorage),
    },
  ),
)

/** All presets available to apply — built-ins first, then the user's saved ones. */
export function useAllPresets(): Preset[] {
  const userPresets = usePresetStore((state) => state.presets)
  return [...BUILT_IN_PRESETS, ...Object.values(userPresets)]
}
