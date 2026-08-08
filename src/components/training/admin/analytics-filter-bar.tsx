'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select } from '@/components/ui/select'
import { DATE_RANGE_PRESETS, DATE_RANGE_PRESET_LABELS, type DateRangePreset } from '@/domain/training/analytics'
import type { AnalyticsFilterOptions } from '@/lib/training/analytics'

const PRESET_ITEMS = DATE_RANGE_PRESETS.map((preset) => ({ value: preset, label: DATE_RANGE_PRESET_LABELS[preset] }))

interface MultiSelectOption {
  value: string
  label: string
}

function MultiSelectFilter({
  label,
  paramKey,
  options,
  selected,
  onChange,
}: {
  label: string
  paramKey: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (paramKey: string, values: string[]) => void
}) {
  const summary = selected.length === 0 ? `All ${label.toLowerCase()}` : selected.length === 1 ? options.find((o) => o.value === selected[0])?.label ?? '1 selected' : `${selected.length} selected`

  function toggle(value: string) {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
    onChange(paramKey, next)
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" className="w-44 justify-between font-normal">
              <span className="truncate">{summary}</span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <PopoverContent className="w-64 p-2">
          {options.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">No {label.toLowerCase()} yet.</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {options.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox checked={selected.includes(option.value)} onCheckedChange={() => toggle(option.value)} />
                  <span className="truncate">{option.label}</span>
                </label>
              ))}
            </div>
          )}
          {selected.length > 0 ? (
            <div className="mt-2 border-t border-border pt-2">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(paramKey, [])}>
                Clear
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function AnalyticsFilterBar({ options }: { options: AnalyticsFilterOptions }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const preset = (searchParams.get('range') as DateRangePreset | null) ?? 'ALL_TIME'
  const [customFrom, setCustomFrom] = useState(searchParams.get('from') ?? '')
  const [customTo, setCustomTo] = useState(searchParams.get('to') ?? '')

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    router.push(`${pathname}?${params.toString()}`)
  }

  function setMultiParam(key: string, values: string[]) {
    updateParams((params) => {
      if (values.length > 0) params.set(key, values.join(','))
      else params.delete(key)
    })
  }

  function setPreset(next: string) {
    updateParams((params) => {
      params.set('range', next)
      if (next !== 'CUSTOM') {
        params.delete('from')
        params.delete('to')
      }
    })
  }

  function applyCustomRange() {
    updateParams((params) => {
      params.set('range', 'CUSTOM')
      if (customFrom) params.set('from', customFrom)
      else params.delete('from')
      if (customTo) params.set('to', customTo)
      else params.delete('to')
    })
  }

  function selectedFromParam(key: string): string[] {
    const value = searchParams.get(key)
    if (!value) return []
    return value.split(',').filter(Boolean)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Date range</span>
        <Select items={PRESET_ITEMS} value={preset} onValueChange={setPreset} triggerClassName="w-40" />
      </div>

      {preset === 'CUSTOM' ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="analytics-from" className="text-xs font-normal text-muted-foreground">
              From
            </Label>
            <Input
              id="analytics-from"
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              onBlur={applyCustomRange}
              className="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="analytics-to" className="text-xs font-normal text-muted-foreground">
              To
            </Label>
            <Input
              id="analytics-to"
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              onBlur={applyCustomRange}
              className="w-36"
            />
          </div>
        </div>
      ) : null}

      <MultiSelectFilter
        label="Course"
        paramKey="courseIds"
        options={options.courses.map((c) => ({ value: c.id, label: c.name }))}
        selected={selectedFromParam('courseIds')}
        onChange={setMultiParam}
      />
      <MultiSelectFilter
        label="Category"
        paramKey="categories"
        options={options.categories.map((c) => ({ value: c.value, label: c.label }))}
        selected={selectedFromParam('categories')}
        onChange={setMultiParam}
      />
      <MultiSelectFilter
        label="School"
        paramKey="schoolIds"
        options={options.schools.map((s) => ({ value: s.id, label: s.name }))}
        selected={selectedFromParam('schoolIds')}
        onChange={setMultiParam}
      />
      <MultiSelectFilter
        label="Subject"
        paramKey="subjects"
        options={options.subjects.map((s) => ({ value: s.value, label: s.label }))}
        selected={selectedFromParam('subjects')}
        onChange={setMultiParam}
      />
      <MultiSelectFilter
        label="Grade"
        paramKey="grades"
        options={options.grades.map((g) => ({ value: g.value, label: g.label }))}
        selected={selectedFromParam('grades')}
        onChange={setMultiParam}
      />

      {searchParams.toString() ? (
        <Button variant="ghost" size="sm" render={<a href={pathname} />}>
          Reset filters
        </Button>
      ) : null}
    </div>
  )
}
