import Link from 'next/link'

import { CHANGE_REQUEST_EMAIL } from '@/lib/policy-terms'

const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'
const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

export function ContactPrompt() {
  return (
    <section id="contact" className="bg-edu-navy text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2">
        <div>
          <h2 className={`${HEADING_FONT} mb-6 text-[clamp(1.75rem,3.2vw,2.6rem)] tracking-tight text-white`}>
            Talk to Edugistics
          </h2>
          <dl className="grid gap-5 text-lg">
            <div>
              <dt className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-edu-gold">Phone</dt>
              <dd className="flex flex-wrap gap-3">
                <a href="tel:01040400015" className={`border-b border-white/35 hover:text-edu-gold ${FOCUS_RING}`}>
                  01040400015
                </a>
                <span className="text-white/40">/</span>
                <a href="tel:01040400016" className={`border-b border-white/35 hover:text-edu-gold ${FOCUS_RING}`}>
                  01040400016
                </a>
              </dd>
            </div>
            <div>
              <dt className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-edu-gold">Email</dt>
              <dd>
                <a
                  href={`mailto:${CHANGE_REQUEST_EMAIL}`}
                  className={`border-b border-white/35 hover:text-edu-gold ${FOCUS_RING}`}
                >
                  {CHANGE_REQUEST_EMAIL}
                </a>
              </dd>
            </div>
            <div>
              <dt className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-edu-gold">Address</dt>
              <dd className="leading-relaxed text-white/85">
                Building 5, Zizina Gardens, New Cairo, Cairo, Egypt
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col justify-center gap-3.5">
          <a
            href="https://wa.me/201040400015"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex min-h-14 items-center justify-between gap-3 rounded bg-white px-6 py-4 text-lg font-bold text-edu-navy hover:bg-edu-gold ${FOCUS_RING}`}
          >
            Message us on WhatsApp <span aria-hidden="true">→</span>
          </a>
          <Link
            href="/training"
            className={`inline-flex min-h-14 items-center justify-between gap-3 rounded bg-edu-gold px-6 py-4 text-lg font-bold text-edu-navy hover:bg-white ${FOCUS_RING}`}
          >
            Explore Teacher Training <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
