'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { Project } from '@/domain/schema'
import { useProjectStore, type ScenarioMeta } from '@/store/project-store'

export function ScenarioPanel({
  project,
  scenarios,
}: {
  project: Project
  scenarios: Record<string, ScenarioMeta>
}) {
  const createScenario = useProjectStore((state) => state.createScenario)
  const applyScenarioAdjustments = useProjectStore((state) => state.applyScenarioAdjustments)

  const [newScenarioName, setNewScenarioName] = useState('')
  const scenarioIds = Object.entries(scenarios)
    .filter(([, meta]) => meta.baseProjectId === project.id)
    .map(([id]) => id)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | undefined>(scenarioIds[0])

  const [occupancyDeltaPct, setOccupancyDeltaPct] = useState(0)
  const [feeEscalationDeltaPct, setFeeEscalationDeltaPct] = useState(0)
  const [salaryEscalationDeltaPct, setSalaryEscalationDeltaPct] = useState(0)
  const [discountDeltaPct, setDiscountDeltaPct] = useState(0)
  const [headcountScalePct, setHeadcountScalePct] = useState(100)

  const handleCreate = () => {
    const name = newScenarioName.trim()
    if (!name) return
    const id = createScenario(project.id, name)
    setSelectedScenarioId(id)
    setNewScenarioName('')
  }

  const handleApply = () => {
    if (!selectedScenarioId) return
    applyScenarioAdjustments(selectedScenarioId, {
      occupancyDeltaPct,
      feeEscalationDeltaPct,
      salaryEscalationDeltaPct,
      discountDeltaPct,
      headcountScalePct,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario planning</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="flex flex-wrap items-end gap-2">
          <Field className="min-w-48 flex-1">
            <FieldLabel htmlFor="new-scenario-name">
              Duplicate &ldquo;{project.meta.schoolName}&rdquo; as a scenario
            </FieldLabel>
            <Input
              id="new-scenario-name"
              placeholder="e.g. Recession case"
              value={newScenarioName}
              onChange={(event) => setNewScenarioName(event.target.value)}
            />
          </Field>
          <Button type="button" onClick={handleCreate} disabled={!newScenarioName.trim()}>
            Create scenario
          </Button>
        </div>

        {scenarioIds.length > 0 ? (
          <>
            <Field>
              <FieldLabel htmlFor="scenario-select">Adjust scenario</FieldLabel>
              <Select
                id="scenario-select"
                items={scenarioIds.map((id) => ({ value: id, label: scenarios[id]?.name ?? id }))}
                value={selectedScenarioId}
                onValueChange={setSelectedScenarioId}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Field>
                <FieldLabel htmlFor="occupancy-delta">Occupancy Δ%</FieldLabel>
                <Input
                  id="occupancy-delta"
                  type="number"
                  value={occupancyDeltaPct}
                  onChange={(event) => setOccupancyDeltaPct(Number(event.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fee-escalation-delta">Fee escalation Δ%</FieldLabel>
                <Input
                  id="fee-escalation-delta"
                  type="number"
                  value={feeEscalationDeltaPct}
                  onChange={(event) => setFeeEscalationDeltaPct(Number(event.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="salary-escalation-delta">Salary escalation Δ%</FieldLabel>
                <Input
                  id="salary-escalation-delta"
                  type="number"
                  value={salaryEscalationDeltaPct}
                  onChange={(event) => setSalaryEscalationDeltaPct(Number(event.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="discount-delta">Discount rates Δ%</FieldLabel>
                <Input
                  id="discount-delta"
                  type="number"
                  value={discountDeltaPct}
                  onChange={(event) => setDiscountDeltaPct(Number(event.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="headcount-scale">Headcount %</FieldLabel>
                <Input
                  id="headcount-scale"
                  type="number"
                  min={0}
                  value={headcountScalePct}
                  onChange={(event) => setHeadcountScalePct(Number(event.target.value))}
                />
              </Field>
            </div>
            <Button type="button" onClick={handleApply} className="self-start">
              Apply adjustments
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Create a scenario above to start adjusting it.</p>
        )}
      </CardContent>
    </Card>
  )
}
