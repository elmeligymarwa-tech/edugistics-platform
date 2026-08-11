// Vitest globalSetup: runs ONCE, outside the test module graph, in plain
// Node — before any test file starts, and (via the returned function) once
// after every test file has finished, regardless of individual test
// passes/failures/timeouts.
//
// Why this exists: the training-app test suite writes to the same database
// production reads from (see CLAUDE.md, "Test suite writes to the
// production database"). Every test file cleans up its own rows in its own
// afterAll, but that only protects against the common case. Two gaps
// remain, both closed here:
//
//   1. An interrupted run (Ctrl+C, a crashed worker, a lost connection to
//      the remote pooler) skips every per-file afterAll entirely. The next
//      person to run the suite inherits whatever was left — this sweep runs
//      BEFORE seeding starts, so it always begins from a clean slate.
//   2. A per-test timeout can outrace even a *successful* per-file afterAll:
//      Vitest cannot cancel an in-flight prisma.*.create() call, so a write
//      started by a timed-out test can land in the database after that
//      file's own tracked-id cleanup already ran. This sweep runs AFTER
//      every file has finished (not per-file), so any such write has had
//      time to resolve by the time it's checked.
//
// Matching rule, applied everywhere: an exact/prefix match against one of
// the explicit marker strings below, or a foreign-key relationship to a row
// already identified that way. Never a generic pattern (no "contains test",
// no "isActive", no recency) — see CLAUDE.md for why every new test file
// must use one of these conventions, and must add its marker here.
import { Prisma, PrismaClient } from '@prisma/client'

/** One entry per test file that defines its own `const MARKER = '...'`. Keep this in sync — see CLAUDE.md's "test data markers" convention. */
const FILE_MARKERS = [
  'migrate-legacy-consent-test',
  'promo-validate-route-test',
  'register-route-test',
  'subscribe-route-test',
  'unsubscribe-confirm-route-test',
  'unsubscribe-resubscribe-route-test',
  'promote-action-test',
  'promo-code-actions-test',
  'course-actions-test',
  'attendance-sheet-test',
  'registrations-actions-test',
  'email-actions-test',
  'send-actions-test',
  'subscribers-actions-test',
  'marketing-send-actions-test',
  'marketing-template-actions-test',
  'campaign-analytics-test',
  'marketing-campaign-analytics-test',
  'recipients-test',
  'export-workbook-test',
  'subscribers-export-workbook-test',
  'landing-subscribe-test',
  'promo-code-validation-test',
  'promo-codes-analytics-test',
  'public-courses-test',
  'register-for-course-test',
  'regs-course-group-test',
  'school-matching-test',
  'subscriber-analytics-test',
  'subscribers-admin-test',
  'unsubscribe-test',
] as const

/** The analytics fixture (scripts/training-analytics-fixture-plan.ts) predates the MARKER convention and uses its own constants — never renamed, so listed here explicitly rather than folded into FILE_MARKERS. */
const FIXTURE_MARKER = 'phase4-fixture'
const FIXTURE_SCHOOL_PREFIX = 'Phase4 Fixture'
const FIXTURE_TEACHER_EMAIL_DOMAIN = '@phase4-fixture.test'

/**
 * src/app/api/training/register/route.test.ts exercises the real public
 * registration endpoint end-to-end and submits this literal schoolName in
 * its request body — school-matching creates the School row during input
 * normalisation, before that request's deliberately-nonexistent courseId
 * causes the registration itself to be rejected, so the row exists even
 * though "no registration rows are created" per that file's own comment.
 * It doesn't follow the `${MARKER} School` convention because it's real
 * user-facing input, not a value the test constructs directly. Confirmed
 * safe to match exactly: no real school would be named this.
 */
const KNOWN_LITERAL_SCHOOL_NAMES = ['Test School']

/** src/app/training/admin/(protected)/promo-codes/actions.test.ts's baseInput() defaults description to this literal instead of its own MARKER. Same reasoning as KNOWN_LITERAL_SCHOOL_NAMES. */
const KNOWN_LITERAL_PROMO_DESCRIPTIONS = ['Test promo code']

/**
 * campaign-analytics.test.ts's "shows multiple courses (null courseName)"
 * test creates an EmailCampaign with courseId:null and never attaches a
 * recipient — by design, since the whole point of the test is a campaign
 * with no single course. Unreachable by any relational match; matched by
 * this exact literal instead.
 */
const KNOWN_LITERAL_EMAIL_CAMPAIGN_SUBJECTS = ['Spans courses']

/** marketing-campaign-analytics.test.ts's "filters by date range" test creates a MarketingCampaign with no template and no recipient — same reasoning as KNOWN_LITERAL_EMAIL_CAMPAIGN_SUBJECTS. */
const KNOWN_LITERAL_MARKETING_CAMPAIGN_SUBJECTS = ['In range']

