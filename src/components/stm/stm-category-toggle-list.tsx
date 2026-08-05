'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import type { Project } from '@/domain/schema'
import { useProjectStore } from '@/store/project-store'

export function StmCategoryToggleList({ project }: { project: Project }) {
  const updateFees = useProjectStore((state) => state.updateFees)
  const categories = project.fees.categories

  const toggle = (categoryId: string, includedInStm: boolean) =>
    updateFees(project.id, {
      categories: categories.map((category) =>
        category.id === categoryId ? { ...category, includedInStm } : category,
      ),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee categories included in STM base</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No fee categories yet. Add fee categories in setup to control which ones feed the STM base.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm text-foreground">{category.name}</span>
                <Switch
                  checked={category.includedInStm}
                  onCheckedChange={(checked) => toggle(category.id, checked)}
                />
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
