import Image from 'next/image'
import Link from 'next/link'

import { CPD_ACCREDITATION_PERIOD, CPD_PROVIDER_NUMBER } from '@/lib/policy-terms'

export function AccreditationStrip() {
  return (
    <section className="bg-white px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-center sm:text-left">
        <Image
          src="/brand/cpd-accredited-badge.jpg"
          alt={`Accredited by The CPD Standards Office, CPD Provider ${CPD_PROVIDER_NUMBER}`}
          width={160}
          height={194}
          className="h-auto w-[160px]"
        />
        <p className="text-base leading-relaxed text-brand-navy sm:text-lg">
          Edugistics Ltd is an accredited provider with The CPD Standards Office, CPD Provider
          number {CPD_PROVIDER_NUMBER}, accreditation period {CPD_ACCREDITATION_PERIOD}.{' '}
          <Link href="/policies/certificate" className="underline underline-offset-2">
            Read our certificate policy
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
