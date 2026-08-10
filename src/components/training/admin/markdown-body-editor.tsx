'use client'

import { useRef, type ReactNode } from 'react'
import { Bold, Italic, Link as LinkIcon, List } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * The one editor behind every markdown-lite message body in this
 * application (the bulk registration-email composer and the subscriber
 * marketing composer both use it) — a plain textarea plus a toolbar that
 * wraps the current selection in the same bold/italic/bullet/link syntax
 * src/lib/training/email/rich-text.ts renders. Never duplicate this: a
 * second composer gets a second instance of this hook, not a second
 * implementation.
 */
export function useMarkdownBodyEditor(setBody: (updater: (current: string) => string) => void) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  function replaceSelection(before: string, after: string, placeholderIfEmpty: string) {
    const el = textareaRef.current
    if (!el) {
      setBody((current) => current + before + placeholderIfEmpty + after)
      return
    }
    const { selectionStart, selectionEnd, value } = el
    const selected = value.slice(selectionStart, selectionEnd) || placeholderIfEmpty
    const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
    setBody(() => next)
    const cursorStart = selectionStart + before.length
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = cursorStart
      el.selectionEnd = cursorStart + selected.length
    })
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current
    if (!el) {
      setBody((current) => current + text)
      return
    }
    const { selectionStart, selectionEnd, value } = el
    const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd)
    setBody(() => next)
    const cursor = selectionStart + text.length
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = cursor
    })
  }

  function insertBulletList() {
    const el = textareaRef.current
    if (!el) {
      setBody((current) => `${current}\n- list item`)
      return
    }
    const { selectionStart, selectionEnd, value } = el
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const lineEndIndex = value.indexOf('\n', selectionEnd)
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
    const block = value.slice(lineStart, lineEnd) || 'list item'
    const bulleted = block
      .split('\n')
      .map((line) => `- ${line.replace(/^-\s*/, '')}`)
      .join('\n')
    setBody(() => value.slice(0, lineStart) + bulleted + value.slice(lineEnd))
  }

  return { textareaRef, replaceSelection, insertAtCursor, insertBulletList }
}

export function MarkdownEditorToolbar({
  onBold,
  onItalic,
  onBulletList,
  onLink,
  extra,
}: {
  onBold: () => void
  onItalic: () => void
  onBulletList: () => void
  onLink: () => void
  extra?: ReactNode
}) {
  return (
    <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-input bg-muted/40 p-1">
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Bold" onClick={onBold}>
        <Bold />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Italic" onClick={onItalic}>
        <Italic />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Bullet list" onClick={onBulletList}>
        <List />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Link" onClick={onLink}>
        <LinkIcon />
      </Button>
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  )
}
