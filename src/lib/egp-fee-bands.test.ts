import { describe, expect, it } from 'vitest'

import { EGP_ANNUAL_TUITION_BANDS, interpolateFeeLadder } from './egp-fee-bands'
import type { YearGroupId } from '@/domain/schema'

describe('interpolateFeeLadder', () => {
  it('starts at the band low and ends at the band high, rounded to the nearest 500', () => {
    const groups: YearGroupId[] = ['FS1', 'FS2', 'Y1', 'Y2', 'IGCSE_Y12']
    const ladder = interpolateFeeLadder('midMarket', groups)
    expect(ladder.FS1).toBe(EGP_ANNUAL_TUITION_BANDS.midMarket.low)
    expect(ladder.IGCSE_Y12).toBe(EGP_ANNUAL_TUITION_BANDS.midMarket.high)
  })

  it('is monotonically non-decreasing across the ladder', () => {
    const groups: YearGroupId[] = ['FS1', 'FS2', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'IGCSE_Y9', 'IGCSE_Y10', 'IGCSE_Y11', 'IGCSE_Y12']
    const ladder = interpolateFeeLadder('premium', groups)
    const values = groups.map((group) => ladder[group])
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!)
    }
  })

  it('rounds every value to the nearest 500', () => {
    const groups: YearGroupId[] = ['FS1', 'Y1', 'Y4', 'IGCSE_Y12']
    const ladder = interpolateFeeLadder('luxury', groups)
    for (const group of groups) {
      expect(ladder[group] % 500).toBe(0)
    }
  })

  it('handles a single year group by using the band low', () => {
    const ladder = interpolateFeeLadder('budget', ['Y1'])
    expect(ladder.Y1).toBe(EGP_ANNUAL_TUITION_BANDS.budget.low)
  })

  it('handles an empty year group list without throwing', () => {
    expect(() => interpolateFeeLadder('budget', [])).not.toThrow()
  })
})
