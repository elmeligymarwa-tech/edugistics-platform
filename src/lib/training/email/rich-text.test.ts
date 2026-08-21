import { describe, expect, it } from 'vitest'

import { buildButtonLinkMarkdown, renderCampaignBodyHtml, renderCampaignBodyText } from './rich-text'

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

  // Defect 3: a link inserted into a campaign rendered as plain text —
  // specifically, an unwrapped Zoom URL, invisible to the markdown-lite
  // link pattern entirely, so it was never clickable at all.
  describe('button links', () => {
    it('renders a button link alone on its own line as table-based markup, not a bare <a>', () => {
      const body = `Join us live.\n\n${buildButtonLinkMarkdown('Join Webinar', 'https://zoom.us/j/12345')}\n\nSee you there.`
      const html = renderCampaignBodyHtml(body)

      expect(html).toContain('<table')
      expect(html).toContain('<td')
      expect(html).toContain('href="https://zoom.us/j/12345"')
      expect(html).toContain('>Join Webinar</a>')
      // Table-based, not a div/CSS button — Outlook's Word engine is
      // unreliable with padding/border-radius on a bare <div> or <a>.
      expect(html).not.toContain('<div')
    })

    it('preserves the URL exactly — no wrapping, shortening, or rewriting', () => {
      const url = 'https://zoom.us/j/98765?pwd=aBcD123&ref=training'
      const html = renderCampaignBodyHtml(buildButtonLinkMarkdown('Join Webinar', url))
      // & must be escaped for safe placement in the href attribute — this
      // is not a rewrite, it decodes back to the identical URL.
      expect(html).toContain(`href="${url.replace('&', '&amp;')}"`)
    })

    it('uses the given label, defaulting callers are expected to pass "Join Webinar" themselves', () => {
      const html = renderCampaignBodyHtml(buildButtonLinkMarkdown('Register Now', 'https://example.com/register'))
      expect(html).toContain('>Register Now</a>')
    })

    it('a button-syntax link left mid-paragraph degrades to a normal clickable link, not literal brackets', () => {
      const html = renderCampaignBodyHtml(`Click here: ${buildButtonLinkMarkdown('Join Webinar', 'https://zoom.us/j/1')} to join.`)
      expect(html).not.toContain('<table')
      expect(html).not.toContain('[button:')
      expect(html).toContain('<a href="https://zoom.us/j/1"')
      expect(html).toContain('>Join Webinar</a>')
    })
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

  describe('button links', () => {
    it('puts the full raw URL on its own line, labelled', () => {
      const body = `Join us live.\n\n${buildButtonLinkMarkdown('Join Webinar', 'https://zoom.us/j/12345')}\n\nSee you there.`
      const text = renderCampaignBodyText(body)
      const lines = text.split('\n')

      expect(lines).toContain('Join Webinar: https://zoom.us/j/12345')
    })

    it('never alters the URL', () => {
      const url = 'https://zoom.us/j/98765?pwd=aBcD123&ref=training'
      const text = renderCampaignBodyText(buildButtonLinkMarkdown('Join Webinar', url))
      expect(text).toBe(`Join Webinar: ${url}`)
    })
  })
})
