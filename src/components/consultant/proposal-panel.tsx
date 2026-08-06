'use client'

import { useMemo, useState } from 'react'
import { Check, Undo2, X } from 'lucide-react'

import type { CostModel } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import { applyConsultantPatch, restoreSnapshot, snapshotForPatch } from '@/lib/consultant/apply-patch'
import type {
  ConsultantAlternative,
  ConsultantFieldReason,
  ConsultantModelResponse,
  ConsultantPatch,
} from '@/lib/consultant/route-contract'
import { useConsultantUiStore } from '@/store/consultant-ui-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SECTION_LABELS: Record<string, string> = {
  meta: 'Step 1 — School details',
  calendar: 'Step 2 — Calendar',
  yearGroups: 'Step 2 — Year groups',
  schoolPlan: 'Step 3 — Capacity & intake',
  feeCategories: 'Step 4 — Fees',
  feePositioning: 'Step 4 — Fees',
  staffPositions: 'Step 6 — Staffing',
  opexCategories: 'Operating expenses',
}

type PatchKey = keyof ConsultantPatch

interface Section {
  label: string
  patchKeys: PatchKey[]
  fieldReasons: ConsultantFieldReason[]
}

function groupIntoSections(patch: ConsultantPatch, fieldReasons: ConsultantFieldReason[]): Section[] {
  const byLabel = new Map<string, Section>()

  for (const key of Object.keys(patch) as PatchKey[]) {
    if (patch[key] === undefined) continue
    const label = SECTION_LABELS[key] ?? key
    const existing = byLabel.get(label)
    if (existing) {
      existing.patchKeys.push(key)
    } else {
      byLabel.set(label, { label, patchKeys: [key], fieldReasons: [] })
    }
  }

  for (const reason of fieldReasons) {
    const topKey = reason.path.split('.')[0] ?? reason.path
    const label = SECTION_LABELS[topKey] ?? topKey
    const section = byLabel.get(label)
    if (section) section.fieldReasons.push(reason)
  }

  return [...byLabel.values()]
}

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value && typeof value === 'object' && segment in value) {
      return (value as Record<string, unknown>)[segment]
    }
    return undefined
  }, source)
}

function formatValue(value: unknown): string {
  if (value === undefined) return '—'
  if (value === null) return 'none'
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object') return 'updated'
  return String(value)
}

function subPatch(patch: ConsultantPatch, keys: PatchKey[]): ConsultantPatch {
  return keys.reduce<ConsultantPatch>((result, key) => ({ ...result, [key]: patch[key] }), {})
}

interface UndoState {
  snapshot: ReturnType<typeof snapshotForPatch>
  projectId: string
  paths: string[]
}

interface ProposalCardProps {
  project: Project
  costModel: CostModel | null
  patch: ConsultantPatch
  fieldReasons: ConsultantFieldReason[]
  breakEvenWarning?: string | null
  title?: string
  tradeoff?: string
}

function ProposalCard({ project, costModel, patch, fieldReasons, breakEvenWarning, title, tradeoff }: ProposalCardProps) {
  const markFieldsAiPopulated = useConsultantUiStore((state) => state.markFieldsAiPopulated)
  const sections = useMemo(() => groupIntoSections(patch, fieldReasons), [patch, fieldReasons])
  const [appliedLabels, setAppliedLabels] = useState<string[]>([])
  const [dismissedLabels, setDismissedLabels] = useState<string[]>([])
  const [undoState, setUndoState] = useState<UndoState | null>(null)

  const applySection = (section: Section) => {
    const sectionPatch = subPatch(patch, section.patchKeys)
    const paths = section.fieldReasons.map((reason) => reason.path)
    const snapshot = snapshotForPatch(sectionPatch, project, costModel?.opex ?? [])
    applyConsultantPatch(sectionPatch, project)
    markFieldsAiPopulated(project.id, paths)
    setUndoState({ snapshot, projectId: project.id, paths })
    setAppliedLabels((previous) => [...previous, section.label])
  }

  const applyAll = () => {
    const paths = fieldReasons.map((reason) => reason.path)
    const snapshot = snapshotForPatch(patch, project, costModel?.opex ?? [])
    applyConsultantPatch(patch, project)
    markFieldsAiPopulated(project.id, paths)
    setUndoState({ snapshot, projectId: project.id, paths })
    setAppliedLabels(sections.map((section) => section.label))
  }

  const undo = () => {
    if (!undoState) return
    restoreSnapshot(undoState.snapshot, undoState.projectId)
    setUndoState(null)
    setAppliedLabels([])
  }

  const pendingSections = sections.filter(
    (section) => !appliedLabels.includes(section.label) && !dismissedLabels.includes(section.label),
  )

  return (
    <Card className="border-primary/30">
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          {tradeoff && <p className="text-xs text-muted-foreground">{tradeoff}</p>}
        </CardHeader>
      )}
      <CardContent className="gap-3">
        {breakEvenWarning && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
            {breakEvenWarning}
          </div>
        )}

        {pendingSections.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{pendingSections.length} section(s) proposed</span>
            <Button size="sm" variant="secondary" onClick={applyAll}>
              <Check /> Accept all
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {sections.map((section) => {
            const isApplied = appliedLabels.includes(section.label)
            const isDismissed = dismissedLabels.includes(section.label)
            return (
              <div key={section.label} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-heading">{section.label}</span>
                  {isApplied && <Badge variant="success">Applied</Badge>}
                  {isDismissed && <Badge variant="outline">Rejected</Badge>}
                  {!isApplied && !isDismissed && (
                    <div className="flex gap-1">
                      <Button size="icon-xs" variant="ghost" aria-label="Reject" onClick={() => setDismissedLabels((p) => [...p, section.label])}>
                        <X />
                      </Button>
                      <Button size="icon-xs" variant="secondary" aria-label="Accept" onClick={() => applySection(section)}>
                        <Check />
                      </Button>
                    </div>
                  )}
                </div>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {section.fieldReasons.map((reason) => (
                    <li key={reason.path} className="text-xs text-muted-foreground">
                      <span className="text-foreground">{reason.label}</span>
                      {': '}
                      {formatValue(getByPath(project, reason.path))} → {formatValue(getByPath(patch, reason.path))}
                      <div className="text-[0.7rem] italic">{reason.reason}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {undoState && (
          <Button size="sm" variant="outline" onClick={undo}>
            <Undo2 /> Undo
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

interface ProposalPanelProps {
  project: Project
  costModel: CostModel | null
  response: ConsultantModelResponse
}

export function ProposalPanel({ project, costModel, response }: ProposalPanelProps) {
  if (!response.patch) return null

  return (
    <div className="flex flex-col gap-2">
      <ProposalCard
        project={project}
        costModel={costModel}
        patch={response.patch}
        fieldReasons={response.fieldReasons}
        breakEvenWarning={response.breakEvenWarning}
      />
      {response.alternatives?.map((alternative: ConsultantAlternative) => (
        <ProposalCard
          key={alternative.label}
          project={project}
          costModel={costModel}
          patch={alternative.patch}
          fieldReasons={alternative.fieldReasons}
          title={alternative.label}
          tradeoff={alternative.tradeoff}
        />
      ))}
    </div>
  )
}
