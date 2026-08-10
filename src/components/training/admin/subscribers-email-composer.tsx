'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MARKETING_PERSONALIZATION_TOKENS } from '@/domain/training/personalization'
import {
  previewMarketingEmailAction,
  type MarketingEmailPreview,
} from '@/app/training/admin/(protected)/subscribers/actions'
import type { SubscriberCriteriaInput } from '@/lib/training/subscriber-criteria'
import type { MarketingTemplateListItem } from '@/lib/training/marketing-templates'
import { MarkdownEditorToolbar, useMarkdownBodyEditor } from './markdown-body-editor'

const BLANK_TEMPLATE_VALUE = 'BLANK'

type Step = 'compose' | 'preview'

export function SubscribersEmailComposer({
  open,
  onOpenChange,
  criteria,
  templates,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  criteria: SubscriberCriteriaInput
  templates: MarketingTemplateListItem[]
}) {
  const [step, setStep] = useState<Step>('compose')
  const [templateId, setTemplateId] = useState(BLANK_TEMPLATE_VALUE)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [subjectError, setSubjectError] = useState<string | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MarketingEmailPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState('')

  const { textareaRef, replaceSelection, insertAtCursor, insertBulletList } = useMarkdownBodyEditor(setBody)

  function reset() {
    setStep('compose')
    setPreview(null)
    setPreviewError(null)
    setConfirmationInput('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  const templateOptions: SelectOption[] = [
    { value: BLANK_TEMPLATE_VALUE, label: 'Blank' },
    ...templates.map((template) => ({ value: template.id, label: template.name })),
  ]

  function handleTemplateChange(value: string) {
    setTemplateId(value)
    if (value === BLANK_TEMPLATE_VALUE) {
      setSubject('')
      setBody('')
      return
    }
    const template = templates.find((item) => item.id === value)
    if (template) {
      setSubject(template.subject)
      setBody(template.bodyTemplate)
    }
  }

  async function handleContinueToPreview() {
    setSubjectError(null)
    setBodyError(null)
    setPreviewError(null)
    setLoadingPreview(true)
    const result = await previewMarketingEmailAction(criteria, { subject, body })
    setLoadingPreview(false)
    if (!result.success) {
      setPreviewError(result.error)
      if (result.fieldErrors?.subject) setSubjectError(result.fieldErrors.subject)
      if (result.fieldErrors?.body) setBodyError(result.fieldErrors.body)
      return
    }
    setPreview(result.data)
    setConfirmationInput('')
    setStep('preview')
  }

  const confirmationMatches = preview !== null && confirmationInput.trim() === String(preview.recipientCount)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" showClose>
        {step === 'compose' ? (
          <>
            <DialogHeader>
              <DialogTitle>Send Email</DialogTitle>
              <DialogDescription>Opening this composer never sends anything.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel>To</FieldLabel>
                <p className="text-sm text-foreground">Subscribed contacts matching your current selection.</p>
              </Field>

              <Field>
                <FieldLabel htmlFor="marketing-composer-template">Template</FieldLabel>
                <Select id="marketing-composer-template" items={templateOptions} value={templateId} onValueChange={handleTemplateChange} />
              </Field>

              <Field>
                <FieldLabel htmlFor="marketing-composer-subject">Subject</FieldLabel>
                <Input
                  id="marketing-composer-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  aria-invalid={Boolean(subjectError)}
                />
                <FieldError>{subjectError}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="marketing-composer-body">Message</FieldLabel>
                <MarkdownEditorToolbar
                  onBold={() => replaceSelection('**', '**', 'bold text')}
                  onItalic={() => replaceSelection('*', '*', 'italic text')}
                  onBulletList={insertBulletList}
                  onLink={() => replaceSelection('[', '](https://)', 'link text')}
                />
                <Textarea
                  id="marketing-composer-body"
                  ref={textareaRef}
                  rows={10}
                  className="rounded-t-none"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  aria-invalid={Boolean(bodyError)}
                />
                <FieldError>{bodyError}</FieldError>
              </Field>

              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Available tokens — each resolves per recipient. An unsubscribe link, the Edugistics name and a
                  contact address are added automatically to every email; you never need to include them yourself.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MARKETING_PERSONALIZATION_TOKENS.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => insertAtCursor(`{{${token}}}`)}
                      className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground hover:bg-muted"
                    >
                      {`{{${token}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {previewError && <FieldError>{previewError}</FieldError>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleContinueToPreview} disabled={loadingPreview}>
                {loadingPreview ? 'Preparing preview…' : 'Continue to preview'}
              </Button>
            </DialogFooter>
          </>
        ) : step === 'preview' && preview ? (
          <>
            <DialogHeader>
              <DialogTitle>Preview</DialogTitle>
              <DialogDescription>Review carefully — sending cannot be undone.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <p className="text-sm text-foreground">
                You are about to send this email to <strong>{preview.recipientCount} subscriber{preview.recipientCount === 1 ? '' : 's'}</strong> —
                every one of them subscribed, by definition.
              </p>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Subject</p>
                <p className="text-sm text-foreground">{subject}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Message</p>
                <div
                  className="rounded-lg border border-border bg-background p-3 text-sm text-foreground"
                  dangerouslySetInnerHTML={{ __html: preview.renderedBodyHtml }}
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Full rendered email, including the footer — example resolved for {preview.example.recipientName}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">{preview.example.subject}</p>
                <div className="mt-1 text-sm text-foreground" dangerouslySetInnerHTML={{ __html: preview.example.html }} />
              </div>

              <p className="text-sm text-muted-foreground">
                Each recipient receives a separate, individually addressed email. Sending cannot be undone.
              </p>

              <Field>
                <FieldLabel htmlFor="marketing-composer-confirm">
                  Type <strong>{preview.recipientCount}</strong> to confirm the recipient count
                </FieldLabel>
                <Input
                  id="marketing-composer-confirm"
                  value={confirmationInput}
                  onChange={(event) => setConfirmationInput(event.target.value)}
                  inputMode="numeric"
                />
                {confirmationInput.length > 0 && (
                  <p className={`text-xs ${confirmationMatches ? 'text-success' : 'text-destructive'}`}>
                    {confirmationMatches ? 'Matches.' : 'Does not match yet.'}
                  </p>
                )}
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('compose')}>
                Back
              </Button>
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button type="button" disabled>
                    Send
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sending available in the next phase.</TooltipContent>
              </Tooltip>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
