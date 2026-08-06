import type { FeeCategory, StaffPosition } from '@/domain/schema'
import type { OpexCategory } from '@/domain/costs'
import type { FeePositioning } from '@/lib/egp-fee-bands'

/**
 * A preset is a wrapper envelope around a *partial, mergeable* patch — never
 * a full Project/CostModel. Applying one goes through the same store update
 * actions the grids use (updateFees/updateStaffing/updateOpex/...), one call
 * per section, so it can never stomp fields the user has already entered
 * (school name, curriculum, capacity) and never bypasses schema validation.
 */
export interface PresetFees {
  categories: FeeCategory[]
  /**
   * Preferred: a fee positioning interpolated against whatever year groups
   * the target project actually has, so the preset adapts instead of
   * assuming a fixed set of groups. The interpolated ladder is written onto
   * the category whose escalationGroup is 'tuition'.
   */
  feePositioning?: FeePositioning
  /** Fallback fixed amounts, used when a preset was captured from a live project rather than generated from a positioning. */
  amounts?: Record<string, Record<string, number>>
}

export interface PresetStaffing {
  /** Positions get a fresh id on apply — these are templates, not literal records. */
  positions: StaffPosition[]
}

export interface PresetPatch {
  fees?: PresetFees
  staffing?: PresetStaffing
  opex?: OpexCategory[]
  revenueAssumptions?: {
    tuitionEscalationPct?: number
    otherFeeEscalationPct?: number
  }
}

export interface Preset {
  id: string
  name: string
  description?: string
  /** Built-in presets aren't user-deletable and are merged in at read time, never persisted as user data. */
  builtIn?: boolean
  patch: PresetPatch
}
