import Link from 'next/link'

const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'
const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

const STEPS = [
  { num: '01', title: 'Explore', body: 'Find training relevant to your teaching.' },
  { num: '02', title: 'Choose', body: 'Select a course that fits your professional development goals.' },
  { num: '03', title: 'Register', body: 'Complete your registration online.' },
  { num: '04', title: 'Learn', body: 'Attend the training and develop your professional practice.' },
]

export function HowItWorks() {
  return (
    <section id="how" className="bg-edu-navy text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className={`${HEADING_FONT} mb-10 text-[clamp(1.9rem,3.6vw,2.9rem)] tracking-tight text-white sm:mb-14`}>
          How It Works
        </h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.num} className="border-t-2 border-edu-gold pt-5">
              <p className="mb-3 text-xs font-bold tracking-[0.08em] text-edu-gold">
                {step.num} — {step.title}
              </p>
              <p className="text-base leading-relaxed text-white/85">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-12">
          <Link
            href="/training"
            className={`inline-flex min-h-[52px] items-center gap-2 rounded bg-edu-gold px-7 py-4 text-base font-bold text-edu-navy ${FOCUS_RING}`}
          >
            Explore Teacher Training <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
