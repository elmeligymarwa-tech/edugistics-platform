import Link from 'next/link'

const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'
const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

const SUBJECTS = [
  'English',
  'Mathematics',
  'Science',
  'Languages',
  'Humanities',
  'ICT / Computing',
  'Primary Education',
  'Teaching & Learning',
  'Leadership',
]

export function SubjectsGrid() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className={`${HEADING_FONT} text-[clamp(1.75rem,3.2vw,2.5rem)] tracking-tight text-edu-navy`}>
            Subjects &amp; Areas
          </h2>
          <Link
            href="/training"
            className={`inline-flex min-h-11 items-center gap-2 font-bold text-edu-navy hover:text-edu-teal ${FOCUS_RING}`}
          >
            See all training <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-px border border-edu-navy/15 bg-edu-navy/15 sm:grid-cols-3">
          {SUBJECTS.map((subject) => (
            <Link
              key={subject}
              href="/training"
              className={`group flex min-h-[88px] items-center justify-between gap-4 bg-white px-6 py-6 text-lg font-bold text-edu-navy hover:bg-edu-navy hover:text-white ${FOCUS_RING}`}
            >
              <span>{subject}</span>
              <span aria-hidden="true" className="text-edu-navy group-hover:text-edu-gold">→</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