/** Every test file, without exception, creates Teacher/Subscriber rows with an email at one of these two domains — neither is a real, resolvable domain, so this is safe as a standalone rule. */
const TEST_EMAIL_DOMAINS = ['@test.local', FIXTURE_TEACHER_EMAIL_DOMAIN]

const COURSE_SLUG_PREFIXES = [...FILE_MARKERS, FIXTURE_MARKER]
const SCHOOL_NAME_PREFIXES = [...FILE_MARKERS, FIXTURE_SCHOOL_PREFIX]
const PROMO_DESCRIPTION_PREFIXES = [...FILE_MARKERS]
const TEMPLATE_NAME_PREFIXES = [...FILE_MARKERS]

/**
 * AuditLog has no FK to anything — entityId is a bare string. Matching it
 * purely by "entityId belongs to a row we've identified as test data" fails
 * whenever the originating test file's own afterAll already deleted that
 * row first (observed live: registrations/actions.test.ts's own afterAll
 * has a pre-existing bug — it filters entityId against courseIds for
 * entityType:'Registration' audit rows, which should be registrationIds —
 * so its own cleanup silently matches nothing, every run). A relational
 * match alone can never be complete once the parent is already gone, so
 * AuditLog is also matched by searching its JSON payload text directly for
 * the same markers/domains: every test-created audit entry embeds a test
 * email or a marker-prefixed name in beforeJson/afterJson, and neither
 * string could ever appear in a real audit entry.
 */
const AUDIT_TEXT_NEEDLES = [...TEST_EMAIL_DOMAINS, ...FILE_MARKERS, FIXTURE_MARKER, FIXTURE_SCHOOL_PREFIX]

function emailIsTestMarked(): { OR: { emailNormalised: { endsWith: string } }[] } {
  return { OR: TEST_EMAIL_DOMAINS.map((domain) => ({ emailNormalised: { endsWith: domain } })) }
}

function startsWithAny(field: string, prefixes: readonly string[]) {
  return { OR: prefixes.map((prefix) => ({ [field]: { startsWith: prefix } })) }
}

/**
 * Deletes every row created by the test suite's known markers, in
 * foreign-key-safe order (children before parents). Safe to run against a
 * database that also holds real production data: every condition is either
 * an exact/prefix match against one of the explicit marker strings above,
 * or a relation to a row already identified that way — never a heuristic
 * that could match real teacher/course/subscriber data.
 */
