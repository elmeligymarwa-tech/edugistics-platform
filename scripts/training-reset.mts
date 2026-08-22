// Deletes every row from the training module tables, keeping the schema
// intact. Scoped to exactly the six training models in prisma/schema.prisma
// (Course, Teacher, School, SchoolAlias, Registration, AuditLog) — no other
// table is touched. Deletion order respects foreign keys: children before
// parents (AuditLog and Registration have no dependents; Course and School
// are deleted last since Teacher/Registration/SchoolAlias reference them).
//
// Requires --confirm so an accidental `node scripts/training-reset.mts` does
// nothing.
//
// Refuses to run against production outright, independent of --confirm and
// independent of which env file supplied DATABASE_URL — see
// isProductionDatabaseUrl in vitest.database-guard.ts, the same denylist the
// test suite itself uses. This script deletes every row in these tables, so
// an env file accidentally pointing at production must never be enough to
// let it proceed.
import { PrismaClient } from '@prisma/client'

import { isProductionDatabaseUrl } from '../vitest.database-guard.ts'

const prisma = new PrismaClient()

async function main() {
  if (isProductionDatabaseUrl(process.env.DATABASE_URL)) {
    console.error(
      'Refusing to run: DATABASE_URL resolves to the production Supabase project.\n' +
        'training:reset deletes every row in these tables and must never target production.',
    )
    process.exitCode = 1
    return
  }

  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run: pass --confirm to delete all training data.\n' + 'Example: npm run training:reset -- --confirm')
    process.exitCode = 1
    return
  }

  const [auditLog, registration, schoolAlias, teacher, school, course] = await prisma.$transaction([
    prisma.auditLog.deleteMany({}),
    prisma.registration.deleteMany({}),
    prisma.schoolAlias.deleteMany({}),
    prisma.teacher.deleteMany({}),
    prisma.school.deleteMany({}),
    prisma.course.deleteMany({}),
  ])

  console.log(
    JSON.stringify(
      {
        deleted: {
          auditLog: auditLog.count,
          registration: registration.count,
          schoolAlias: schoolAlias.count,
          teacher: teacher.count,
          school: school.count,
          course: course.count,
        },
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
