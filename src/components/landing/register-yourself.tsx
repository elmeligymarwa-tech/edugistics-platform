const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'

const JOURNEY = ['Discover', 'Choose', 'Register', 'Attend', 'Develop']

export function RegisterYourself() {
  return (
    // This section's background is --edu-teal-dark, not --edu-teal: white
    // text on --edu-teal measures 3.67:1 (fails AA); on --edu-teal-dark it
    // measures 5.40:1 (passes). If a focusable element is ever added here,
    // its focus ring must be white, not the site's usual edu-teal — teal
    // on this teal background would be invisible.
    <section className="bg-edu-teal-dark text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 sm:grid-cols-[1fr_auto] sm:py-16">
        <div>
          <h2 className={`${HEADING_FONT} mb-4 text-[clamp(1.6rem,3vw,2.4rem)] tracking-tight text-white`}>
            Register Yourself. No Approval Needed.
          </h2>
          <p className="max-w-[36ch] text-lg leading-relaxed text-white/90">
            Training is offered directly to individual teachers. You do not need employer
            sign-off, a school purchasing department or an institutional package to take part.
          </p>
        </div>
        <ol className="flex flex-wrap items-center gap-2.5">
          {JOURNEY.map((step) => (
            <li key={step} className="border border-white/45 px-4 py-2.5 text-base font-bold">
              {step}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
