import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { BarChart3, Calculator, GraduationCap, Mail, TrendingUp, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'

// PLACEHOLDER — replace with the final marketing description before launch.
export const metadata: Metadata = {
  title: 'Edugistics — School Financial Planning',
  description: 'Financial planning, forecasting and CPD for school operators.',
}

// PLACEHOLDER — service card copy. Replace title/description with the real offering list.
const SERVICES = [
  {
    icon: Calculator,
    title: 'Financial planning',
    description: 'Multi-year revenue, cost and cash forecasts built around how schools actually operate.',
  },
  {
    icon: TrendingUp,
    title: 'Scenario modelling',
    description: 'Compare fee changes, headcount plans and capital projects side by side before you commit.',
  },
  {
    icon: Users,
    title: 'Staffing & cost planning',
    description: 'Model payroll, staffing ratios and operating costs against enrolment in one place.',
  },
  {
    icon: BarChart3,
    title: 'Reporting & board packs',
    description: 'Turn a live model into statements and reports your board and investors can act on.',
  },
]

// PLACEHOLDER — contact address. Replace with the real inbox before launch.
const CONTACT_EMAIL = 'hello@edugistics.example'

export default function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Image
            src="/brand/logo-light.png"
            alt="Edugistics"
            width={900}
            height={649}
            priority
            className="h-auto w-28 dark:hidden"
          />
          <Image
            src="/brand/logo-dark.png"
            alt="Edugistics"
            width={900}
            height={649}
            priority
            className="hidden h-auto w-28 dark:block"
          />
          <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <Link href="/training" className="hover:text-foreground">
              Training &amp; CPD
            </Link>
            <a href="#contact" className="hover:text-foreground">
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Hero — PLACEHOLDER copy throughout, replace before launch. */}
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">Edugistics</p>
        <h1 className="font-heading text-3xl text-heading sm:text-5xl">
          Financial clarity for the schools shaping tomorrow&apos;s students.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          Edugistics helps school operators plan, forecast and report on their finances with confidence — plus
          practical training for the teams running them.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" render={<Link href="/training" />}>
            Explore training &amp; CPD
          </Button>
          <Button size="lg" variant="outline" render={<a href="#contact" />}>
            Get in touch
          </Button>
        </div>
      </section>

      {/* What we do */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <h2 className="text-center font-heading text-2xl text-heading sm:text-3xl">What we do</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <Card key={service.title}>
              <CardContent className="pt-4">
                <service.icon className="size-5 text-accent-foreground" aria-hidden="true" />
                <CardTitle className="text-base">{service.title}</CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Who we work with — PLACEHOLDER credibility copy, replace before launch. */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-16 text-center">
          <h2 className="font-heading text-2xl text-heading sm:text-3xl">Who we work with</h2>
          <p className="max-w-xl text-muted-foreground">
            We work with school operators and multi-school groups who need a financial model they can trust —
            from single-campus schools to growing groups planning their next site.
          </p>
        </div>
      </section>

      {/* Training and CPD */}
      <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <GraduationCap className="mx-auto size-8 text-accent-foreground" aria-hidden="true" />
        <h2 className="mt-3 font-heading text-2xl text-heading sm:text-3xl">Training &amp; CPD</h2>
        {/* PLACEHOLDER copy, replace before launch. */}
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Short, practical courses for school leaders and teaching staff — from finance essentials to classroom
          practice.
        </p>
        <Button className="mt-6" render={<Link href="/training" />}>
          Browse upcoming courses
        </Button>
      </section>

      {/* Contact — no form, direct email link only. */}
      <section id="contact" className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-16 text-center">
          <Mail className="size-8 text-accent-foreground" aria-hidden="true" />
          <h2 className="font-heading text-2xl text-heading sm:text-3xl">Contact</h2>
          <p className="max-w-xl text-muted-foreground">Questions about Edugistics? Get in touch directly.</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-lg font-medium text-primary underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Edugistics.</p>
          {/*
            PLACEHOLDER link target — /training/privacy is currently the
            training-registration-specific privacy notice. Point this at a
            general site privacy policy once one exists.
          */}
          <Link href="/training/privacy" className="hover:text-foreground">
            Privacy policy
          </Link>
        </div>
      </footer>
    </main>
  )
}
