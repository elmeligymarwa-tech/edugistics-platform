'use client'

import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StaffSectionSchema, type Project, type StaffPosition } from '@/domain/schema'
import { STAFF_SECTION_LABELS } from '@/lib/wizard-data'
import { useProjectStore } from '@/store/project-store'
import { createStaffPosition, useSyncDerivedPositions } from './use-sync-derived-positions'
import { PositionCard } from './position-card'

/**
 * The full position editor grouped by staffing section, covering salary
 * bands, increments, on-costs, allowances, recruitment and training.
 * Teaching positions are derived from Capacity Planning unless overridden.
 * Shared by the setup wizard's staffing step and the Staffing & Payroll page.
 */
export function PositionEditor({ project }: { project: Project }) {
  const updateStaffing = useProjectStore((state) => state.updateStaffing)

  useSyncDerivedPositions(project)

  const updatePosition = (id: string, patch: Partial<StaffPosition>) => {
    updateStaffing(project.id, {
      positions: project.staffing.positions.map((position) =>
        position.id === id ? { ...position, ...patch } : position,
      ),
    })
  }

  const removePosition = (id: string) => {
    updateStaffing(project.id, {
      positions: project.staffing.positions.filter((position) => position.id !== id),
    })
  }

  const addPosition = (section: StaffPosition['section']) => {
    updateStaffing(project.id, {
      positions: [...project.staffing.positions, createStaffPosition({ title: 'New position', section })],
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {StaffSectionSchema.options.map((section) => {
        const positions = project.staffing.positions.filter((position) => position.section === section)
        return (
          <div key={section} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {STAFF_SECTION_LABELS[section] ?? section}
              </h3>
              <Button type="button" size="sm" variant="outline" onClick={() => addPosition(section)}>
                <Plus data-icon="inline-start" />
                Add position
              </Button>
            </div>
            {positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No positions yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {positions.map((position) => (
                  <PositionCard
                    key={position.id}
                    position={position}
                    onUpdate={(patch) => updatePosition(position.id, patch)}
                    onRemove={() => removePosition(position.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
