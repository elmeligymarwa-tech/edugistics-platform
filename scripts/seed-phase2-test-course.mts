import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const slug = 'phase2-test-course'

  const course = await prisma.course.upsert({
    where: { slug },
    update: {
      isActive: true,
      archivedAt: null,
      maxCapacity: 1,
      waitlistEnabled: true,
      waitlistCapacity: 5,
      registrationOpensAt: null,
      registrationClosesAt: null,
    },
    create: {
      name: 'Phase 2 Verification Course',
      slug,
      shortDescription: 'Internal course used to verify the Phase 2 public registration flow.',
      fullDescription: 'Internal course used to verify the Phase 2 public registration flow.',
      category: 'PROFESSIONAL_DEVELOPMENT',
      courseDate: new Date('2026-04-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T11:00:00.000Z'),
      durationMinutes: 120,
      deliveryMethod: 'ONLINE',
      joiningInstructions: 'Join via the link in your confirmation email.',
      feeAmount: 0,
      currency: 'EGP',
      maxCapacity: 1,
      waitlistEnabled: true,
      waitlistCapacity: 5,
      isActive: true,
      isFeatured: false,
    },
  })

  // Fresh state for a repeatable test run.
  await prisma.registration.deleteMany({ where: { courseId: course.id } })

  console.log(JSON.stringify({ id: course.id, slug: course.slug }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
