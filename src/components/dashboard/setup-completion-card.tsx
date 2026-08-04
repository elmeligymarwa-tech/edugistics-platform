import Link from 'next/link'
import { CheckCircle2, CircleAlert } from 'lucide-react'

import { WIZARD_STEPS } from '@/app/setup/wizard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import { validateStep, WIZARD_STEP_COUNT } from '@/lib/wizard-validation'

export function SetupCompletionCard({ project }: { project: Project }) {
  const incompleteSteps = Array.from({ length: WIZARD_STEP_COUNT }, (_, index) => index + 1).filter(
    (step) => !validateStep(step, project).valid,
  )

  if (incompleteSteps.length === 0) {
    return (
      <Card>
        <CardContent className="flex-row items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" />
            <p className="text-sm font-medium text-foreground">Setup complete</p>
          </div>
          <Button size="sm" variant="outline" render={<Link href="/setup" />}>
            Review setup
          </Button>
        </CardContent>
      </Card>
    )
  }

  const firstIncomplete = incompleteSteps[0]!
  const stepTitle = WIZARD_STEPS[firstIncomplete - 1]?.title ?? `Step ${firstIncomplete}`

  return (
    <Card>
      <CardContent className="flex-row flex-wrap items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-2">
          <CircleAlert className="size-4 text-warning-foreground" />
          <p className="text-sm font-medium text-foreground">
            Setup incomplete
            <Badge variant="warning" className="ml-2">
              {incompleteSteps.length} step{incompleteSteps.length === 1 ? '' : 's'} remaining
            </Badge>
          </p>
        </div>
        <Button size="sm" render={<Link href={`/setup?step=${firstIncomplete}`} />}>
          Finish “{stepTitle}”
        </Button>
      </CardContent>
    </Card>
  )
}
