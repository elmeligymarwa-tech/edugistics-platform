import Image from 'next/image'
import Link from 'next/link'

import { CPD_ACCREDITATION_PERIOD, CPD_PROVIDER_NUMBER } from '@/lib/policy-terms'

const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'
const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

export function About() {
  return (
    <section id="about" className="bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 className={`${HEADING_FONT} mb-5 text-[clamp(1.75rem,3.2vw,2.6rem)] leading-[1.1] tracking-tight text-edu-navy`}>
            Professional Development, Delivered Directly to Teachers
          </h2>
          <p className="mb-4 text-lg leading-relaxed text-edu-navy/85">
            Edugistics provides professional development and training to teachers directly.
            Teachers browse the available training, choose the course that fits their own
            professional goals and register online, without going through an institution.
          </p>
          <p className="text-lg leading-relaxed text-edu-navy/85 italic">
            Training is built around the practical realities of teaching — the subjects taught,
            the levels taught and the professional progression teachers are working towards.
          </p>
          <Link
            href="/training"
            className={`mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-edu-navy hover:text-edu-teal ${FOCUS_RING}`}
          >
            Explore Teacher Training <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="border-l-2 border-edu-gold pl-6 sm:pl-9">
          <h3 className="mb-4 text-2xl font-bold text-edu-navy">More Than Teacher Training</h3>
          <p className="mb-4 text-lg leading-relaxed text-edu-navy/80">
            Alongside its teacher programmes, Edugistics works with schools and institutions on
            educational consultancy and school support, drawing on more than 25 years of
            educational leadership.
          </p>
          <p className="text-lg leading-relaxed text-edu-navy/80">
            That institutional work sits behind the teacher offer, not in front of it — the
            training on this page is available to teachers as individuals.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-5 border border-edu-navy/15 bg-white p-5">
            <Image
              src="/brand/cpd-accredited-badge.jpg"
              alt={`Accredited by The CPD Standards Office, CPD Provider ${CPD_PROVIDER_NUMBER}`}
              width={280}
              height={340}
              className="h-auto w-[108px] flex-none"
            />
            <p className="max-w-[32ch] flex-1 text-sm leading-relaxed text-edu-navy/80">
              Edugistics Ltd is an accredited provider with The CPD Standards Office, CPD Provider
              number {CPD_PROVIDER_NUMBER}, accreditation period {CPD_ACCREDITATION_PERIOD}.{' '}
              <Link
                href="/policies/certificate"
                className={`font-bold text-edu-navy underline underline-offset-2 hover:text-edu-teal ${FOCUS_RING}`}
              >
                Read our certificate policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
