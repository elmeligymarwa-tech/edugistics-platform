import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy notice — Edugistics Training',
}

export default function TrainingPrivacyPage() {
  const contactEmail = process.env.EMAIL_REPLY_TO

  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-md flex-col gap-4 text-sm text-foreground">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">Edugistics Training</p>
          <h1 className="font-heading text-2xl text-heading">Privacy notice</h1>
        </div>

        <p className="text-muted-foreground">
          This notice explains how Edugistics uses the information you provide when registering for a training
          course.
        </p>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-medium text-heading">What we collect</h2>
          <p className="text-muted-foreground">
            Your full name, email address, phone number, school or institution, subject and grade or year group
            taught, and — if you choose to provide it — your address.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-medium text-heading">How we use it</h2>
          <p className="text-muted-foreground">
            To process your course registration, confirm or waitlist your place, and send you course-related emails,
            including joining instructions. If you tick the marketing consent box, we may also email you about future
            training courses — you can withdraw this consent at any time by contacting us.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-medium text-heading">How long we keep it</h2>
          <p className="text-muted-foreground">
            We retain registration records for as long as necessary to administer the training programme and meet
            our record-keeping obligations.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-medium text-heading">Contact us</h2>
          <p className="text-muted-foreground">
            To ask a question about your data, or to update or remove it, contact us
            {contactEmail ? (
              <>
                {' '}
                at <a className="underline underline-offset-2" href={`mailto:${contactEmail}`}>{contactEmail}</a>.
              </>
            ) : (
              ' using the details on your confirmation email.'
            )}
          </p>
        </div>

        <Link href="/training" className="mt-2 text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground">
          Back to registration
        </Link>
      </div>
    </main>
  )
}
