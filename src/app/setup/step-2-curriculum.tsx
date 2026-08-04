'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { YEAR_GROUP_ORDER, type Project, type YearGroupId } from '@/domain/schema'
import { cn } from '@/lib/utils'
import { YEAR_GROUP_LABELS, describeYearGroupData } from '@/lib/wizard-data'
import { useProjectStore } from '@/store/project-store'

const SECTIONS: Array<{ title: string; items: readonly YearGroupId[] }> = [
  { title: 'Foundation stage', items: YEAR_GROUP_ORDER.filter((group) => group.startsWith('FS')) },
  { title: 'Primary and secondary', items: YEAR_GROUP_ORDER.filter((group) => /^Y[1-8]$/.test(group)) },
  { title: 'IGCSE', items: YEAR_GROUP_ORDER.filter((group) => group.startsWith('IGCSE')) },
]

export function Step2Curriculum({ project }: { project: Project }) {
  const updateYearGroups = useProjectStore((state) => state.updateYearGroups)
  const removeYearGroup = useProjectStore((state) => state.removeYearGroup)
  const [pendingRemoval, setPendingRemoval] = useState<YearGroupId | null>(null)

  const isSelected = (group: YearGroupId) => project.yearGroups.includes(group)

  const toggle = (group: YearGroupId) => {
    if (isSelected(group)) {
      if (describeYearGroupData(project, group).length > 0) {
        setPendingRemoval(group)
        return
      }
      updateYearGroups(
        project.id,
        project.yearGroups.filter((entry) => entry !== group),
      )
      return
    }
    updateYearGroups(project.id, [...project.yearGroups, group])
  }

  const confirmRemoval = () => {
    if (!pendingRemoval) return
    removeYearGroup(project.id, pendingRemoval)
    setPendingRemoval(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{section.title}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {section.items.map((group) => {
              const selected = isSelected(group)
              return (
                <Card
                  key={group}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(group)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggle(group)
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-1 p-3 text-center transition-colors outline-none',
                    'focus-visible:ring-3 focus-visible:ring-ring/50',
                    selected ? 'border-primary bg-primary/10 text-primary' : 'hover:border-foreground/30',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full border',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {selected ? <Check className="size-3" /> : null}
                  </div>
                  <span className="text-xs font-medium">{YEAR_GROUP_LABELS[group]}</span>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      <Dialog open={pendingRemoval !== null} onOpenChange={(open) => !open && setPendingRemoval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {pendingRemoval ? YEAR_GROUP_LABELS[pendingRemoval] : ''}?
            </DialogTitle>
            <DialogDescription>
              This year group has data attached. Removing it will permanently delete:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 text-sm text-foreground">
            {pendingRemoval
              ? describeYearGroupData(project, pendingRemoval).map((item) => <li key={item}>{item}</li>)
              : null}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingRemoval(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemoval}>
              Remove year group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
