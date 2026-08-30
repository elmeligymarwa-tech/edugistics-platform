import { CPD_VERIFICATION_URL } from '@/lib/policy-terms'

const BASE =
  'underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

export function CpdVerificationLink({ className = '' }: { className?: string }) {
  return (
    <a
      href={CPD_VERIFICATION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${BASE} ${className}`.trim()}
    >
      Verify our listing with The CPD Standards Office
    </a>
  )
}
