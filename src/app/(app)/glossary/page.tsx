'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Search } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { GLOSSARY_TERMS } from '@/lib/glossary/glossary-data'

export default function GlossaryPage() {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const normalised = query.trim().toLowerCase()
    if (!normalised) return GLOSSARY_TERMS
    return GLOSSARY_TERMS.filter(
      (entry) =>
        entry.title.toLowerCase().includes(normalised) || entry.definition.toLowerCase().includes(normalised),
    )
  }, [query])

  return (
    <>
      <PageHeader title="Glossary" description="Every financial and operational term used across the application, in plain English." />
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search terms…"
            aria-label="Search the glossary"
            className="pl-8"
          />
        </div>

        {results.length === 0 ? (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="items-center gap-3 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BookOpen className="size-6" aria-hidden="true" />
              </div>
              <p className="text-sm text-muted-foreground">No terms match &ldquo;{query}&rdquo;.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {results.map((entry) => (
                <div key={entry.id} id={entry.id} className="flex flex-col gap-1 p-4">
                  <h3 className="text-sm font-semibold text-heading">{entry.title}</h3>
                  <p className="text-sm text-muted-foreground">{entry.definition}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
