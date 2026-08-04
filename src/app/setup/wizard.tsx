'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/project-store'
import { validateStep, WIZARD_STEP_COUNT, type StepValidation } from '@/lib/wizard-validation'

import { Step1SchoolInfo } from './step-1-school-info'
import { Step2Curriculum } from './step-2-curriculum'
import { Step3Capacity } from './step-3-capacity'
import { Step4Fees } from './step-4-fees'
import { Step5Revenue } from './step-5-revenue'
import { Step6Staffing } from './step-6-staffing'

export const WIZARD_STEPS = [
  { title: 'School information', description: 'Identity, currency and the academic calendar.' },
  { title: 'Curriculum', description: 'Year groups the school teaches.' },
  { title: 'Capacity', description: 'Classrooms, staffing and occupancy.' },
  { title: 'Fees', description: 'Fee categories and amounts per year group.' },
  { title: 'Revenue assumptions', description: 'Escalation, retention, discounts and collections.' },
  { title: 'Staffing', description: 'Positions, headcount and compensation defaults.' },
] as const

export function SetupWizard({ projectId, initialStep }: { projectId: string; initialStep?: number }) {
  const [step, setStep] = useState(() => Math.min(WIZARD_STEP_COUNT, Math.max(1, initialStep ?? 1)))
  const project = useProjectStore((state) => state.projects[projectId])
  const router = useRouter()

  const validation = useMemo<StepValidation>(
    () => (project ? validateStep(step, project) : { valid: false, errors: [] }),
    [project, step],
  )

  if (!project) return null

  const goBack = () => setStep((current) => Math.max(1, current - 1))
  const goNext = () => {
    if (!validation.valid) return
    setStep((current) => Math.min(WIZARD_STEP_COUNT, current + 1))
  }
  const jumpTo = (target: number) => {
    if (target <= step) setStep(target)
  }
  const finish = () => {
    if (!validation.valid) return
    router.push('/dashboard')
  }

  const current = WIZARD_STEPS[step - 1]!

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap items-center gap-2">
        {WIZARD_STEPS.map((item, index) => {
          const stepNumber = index + 1
          const isActive = stepNumber === step
          const isComplete = stepNumber < step

          return (
            <li key={item.title}>
              <button
                type="button"
                onClick={() => jumpTo(stepNumber)}
                disabled={stepNumber > step}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : isComplete
                      ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
                      : 'border-border text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full text-[0.65rem]',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isComplete
                        ? 'bg-success text-success-foreground'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isComplete ? <Check className="size-3" /> : stepNumber}
                </span>
                {item.title}
              </button>
            </li>
          )
        })}
      </ol>

      <div>
        <h2 className="text-lg font-semibold text-foreground">{current.title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{current.description}</p>
      </div>

      <div>
        {step === 1 ? <Step1SchoolInfo project={project} /> : null}
        {step === 2 ? <Step2Curriculum project={project} /> : null}
        {step === 3 ? <Step3Capacity project={project} /> : null}
        {step === 4 ? <Step4Fees project={project} /> : null}
        {step === 5 ? <Step5Revenue project={project} /> : null}
        {step === 6 ? <Step6Staffing project={project} /> : null}
      </div>

      {!validation.valid && validation.errors.length > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-medium">Fix the following before continuing:</p>
          <ul className="mt-1 list-disc pl-4">
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={goBack} disabled={step === 1}>
          Back
        </Button>
        {step < WIZARD_STEP_COUNT ? (
          <Button type="button" onClick={goNext} disabled={!validation.valid}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={finish} disabled={!validation.valid}>
            Finish setup
          </Button>
        )}
      </div>
    </div>
  )
}
