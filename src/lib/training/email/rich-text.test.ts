import { describe, expect, it } from 'vitest'

import { renderCampaignBodyHtml, renderCampaignBodyText } from './rich-text'

describe('renderCampaignBodyHtml', () => {
  it('renders bold, italic, bullet lists, links and paragraphs', () => {
    const body = `Hi there,

This is **bold** and this is *italic*.

- First item
- Second item

Visit [our site](https://example.com) for more.`

    const html = renderCampaignBodyHtml(body)
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<ul')
    expect(html).toContain('<li')
    expect(html).toContain('<a href="https://example.com"')
    expect(html).toContain('<p')
  })

  it('escapes raw HTML instead of rendering it', () => {
    const html = renderCampaignBodyHtml('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('only allows http(s) and mailto links, never javascript: URLs', () => {
    const html = renderCampaignBodyHtml('[click me](javascript:alert(1))')
    expect(html).not.toContain('<a href="javascript:')
  })
})

describe('renderCampaignBodyText', () => {
  it('strips markdown syntax for the plain-text version', () => {
    const text = renderCampaignBodyText('**bold** and *italic* and [a link](https://example.com)')
    expect(text).toBe('bold and italic and a link (https://example.com)')
  })

  it('keeps bullet lines readable as plain text', () => {
    const text = renderCampaignBodyText('- one\n- two')
    expect(text).toBe('- one\n- two')
  })
})
