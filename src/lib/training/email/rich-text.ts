import { escapeHtml } from './html'

// `button:` is an optional prefix on the label so the same bracket-link
// syntax can express either an inline text link, `[label](url)`, or a
// call-to-action button, `[button:label](url)` — see BUTTON_LINE_PATTERN
// below for how a button gets its own table markup instead of an inline
// <a>. Kept optional here (rather than a wholly separate pattern) so a
// button link mistakenly left mid-sentence still degrades to a normal
// clickable link instead of surviving as literal bracket syntax.
const LINK_PATTERN = /\[(?:button:)?([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g
const BOLD_PATTERN = /\*\*([^*]+)\*\*/g
const ITALIC_PATTERN = /\*([^*]+)\*/g

// A button link only renders as an actual button when it's alone on its own
// line (its own paragraph) — same requirement in both the HTML and the
// plain-text output, so the two versions stay in visual/semantic step. `$`
// anchors against the *trimmed* line, so trailing whitespace doesn't
// disqualify it.
const BUTTON_LINE_PATTERN = /^\[button:([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)$/

/** Builds the markdown-lite source for a call-to-action button — see BUTTON_LINE_PATTERN. Must be the only content on its own line/paragraph to render as a button rather than an inline link. */
export function buildButtonLinkMarkdown(label: string, url: string): string {
  return `[button:${label}](${url})`
}

function parseButtonLine(line: string): { label: string; url: string } | null {
  const match = BUTTON_LINE_PATTERN.exec(line.trim())
  if (!match) return null
  return { label: match[1]!, url: match[2]! }
}

function isBulletLine(line: string): boolean {
  return /^-\s+/.test(line.trim())
}

function stripBullet(line: string): string {
  return line.trim().replace(/^-\s+/, '')
}

function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

/**
 * The composer's restricted formatting — bold, italic, bullet lines, links
 * and paragraphs, nothing more. Every line is HTML-escaped first, then the
 * markdown-style patterns are applied on the escaped text, so raw
 * admin-authored text can never inject markup, and links are restricted to
 * http(s)/mailto schemes.
 */
function renderInlineHtml(rawLine: string): string {
  const escaped = escapeHtml(rawLine)
  return escaped
    .replace(LINK_PATTERN, (_match, text: string, url: string) => `<a href="${url}" style="color:#3e8e96;">${text}</a>`)
    .replace(BOLD_PATTERN, '<strong>$1</strong>')
    .replace(ITALIC_PATTERN, '<em>$1</em>')
}

/**
 * Bulletproof (table-based) button markup — the standard pattern for a
 * background-coloured, clickable call-to-action that survives Outlook's
 * Word rendering engine, which is unreliable with padding/border-radius on
 * a bare <div> or <a>. `bgcolor` is set as both an HTML attribute and a CSS
 * property for the same reason: some Outlook versions honour one but not
 * the other. `label` and `url` are expected already HTML-escaped by the
 * caller (see renderCampaignBodyHtml) — the URL itself is never altered,
 * only escaped for safe placement inside the href attribute (e.g. a literal
 * `&` becomes `&amp;`, which any HTML parser decodes back to the same URL).
 */
function renderButtonHtml(label: string, url: string): string {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">' +
    '<tr>' +
    '<td align="center" bgcolor="#3e8e96" style="border-radius:6px;background-color:#3e8e96;">' +
    `<a href="${url}" target="_blank" rel="noopener noreferrer" ` +
    'style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;' +
    `font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>` +
    '</td>' +
    '</tr>' +
    '</table>'
  )
}

export function renderCampaignBodyHtml(body: string): string {
  const blocks = splitParagraphs(body)

  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((line) => line.trim() !== '')

      if (lines.length === 1) {
        const button = parseButtonLine(escapeHtml(lines[0]!))
        if (button) return renderButtonHtml(button.label, button.url)
      }

      if (lines.length > 0 && lines.every(isBulletLine)) {
        const items = lines.map((line) => `<li style="margin:0 0 4px 0;">${renderInlineHtml(stripBullet(line))}</li>`).join('')
        return `<ul style="margin:0 0 12px 0;padding-left:20px;">${items}</ul>`
      }
      return `<p style="margin:0 0 12px 0;">${lines.map(renderInlineHtml).join('<br>')}</p>`
    })
    .join('\n')
}

function renderInlineText(rawLine: string): string {
  return rawLine
    .replace(LINK_PATTERN, (_match, text: string, url: string) => `${text} (${url})`)
    .replace(BOLD_PATTERN, '$1')
    .replace(ITALIC_PATTERN, '$1')
}

export function renderCampaignBodyText(body: string): string {
  const blocks = splitParagraphs(body)

  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((line) => line.trim() !== '')

      if (lines.length === 1) {
        const button = parseButtonLine(lines[0]!)
        // The plain-text alternative must carry the full raw URL on its own
        // line, untouched — no wrapping, shortening or rewriting — since a
        // text-only mail client has no button to click.
        if (button) return `${button.label}: ${button.url}`
      }

      return lines.map((line) => (isBulletLine(line) ? `- ${renderInlineText(stripBullet(line))}` : renderInlineText(line))).join('\n')
    })
    .join('\n\n')
}
