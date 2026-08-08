'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { TopSchoolRow } from '@/lib/training/analytics'
import { AnalyticsEmptyState } from './empty-state'

type Toggle = 10 | 20 | 'ALL'
const TOGGLES: Toggle[] = [10, 20, 'ALL']

export function TopSchoolsPanel({ schools }: { schools: TopSchoolRow[] }) {
  const [toggle, setToggle] = useState<Toggle>(10)
  const rows = toggle === 'ALL' ? schools : schools.slice(0, toggle)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Top schools</CardTitle>
        <div className="flex gap-1">
          {TOGGLES.map((value) => (
            <Button
              key={value}
              size="xs"
              variant={toggle === value ? 'secondary' : 'ghost'}
              onClick={() => setToggle(value)}
            >
              {value === 'ALL' ? 'All' : `Top ${value}`}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {schools.length === 0 ? (
          <AnalyticsEmptyState message="No confirmed registrations with a matched school for the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead className="text-right">Confirmed registrations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((school, index) => (
                  <TableRow key={school.schoolId}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium text-foreground">{school.schoolName}</TableCell>
                    <TableCell className="text-right tabular-nums">{school.confirmedRegistrations}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
