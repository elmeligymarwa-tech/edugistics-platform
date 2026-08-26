import Link from 'next/link'

export function Hero() {
  return (
    <section className="px-4 py-16 sm:py-24">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 text-center">
        <h1 className="font-heading text-3xl text-brand-navy sm:text-4xl">
          Professional Development Built for Teachers
        </h1>
        <p className="text-base leading-relaxed text-brand-navy sm:text-lg sm:leading-loose">
          Practical training courses designed to help teachers strengthen their skills, expand
          their expertise and progress professionally. Delivered by experienced trainers across
          core teaching subjects, with over 25 years of educational leadership behind them.
        </p>
        <p className="font-heading text-2xl text-brand-teal">Learn. Grow. Lead.</p>
        <div>
          <Link
            href="/training"
            className="inline-flex items-center justify-center rounded-full bg-brand-gold px-6 py-3 text-base font-medium text-brand-navy sm:text-lg"
          >
            Explore Teacher Training
          </Link>
        </div>
      </div>
    </section>
  )
}
