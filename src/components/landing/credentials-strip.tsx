import { CpdVerificationLink } from '@/components/policy/cpd-verification-link'
import { CPD_ACCREDITATION_PERIOD, CPD_PROVIDER_NUMBER } from '@/lib/policy-terms'

const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'
const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

const CREDENTIALS = [
  { title: '25+ Years', body: 'Educational leadership' },
  { title: 'Experienced Trainers', body: 'Across core teaching subjects' },
  { title: 'Teacher Focused', body: 'Professional development designed for educators' },
  { title: 'Professional Training', body: 'Practical learning for teaching professionals' },
]

export function CredentialsStrip() {
  return (
    <section aria-label="Credentials" className="border-b border-edu-navy/10 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-2 sm:py-10 lg:grid-cols-4">
        {CREDENTIALS.map((item) => (
          <div key={item.title} className="flex flex-col gap-1.5">
            <span className={`${HEADING_FONT} text-xl text-edu-navy`}>{item.title}</span>
            <span className="text-sm leading-relaxed text-edu-navy/70">{item.body}</span>
          </div>
        ))}
      </div>
      <p className="mx-auto max-w-6xl border-t border-edu-navy/10 px-4 py-4 text-sm leading-relaxed text-edu-navy/70">
        Accredited Provider — CPD Provider {CPD_PROVIDER_NUMBER} |{' '}
        {CPD_ACCREDITATION_PERIOD.replace('-', '–')}{' '}
        <CpdVerificationLink className={`font-bold text-edu-navy hover:text-edu-teal ${FOCUS_RING}`} />
      </p>
    </section>
  )
}
