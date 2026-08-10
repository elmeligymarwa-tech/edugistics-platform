import { describe, expect, it } from 'vitest'

import { buildListUnsubscribeHeaders } from './marketing-headers'

describe('buildListUnsubscribeHeaders', () => {
  it('sets List-Unsubscribe with both the URL and a mailto fallback', () => {
    const headers = buildListUnsubscribeHeaders('https://edugistics.online/unsubscribe?token=abc123', 'info@edugistics.online')
    expect(headers['List-Unsubscribe']).toBe('<https://edugistics.online/unsubscribe?token=abc123>, <mailto:info@edugistics.online>')
  })

  it('sets List-Unsubscribe-Post for one-click unsubscribe', () => {
    const headers = buildListUnsubscribeHeaders('https://edugistics.online/unsubscribe?token=abc123', 'info@edugistics.online')
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})
