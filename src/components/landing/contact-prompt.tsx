import Link from 'next/link'

export function ContactPrompt() {
  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <p className="text-base leading-relaxed text-brand-navy sm:text-lg">
          Have a question before you register? Get in touch and we&rsquo;ll help you find the
          right course.
        </p>
        <a
          href="https://wa.me/201040400015"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-brand-navy px-6 py-3 text-base font-medium text-white sm:text-lg"
        >
          Chat on WhatsApp
        </a>
        <Link href="/contact" className="text-brand-navy underline underline-offset-2">
          Contact us
        </Link>
      </div>
    </section>
  )
}
