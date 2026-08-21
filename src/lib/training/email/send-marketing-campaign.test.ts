// Unit tests for mapBatchResponseToOutcomes — the piece of defect 1's fix
// most likely to silently misattribute a send outcome to the wrong
// recipient if the index bookkeeping is wrong. Pure function, no Prisma, no
// Resend client, no database: safe to run via `npm run test:marketing-batch`
// (vitest.marketing-batch.config.mts), which has no globalSetup.
import { describe, expect, it } from 'vitest'

import { mapBatchResponseToOutcomes } from './send-marketing-campaign'

const recipients = [
  { recipientId: 'r1', subscriberId: 's1' },
  { recipientId: 'r2', subscriberId: 's2' },
  { recipientId: 'r3', subscriberId: 's3' },
  { recipientId: 'r4', subscriberId: 's4' },
]

describe('mapBatchResponseToOutcomes', () => {
  it('maps every recipient to its message id when nothing fails', () => {
    const data = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }]
    const outcomes = mapBatchResponseToOutcomes(recipients, data, [])

    expect(outcomes).toEqual([
      { recipientId: 'r1', subscriberId: 's1', ok: true, messageId: 'm1' },
      { recipientId: 'r2', subscriberId: 's2', ok: true, messageId: 'm2' },
      { recipientId: 'r3', subscriberId: 's3', ok: true, messageId: 'm3' },
      { recipientId: 'r4', subscriberId: 's4', ok: true, messageId: 'm4' },
    ])
  })

  it('attributes a validation error to the recipient at that original index, not by position in data', () => {
    // r2 (index 1) is rejected — `data` only ever contains the three that
    // succeeded, in their original relative order.
    const data = [{ id: 'm1' }, { id: 'm3' }, { id: 'm4' }]
    const errors = [{ index: 1, message: 'Invalid `to` field' }]
    const outcomes = mapBatchResponseToOutcomes(recipients, data, errors)

    expect(outcomes).toEqual([
      { recipientId: 'r1', subscriberId: 's1', ok: true, messageId: 'm1' },
      { recipientId: 'r2', subscriberId: 's2', ok: false, error: 'Invalid `to` field' },
      { recipientId: 'r3', subscriberId: 's3', ok: true, messageId: 'm3' },
      { recipientId: 'r4', subscriberId: 's4', ok: true, messageId: 'm4' },
    ])
  })

  it('handles a failure at the first index without shifting every later recipient off by one', () => {
    const data = [{ id: 'm2' }, { id: 'm3' }, { id: 'm4' }]
    const errors = [{ index: 0, message: 'Invalid `to` field' }]
    const outcomes = mapBatchResponseToOutcomes(recipients, data, errors)

    expect(outcomes[0]).toEqual({ recipientId: 'r1', subscriberId: 's1', ok: false, error: 'Invalid `to` field' })
    expect(outcomes[1]).toEqual({ recipientId: 'r2', subscriberId: 's2', ok: true, messageId: 'm2' })
    expect(outcomes[3]).toEqual({ recipientId: 'r4', subscriberId: 's4', ok: true, messageId: 'm4' })
  })

  it('handles multiple scattered failures', () => {
    const data = [{ id: 'm2' }, { id: 'm4' }]
    const errors = [
      { index: 0, message: 'bad address' },
      { index: 2, message: 'bad address' },
    ]
    const outcomes = mapBatchResponseToOutcomes(recipients, data, errors)

    expect(outcomes.map((o) => o.ok)).toEqual([false, true, false, true])
    expect(outcomes[1]).toMatchObject({ recipientId: 'r2', messageId: 'm2' })
    expect(outcomes[3]).toMatchObject({ recipientId: 'r4', messageId: 'm4' })
  })

  it('fails a recipient explicitly rather than crashing if data runs out unexpectedly', () => {
    const data = [{ id: 'm1' }]
    const outcomes = mapBatchResponseToOutcomes(recipients, data, [])

    expect(outcomes[0]).toEqual({ recipientId: 'r1', subscriberId: 's1', ok: true, messageId: 'm1' })
    expect(outcomes[1].ok).toBe(false)
    expect(outcomes[1].error).toMatch(/no result/i)
  })

  it('returns an empty list for an empty batch', () => {
    expect(mapBatchResponseToOutcomes([], [], [])).toEqual([])
  })
})
