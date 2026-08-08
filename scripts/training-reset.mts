// Deletes every row from the training module tables, keeping the schema
// intact. Scoped to exactly the six training models in prisma/schema.prisma
// (Course, Teacher, School, SchoolAlias, Registration, AuditLog) — no other
// table is touched. Deletion order respects foreign keys: children before
// parents (AuditLog and Registration have no dependents; Course and School
// are deleted last since Teacher/Registration/SchoolAlias reference them).
//
// Requires --confirm so an accidental `node scripts/training-reset.mts` does
// nothing.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
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
