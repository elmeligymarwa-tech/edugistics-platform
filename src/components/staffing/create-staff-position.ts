import type { StaffPosition } from '@/domain/schema'

export function createStaffPosition(
  overrides: Partial<StaffPosition> & { title: string; section: StaffPosition['section'] },
): StaffPosition {
  return {
    id: overrides.id ?? globalThis.crypto.randomUUID(),
    title: overrides.title,
    section: overrides.section,
    derivedFromCapacity: false,
    manualOverride: false,
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
    monthsWorked: overrides.monthsWorked ?? 12,
  }
}
