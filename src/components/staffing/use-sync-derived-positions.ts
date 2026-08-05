'use client'

import { useEffect } from 'react'

import { derivedTeachingHeadcount } from '@/engine/costs'
import type { Project, StaffPosition } from '@/domain/schema'
import { useProjectStore } from '@/store/project-store'

const DERIVED_POSITIONS: Array<{
  id: string
  title: string
  field: 'teachers' | 'teachingAssistants' | 'coTeachers'
}> = [
  { id: 'derived-teachers', title: 'Teachers', field: 'teachers' },
  { id: 'derived-teaching-assistants', title: 'Teaching Assistants', field: 'teachingAssistants' },
  { id: 'derived-co-teachers', title: 'Co-Teachers', field: 'coTeachers' },
]

export function createStaffPosition(
  overrides: Partial<StaffPosition> & { title: string; section: StaffPosition['section'] },
): StaffPosition {
  return {
    id: overrides.id ?? globalThis.crypto.randomUUID(),
    title: overrides.title,
    section: overrides.section,
    derivedFromCapacity: overrides.derivedFromCapacity ?? false,
    manualOverride: overrides.manualOverride ?? false,
    headcount: overrides.headcount ?? 0,
    averageSalary: overrides.averageSalary ?? 0,
    minimumSalary: overrides.minimumSalary ?? 0,
    maximumSalary: overrides.maximumSalary ?? 0,
    annualIncrementPct: overrides.annualIncrementPct ?? 0,
    employerTaxPct: overrides.employerTaxPct ?? 0,
    nationalInsurancePct: overrides.nationalInsurancePct ?? 0,
    medicalInsurancePct: overrides.medicalInsurancePct ?? 0,
    pensionPct: overrides.pensionPct ?? 0,
    housingAllowance: overrides.housingAllowance ?? 0,
    transportAllowance: overrides.transportAllowance ?? 0,
    recruitmentCost: overrides.recruitmentCost ?? 0,
    trainingCost: overrides.trainingCost ?? 0,
  }
}

/**
 * Keeps the three capacity-derived staffing positions (Teachers, Teaching
 * Assistants, Co-Teachers) in sync with capacity planning, unless a position
 * has been manually overridden. Shared by the setup wizard's staffing step
 * and the Staffing & Payroll page so the sync logic exists in one place.
 */
export function useSyncDerivedPositions(project: Project): void {
  const updateStaffing = useProjectStore((state) => state.updateStaffing)

  const positionSignature = project.staffing.positions
    .map((position) => `${position.id}:${position.manualOverride}`)
    .join(',')

  useEffect(() => {
    const sums = derivedTeachingHeadcount(project)

    let positions = project.staffing.positions
    let changed = false

    for (const derived of DERIVED_POSITIONS) {
      const target = sums[derived.field]
      const existing = positions.find((position) => position.id === derived.id)
      if (!existing) {
        positions = [
          ...positions,
          createStaffPosition({
            id: derived.id,
            title: derived.title,
            section: 'teaching',
            derivedFromCapacity: true,
            headcount: target,
          }),
        ]
        changed = true
      } else if (!existing.manualOverride && existing.headcount !== target) {
        positions = positions.map((position) =>
          position.id === derived.id ? { ...position, headcount: target } : position,
        )
        changed = true
      }
    }

    if (changed) updateStaffing(project.id, { positions })
    // Re-runs only when capacity, the selected year groups, or override flags change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, JSON.stringify(project.capacity), project.yearGroups.join(','), positionSignature])
}
