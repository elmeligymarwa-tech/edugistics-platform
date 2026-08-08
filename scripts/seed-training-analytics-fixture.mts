// Phase 4 analytics fixture seed. Idempotent and additive-safe: every row it
// creates carries a marker (course slug prefix, teacher email domain, school
// name prefix) unique to this fixture, so re-running it first deletes only
// its own prior rows and never touches real data in a shared dev database.
//
// The actual seeding logic lives in seedTrainingAnalyticsFixture so the
// analytics test suite (src/lib/training/analytics.test.ts) can call the
// exact same routine against the app's Prisma client — one seeding
// implementation, run from two entry points.
import { PrismaClient } from '@prisma/client'

import { FIXTURE_COURSES, FIXTURE_SCHOOLS, FIXTURE_TEACHERS, seedTrainingAnalyticsFixture } from './training-analytics-fixture-plan.ts'

const prisma = new PrismaClient()

seedTrainingAnalyticsFixture(prisma)
  .then((registrationCount) => {
    console.log(
      JSON.stringify({
        schools: FIXTURE_SCHOOLS.length,
        courses: FIXTURE_COURSES.length,
        teachers: FIXTURE_TEACHERS.length,
        registrations: registrationCount,
      }),
    )
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
