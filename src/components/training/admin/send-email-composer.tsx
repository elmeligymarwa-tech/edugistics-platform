'use client'

import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Link as LinkIcon, List } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getDefaultCampaignTemplate } from '@/domain/training/campaign-templates'
import { PERSONALIZATION_TOKENS } from '@/domain/training/personalization'
import { CAMPAIGN_EMAIL_TYPE_LABELS, CampaignEmailType } from '@/domain/training/schema'
import {
  getTemplateForSelectionAction,
  previewCampaignAction,
  type CampaignPreview,
  type RecipientCriteriaInput,
  type RecipientSummary,
} from '@/app/training/admin/(protected)/registrations/email-actions'

const TEMPLATE_OPTIONS: SelectOption[] = CampaignEmailType.options.map((value) => ({
  value,
  label: CAMPAIGN_EMAIL_TYPE_LABELS[value],
}))

interface SendEmailComposerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  criteria: RecipientCriteriaInput
  initialSummary: RecipientSummary
}

export function SendEmailComposer({ open, onOpenChange, criteria, initialSummary }: SendEmailComposerProps) {
  const [step, setStep] = useState<'compose' | 'preview'>('compose')
  const [emailType, setEmailType] = useState<CampaignEmailType>('CUSTOM')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [overrideApplied, setOverrideApplied] = useState(false)
  const [subjectError, setSubjectError] = useState<string | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!open) {
      setStep('compose')
      setPreview(null)
      setPreviewError(null)
      setConfirmationInput('')
    }
  }, [open])

  async function handleTemplateChange(nextType: CampaignEmailType) {
    setEmailType(nextType)
    const fallback = getDefaultCampaignTemplate(nextType)
    setSubject(fallback.subject)
    setBody(fallback.body)
    setOverrideApplied(false)

    const result = await getTemplateForSelectionAction(nextType, criteria)
    if (result.success) {
      setSubject(result.data.subject)
      setBody(result.data.body)
      setOverrideApplied(result.data.overrideApplied)
    }
  }

  function replaceSelection(before: string, after: string, placeholderIfEmpty: string) {
    const el = textareaRef.current
    if (!el) {
      setBody((current) => current + before + placeholderIfEmpty + after)
      return
    }
    const { selectionStart, selectionEnd, value } = el
    const selected = value.slice(selectionStart, selectionEnd) || placeholderIfEmpty
    const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
    setBody(next)
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
    setBody(next)
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
    setBody(value.slice(0, lineStart) + bulleted + value.slice(lineEnd))
  }

  const multiCourse = initialSummary.courses.length > 1
  const zoomDisabledReason = multiCourse
    ? 'Selection spans multiple courses — insert the {{zoomLink}} token instead so it resolves per recipient.'
    : !initialSummary.singleCourseZoomLink
      ? 'This course has no Zoom link stored.'
      : null

  async function handleContinueToPreview() {
    setSubjectError(null)
    setBodyError(null)
    setPreviewError(null)
    setLoadingPreview(true)
    const result = await previewCampaignAction(criteria, { subject, body })
    setLoadingPreview(false)
    if (!result.success) {
      setPreviewError(result.error)
      if (result.fieldErrors?.subject) setSubjectError(result.fieldErrors.subject)
      if (result.fieldErrors?.body) setBodyError(result.fieldErrors.body)
      return
    }
    setPreview(result.data)
    setStep('preview')
  }

  const confirmationMatches = preview !== null && confirmationInput.trim() === String(preview.uniqueTeacherCount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                <p className="text-sm text-foreground">
                  {initialSummary.rawRegistrationCount === initialSummary.uniqueTeacherCount
                    ? `${initialSummary.uniqueTeacherCount} teacher${initialSummary.uniqueTeacherCount === 1 ? '' : 's'}`
                    : `${initialSummary.rawRegistrationCount} registrations, ${initialSummary.uniqueTeacherCount} unique teachers`}
                </p>
              </Field>

              {multiCourse && (
                <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                  This selection spans {initialSummary.courses.length} courses (
                  {initialSummary.courses.map((course) => course.name).join(', ')}). Course-specific fields such as{' '}
                  {'{{courseName}}'}, {'{{courseDate}}'}, {'{{courseTime}}'} and {'{{zoomLink}}'} resolve per recipient
                  from their own registration, not from a single course.
                </p>
              )}

              <Field>
                <FieldLabel htmlFor="composer-template">Template</FieldLabel>
                <Select
                  id="composer-template"
                  items={TEMPLATE_OPTIONS}
                  value={emailType}
                  onValueChange={(value) => void handleTemplateChange(value as CampaignEmailType)}
                />
                {overrideApplied && (
                  <p className="text-xs text-muted-foreground">Using this course&apos;s saved reminder text.</p>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="composer-subject">Subject</FieldLabel>
                <Input
                  id="composer-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  aria-invalid={Boolean(subjectError)}
                />
                <FieldError>{subjectError}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="composer-body">Message</FieldLabel>
                <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-input bg-muted/40 p-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Bold" onClick={() => replaceSelection('**', '**', 'bold text')}>
                    <Bold />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Italic" onClick={() => replaceSelection('*', '*', 'italic text')}>
                    <Italic />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Bullet list" onClick={insertBulletList}>
                    <List />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Link"
                    onClick={() => replaceSelection('[', '](https://)', 'link text')}
                  >
                    <LinkIcon />
                  </Button>
                  <div className="ml-auto">
                    {zoomDisabledReason ? (
                      <Tooltip>
                        <TooltipTrigger render={<span />}>
                          <Button type="button" variant="ghost" size="sm" disabled>
                            Insert Zoom Link
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{zoomDisabledReason}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => insertAtCursor(initialSummary.singleCourseZoomLink ?? '')}
                      >
                        Insert Zoom Link
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  id="composer-body"
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
                  Available tokens — each resolves per recipient when the email is sent:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PERSONALIZATION_TOKENS.map((token) => (
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleContinueToPreview} disabled={loadingPreview}>
                {loadingPreview ? 'Preparing preview…' : 'Continue to preview'}
              </Button>
            </DialogFooter>
          </>
        ) : preview ? (
          <>
            <DialogHeader>
              <DialogTitle>Preview</DialogTitle>
              <DialogDescription>Review carefully — sending cannot be undone.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {preview.zoomLinkMissingCount > 0 && (
                <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                  This message includes the Zoom link token, but {preview.zoomLinkMissingCount} recipient
                  {preview.zoomLinkMissingCount === 1 ? '' : 's'} have no Zoom link stored for their course. They will
                  receive an empty joining link.
                </p>
              )}

              <p className="text-sm text-foreground">
                You are about to send this email to <strong>{preview.uniqueTeacherCount} teachers</strong>
                {preview.rawRegistrationCount !== preview.uniqueTeacherCount
                  ? ` (${preview.rawRegistrationCount} registrations, de-duplicated by teacher)`
                  : ''}
                .
              </p>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Courses included</p>
                <p className="text-sm text-foreground">{preview.courses.map((course) => course.name).join(', ')}</p>
              </div>

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
                <p className="text-xs font-medium text-muted-foreground">Example — resolved for {preview.example.recipientName}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{preview.example.subject}</p>
                <div
                  className="mt-1 text-sm text-foreground"
                  dangerouslySetInnerHTML={{ __html: preview.example.html }}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Each teacher receives a separate, individually addressed email. Sending cannot be undone.
              </p>

              <Field>
                <FieldLabel htmlFor="composer-confirm">
                  Type <strong>{preview.uniqueTeacherCount}</strong> to confirm the recipient count
                </FieldLabel>
                <Input
                  id="composer-confirm"
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
                    Sending available in the next phase
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sending is built in a later phase — this button is intentionally disabled.</TooltipContent>
              </Tooltip>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
