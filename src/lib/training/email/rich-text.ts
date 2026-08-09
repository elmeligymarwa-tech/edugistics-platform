import { escapeHtml } from './html'

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g
const BOLD_PATTERN = /\*\*([^*]+)\*\*/g
const ITALIC_PATTERN = /\*([^*]+)\*/g

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

export function renderCampaignBodyHtml(body: string): string {
  const blocks = splitParagraphs(body)

  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((line) => line.trim() !== '')
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
      return lines.map((line) => (isBulletLine(line) ? `- ${renderInlineText(stripBullet(line))}` : renderInlineText(line))).join('\n')
    })
    .join('\n\n')
}
