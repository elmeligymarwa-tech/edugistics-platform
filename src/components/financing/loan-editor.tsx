'use client'

import { Plus, Trash2 } from 'lucide-react'

import { DataGrid, toNumberOrZero, type GridColumnDef } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { RepaymentTypeSchema, type Loan } from '@/domain/capital'
import type { Project } from '@/domain/schema'
import type { LoanYear } from '@/engine/capital'
import { formatMoney } from '@/lib/format'
import { useProjectStore } from '@/store/project-store'

const REPAYMENT_TYPE_LABELS: Record<Loan['repaymentType'], string> = {
  annuity: 'Annuity',
  straightLine: 'Straight line',
  bullet: 'Bullet',
}

const REPAYMENT_TYPE_OPTIONS = RepaymentTypeSchema.options.map((value) => ({
  value,
  label: REPAYMENT_TYPE_LABELS[value],
}))

function createLoan(): Loan {
  return {
    id: globalThis.crypto.randomUUID(),
    name: 'New loan',
    principal: 0,
    drawYearIndex: 0,
    interestRatePct: 0,
    termYears: 5,
    graceYears: 0,
    repaymentType: 'annuity',
    arrangementFeePct: 0,
  }
}

type ScheduleRowKey = 'opening' | 'drawdown' | 'interest' | 'principalRepaid' | 'closing'

interface ScheduleRow {
  key: ScheduleRowKey
  label: string
  emphasis?: boolean
}

const SCHEDULE_ROWS: ScheduleRow[] = [
  { key: 'opening', label: 'Opening balance' },
  { key: 'drawdown', label: 'Drawdown' },
  { key: 'interest', label: 'Interest' },
  { key: 'principalRepaid', label: 'Principal repaid' },
  { key: 'closing', label: 'Closing balance', emphasis: true },
]

function LoanScheduleTable({
  loan,
  project,
  schedule,
  yearLabels,
}: {
  loan: Loan
  project: Project
  schedule: LoanYear[]
  yearLabels: string[]
}) {
  const columns: GridColumnDef<ScheduleRow>[] = [
    {
      id: 'label',
      label: 'Line',
      kind: 'readonly',
      width: 180,
      minWidth: 152,
      pinned: 'left',
      getValue: (row) => row.label,
    },
    ...schedule.map(
      (year): GridColumnDef<ScheduleRow> => ({
        id: `year-${year.yearIndex}`,
        label: yearLabels[year.yearIndex] ?? '',
        kind: 'readonly',
        width: 128,
        minWidth: 112,
        getValue: (row) => year[row.key],
        format: (value) => (typeof value === 'number' ? formatMoney(value, project.meta) : ''),
      }),
    ),
  ]

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase">{loan.name} — schedule</p>
      <DataGrid
        rows={SCHEDULE_ROWS}
        getRowId={(row) => row.key}
        columns={columns}
        mode="display"
        gridId={`financing-loan-schedule-${loan.id}`}
        ariaLabel={`${loan.name} repayment schedule`}
        getRowClassName={(row) => (row.emphasis ? 'font-semibold' : undefined)}
      />
    </div>
  )
}

export function LoanEditor({
  project,
  loans,
  loanSchedules,
  yearLabels,
}: {
  project: Project
  loans: Loan[]
  loanSchedules: Record<string, LoanYear[]>
  yearLabels: string[]
}) {
  const updateLoans = useProjectStore((state) => state.updateLoans)

  const addLoan = () => updateLoans(project.id, [...loans, createLoan()])

  const updateLoan = (id: string, patch: Partial<Loan>) =>
    updateLoans(
      project.id,
      loans.map((loan) => (loan.id === id ? { ...loan, ...patch } : loan)),
    )

  const removeLoan = (id: string) => updateLoans(project.id, loans.filter((loan) => loan.id !== id))

  const columns: GridColumnDef<Loan>[] = [
    {
      id: 'name',
      label: 'Name',
      kind: 'text',
      width: 180,
      minWidth: 152,
      pinned: 'left',
      getValue: (loan) => loan.name,
      onCommit: (loan, value) => updateLoan(loan.id, { name: typeof value === 'string' ? value : '' }),
      render: (loan) => (
        <div className="flex w-full items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate">{loan.name}</span>
          <button
            type="button"
            aria-label={`Remove ${loan.name}`}
            onClick={() => removeLoan(loan.id)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
    {
      id: 'principal',
      label: 'Principal',
      kind: 'numeric',
      width: 128,
      minWidth: 108,
      allowFillDown: true,
      getValue: (loan) => loan.principal,
      onCommit: (loan, value) => updateLoan(loan.id, { principal: toNumberOrZero(value) }),
    },
    {
      id: 'drawYearIndex',
      label: 'Draw year',
      kind: 'numeric',
      width: 108,
      minWidth: 96,
      getValue: (loan) => loan.drawYearIndex + 1,
      onCommit: (loan, value) => updateLoan(loan.id, { drawYearIndex: Math.max(0, toNumberOrZero(value) - 1) }),
    },
    {
      id: 'interestRatePct',
      label: 'Interest %',
      kind: 'percent',
      width: 104,
      minWidth: 92,
      getValue: (loan) => loan.interestRatePct,
      onCommit: (loan, value) => updateLoan(loan.id, { interestRatePct: toNumberOrZero(value) }),
    },
    {
      id: 'termYears',
      label: 'Term (years)',
      kind: 'numeric',
      width: 108,
      minWidth: 96,
      getValue: (loan) => loan.termYears,
      onCommit: (loan, value) => updateLoan(loan.id, { termYears: Math.max(1, toNumberOrZero(value)) }),
    },
    {
      id: 'graceYears',
      label: 'Grace (years)',
      kind: 'numeric',
      width: 108,
      minWidth: 96,
      getValue: (loan) => loan.graceYears,
      onCommit: (loan, value) => updateLoan(loan.id, { graceYears: Math.max(0, toNumberOrZero(value)) }),
    },
    {
      id: 'repaymentType',
      label: 'Repayment',
      kind: 'select',
      width: 128,
      minWidth: 112,
      selectOptions: REPAYMENT_TYPE_OPTIONS,
      getValue: (loan) => loan.repaymentType,
      onCommit: (loan, value) => updateLoan(loan.id, { repaymentType: value as Loan['repaymentType'] }),
    },
    {
      id: 'arrangementFeePct',
      label: 'Arrangement fee %',
      kind: 'percent',
      width: 128,
      minWidth: 112,
      getValue: (loan) => loan.arrangementFeePct,
      onCommit: (loan, value) => updateLoan(loan.id, { arrangementFeePct: toNumberOrZero(value) }),
    },
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-heading">Loans</h3>
        <Button type="button" size="sm" variant="outline" onClick={addLoan}>
          <Plus data-icon="inline-start" />
          Add loan
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No loans yet.</p>
        ) : (
          <DataGrid
            rows={loans}
            getRowId={(loan) => loan.id}
            columns={columns}
            mode="edit"
            gridId="financing-loans"
            ariaLabel="Loans"
          />
        )}
      </CardContent>
      {loans.length > 0 ? (
        <CardContent className="flex flex-col gap-6 pt-0">
          {loans.map((loan) => (
            <LoanScheduleTable
              key={loan.id}
              loan={loan}
              project={project}
              schedule={loanSchedules[loan.id] ?? []}
              yearLabels={yearLabels}
            />
          ))}
        </CardContent>
      ) : null}
    </Card>
  )
}
