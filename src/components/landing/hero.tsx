import Link from 'next/link'

const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'
const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

export function Hero() {
  return (
    <section className="bg-edu-navy text-white">
      {/*
        The design places a training photograph in a right-hand column here
        (16:10 box, roughly half the section width on desktop). Shipping no
        photograph this phase — see the phase 2b report for why. When real
        Edugistics event photography is ready, reintroduce a two-column
        grid and place the image in the second column at this point in the
        markup.
      */}
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16 text-center sm:py-24">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-edu-gold">
          For Teachers &amp; Educators
        </p>
        <h1 className={`${HEADING_FONT} text-[clamp(2.4rem,5.6vw,4.25rem)] leading-[1.03] tracking-tight text-balance text-white`}>
          Professional Development Built for Teachers
        </h1>
        <p className="text-base leading-relaxed text-white/85 sm:text-lg">
          Practical training courses designed to help teachers strengthen their skills, expand
          their expertise and progress professionally. Delivered by experienced trainers across
          core teaching subjects, with over 25 years of educational leadership behind them.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/training"
            className={`inline-flex min-h-[52px] items-center gap-2 rounded bg-edu-gold px-7 py-4 text-base font-bold text-edu-navy sm:text-lg ${FOCUS_RING}`}
          >
            Explore Teacher Training <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="#about"
            className={`inline-flex min-h-[52px] items-center rounded border border-white/45 px-6 py-4 text-base font-bold text-white hover:border-edu-gold hover:text-edu-gold sm:text-lg ${FOCUS_RING}`}
          >
            Learn About Edugistics
          </Link>
        </div>
      </div>
    </section>
  )
}