export async function sweepTestData(prisma: PrismaClient): Promise<void> {
  const teachers = await prisma.teacher.findMany({ where: emailIsTestMarked(), select: { id: true } })
  const teacherIds = teachers.map((t) => t.id)

  const subscribers = await prisma.subscriber.findMany({ where: emailIsTestMarked(), select: { id: true } })
  const subscriberIds = subscribers.map((s) => s.id)

  const courses = await prisma.course.findMany({
    where: startsWithAny('slug', COURSE_SLUG_PREFIXES),
    select: { id: true },
  })
  const courseIds = courses.map((c) => c.id)

  const schools = await prisma.school.findMany({
    where: {
      OR: [
        ...startsWithAny('canonicalName', SCHOOL_NAME_PREFIXES).OR,
        { canonicalName: { in: KNOWN_LITERAL_SCHOOL_NAMES } },
      ],
    },
    select: { id: true },
  })
  const schoolIds = schools.map((s) => s.id)

  const promoCodes = await prisma.promoCode.findMany({
    where: {
      OR: [
        ...startsWithAny('description', PROMO_DESCRIPTION_PREFIXES).OR,
        { description: { in: KNOWN_LITERAL_PROMO_DESCRIPTIONS } },
      ],
    },
    select: { id: true },
  })
  const promoCodeIds = promoCodes.map((p) => p.id)

  const templates = await prisma.marketingTemplate.findMany({
    where: startsWithAny('name', TEMPLATE_NAME_PREFIXES),
    select: { id: true },
  })
  const templateIds = templates.map((t) => t.id)

  const emailCampaignRecipients = await prisma.emailCampaignRecipient.findMany({
    where: {
      OR: [
        { teacherId: { in: teacherIds } },
        { registration: { OR: [{ teacherId: { in: teacherIds } }, { courseId: { in: courseIds } }] } },
      ],
    },
    select: { id: true, campaignId: true },
  })
  const emailCampaignIds = [...new Set(emailCampaignRecipients.map((r) => r.campaignId))]
  // Some tests (e.g. campaign-analytics-test's pagination case) create bare
  // EmailCampaign rows with no course and no recipients, purely to test
  // list pagination — courseId/recipient relations can never reach these,
  // so subject is matched directly. Safe: a real campaign subject would
  // never literally start with one of these marker strings.
  const emailCampaignsByCourseOrSubject = await prisma.emailCampaign.findMany({
    where: {
      OR: [
        { courseId: { in: courseIds } },
        ...startsWithAny('subject', FILE_MARKERS).OR,
        { subject: { in: KNOWN_LITERAL_EMAIL_CAMPAIGN_SUBJECTS } },
      ],
    },
    select: { id: true },
  })
  const allEmailCampaignIds = [...new Set([...emailCampaignIds, ...emailCampaignsByCourseOrSubject.map((c) => c.id)])]

  const marketingCampaignRecipients = await prisma.marketingCampaignRecipient.findMany({
    where: { subscriberId: { in: subscriberIds } },
    select: { id: true, campaignId: true },
  })
  const marketingCampaignIdsFromRecipients = [...new Set(marketingCampaignRecipients.map((r) => r.campaignId))]
  // Same bare-row pagination pattern as EmailCampaign above — subject matched directly.
  const marketingCampaignsByTemplateOrSubject = await prisma.marketingCampaign.findMany({
    where: {
      OR: [
        { templateId: { in: templateIds } },
        ...startsWithAny('subject', FILE_MARKERS).OR,
        { subject: { in: KNOWN_LITERAL_MARKETING_CAMPAIGN_SUBJECTS } },
      ],
    },
    select: { id: true },
  })
  const allMarketingCampaignIds = [
    ...new Set([...marketingCampaignIdsFromRecipients, ...marketingCampaignsByTemplateOrSubject.map((c) => c.id)]),
  ]

  const registrations = await prisma.registration.findMany({
    where: { OR: [{ teacherId: { in: teacherIds } }, { courseId: { in: courseIds } }] },
    select: { id: true },
  })
  const registrationIds = registrations.map((r) => r.id)

  const auditEntityIds = [
    ...teacherIds,
    ...subscriberIds,
    ...courseIds,
    ...schoolIds,
    ...promoCodeIds,
    ...templateIds,
    ...allEmailCampaignIds,
    ...allMarketingCampaignIds,
    ...registrationIds,
  ]

  // FK-safe order: children before parents — same order used for the manual
  // production clear this incident required.
  await prisma.consentEvent.deleteMany({
    where: { OR: [{ subscriberId: { in: subscriberIds } }, { courseId: { in: courseIds } }] },
  })
  await prisma.marketingCampaignRecipient.deleteMany({ where: { id: { in: marketingCampaignRecipients.map((r) => r.id) } } })
  await prisma.marketingCampaign.deleteMany({ where: { id: { in: allMarketingCampaignIds } } })
  await prisma.marketingTemplate.deleteMany({ where: { id: { in: templateIds } } })
  await prisma.subscriber.deleteMany({ where: { id: { in: subscriberIds } } })
  await prisma.emailCampaignRecipient.deleteMany({ where: { id: { in: emailCampaignRecipients.map((r) => r.id) } } })
  await prisma.emailCampaign.deleteMany({ where: { id: { in: allEmailCampaignIds } } })
  await prisma.registration.deleteMany({ where: { id: { in: registrationIds } } })
  await prisma.promoCodeCourse.deleteMany({
    where: { OR: [{ promoCodeId: { in: promoCodeIds } }, { courseId: { in: courseIds } }] },
  })
  await prisma.promoCode.deleteMany({ where: { id: { in: promoCodeIds } } })
  await prisma.schoolAlias.deleteMany({ where: { schoolId: { in: schoolIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.school.deleteMany({ where: { id: { in: schoolIds } } })

  // Content-based backstop for AuditLog: catches rows whose identifying
  // parent was already deleted by that file's own (possibly buggy) afterAll
  // before this sweep ran — see AUDIT_TEXT_NEEDLES's comment above.
  const auditTextConditions = AUDIT_TEXT_NEEDLES.flatMap((needle) => [
    Prisma.sql`"beforeJson"::text ILIKE ${`%${needle}%`}`,
    Prisma.sql`"afterJson"::text ILIKE ${`%${needle}%`}`,
  ])
  const contentMatchedAudit = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "AuditLog" WHERE ${Prisma.join(auditTextConditions, ' OR ')}`,
  )
  const contentMatchedAuditIds = contentMatchedAudit.map((row) => row.id)

  await prisma.auditLog.deleteMany({
    where: { OR: [{ entityId: { in: auditEntityIds } }, { id: { in: contentMatchedAuditIds } }] },
  })
}

export default async function globalSetup() {
  const prisma = new PrismaClient()
  await sweepTestData(prisma)
  await prisma.$disconnect()

  return async function teardown() {
    const teardownPrisma = new PrismaClient()
    await sweepTestData(teardownPrisma)
    await teardownPrisma.$disconnect()
  }
}
