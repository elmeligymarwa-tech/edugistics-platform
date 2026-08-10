// One-off seed for the four starting marketing email templates (Phase C).
// Idempotent by name — skips any template that already exists (matched on
// name, among non-archived rows) so running this more than once never
// creates duplicates. Every body is clearly marked PLACEHOLDER copy for an
// administrator to replace before actually using the template.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEMPLATES = [
  {
    name: 'Training Announcement',
    subject: '[PLACEHOLDER: Course name] — new training now open',
    bodyTemplate: `Hi {{firstName}},

[PLACEHOLDER: One or two sentences introducing the new course — who it's for and why it matters.]

**[PLACEHOLDER: Course name]**
[PLACEHOLDER: Date, time and delivery method]

[PLACEHOLDER: Call to action — link to the registration page.]

Best wishes,
The Edugistics Team`,
  },
  {
    name: 'New Webinar',
    subject: '[PLACEHOLDER: Webinar topic] — join us live',
    bodyTemplate: `Hi {{firstName}},

[PLACEHOLDER: Introduce the webinar topic and who will be presenting.]

**[PLACEHOLDER: Webinar title]**
[PLACEHOLDER: Date and time, with timezone]

[PLACEHOLDER: Registration link or joining instructions.]

Best wishes,
The Edugistics Team`,
  },
  {
    name: 'Professional Development Opportunity',
    subject: '[PLACEHOLDER: Opportunity name] — professional development for [PLACEHOLDER: audience]',
    bodyTemplate: `Hi {{firstName}},

[PLACEHOLDER: Describe the professional development opportunity and who at {{schoolName}} it's relevant to.]

- [PLACEHOLDER: Key benefit one]
- [PLACEHOLDER: Key benefit two]
- [PLACEHOLDER: Key benefit three]

[PLACEHOLDER: Call to action.]

Best wishes,
The Edugistics Team`,
  },
  {
    name: 'General Edugistics Update',
    subject: '[PLACEHOLDER: Update headline]',
    bodyTemplate: `Hi {{firstName}},

[PLACEHOLDER: General update copy — news, product changes, or a round-up of recent activity.]

[PLACEHOLDER: Call to action, if any.]

Best wishes,
The Edugistics Team`,
  },
]

async function main() {
  const created: string[] = []
  const skipped: string[] = []

  for (const template of TEMPLATES) {
    const existing = await prisma.marketingTemplate.findFirst({ where: { name: template.name, archivedAt: null } })
    if (existing) {
      skipped.push(template.name)
      continue
    }
    await prisma.marketingTemplate.create({ data: template })
    created.push(template.name)
  }

  console.log(JSON.stringify({ created, skipped }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
