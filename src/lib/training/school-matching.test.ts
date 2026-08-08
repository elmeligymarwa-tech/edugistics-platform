import { afterAll, describe, expect, it } from 'vitest'

import { normaliseSchoolNameKey } from './normalise'
import { prisma } from './prisma'
import { resolveSchool } from './school-matching'

// Self-cleaning; hits the real database like the other integration suites in this folder.
const MARKER = 'school-matching-test'
const createdSchoolIds: string[] = []

afterAll(async () => {
  await prisma.schoolAlias.deleteMany({ where: { schoolId: { in: createdSchoolIds } } })
  await prisma.school.deleteMany({ where: { id: { in: createdSchoolIds } } })
  await prisma.$disconnect()
})

describe('resolveSchool', () => {
  it('links two spellings that normalise to the same key to a single School row', async () => {
    const first = await resolveSchool(prisma, `${MARKER} Cairo International School`)
    createdSchoolIds.push(first.id)
    const second = await resolveSchool(prisma, `  ${MARKER} CAIRO   International  `)

    expect(second.id).toBe(first.id)

    const matches = await prisma.school.findMany({ where: { canonicalName: { startsWith: `${MARKER} Cairo` } } })
    expect(matches).toHaveLength(1)
  })

  it('creates a new School for a genuinely different name and keeps the original typed name as canonicalName', async () => {
    const school = await resolveSchool(prisma, `${MARKER} Giza Academy`)
    createdSchoolIds.push(school.id)

    expect(school.canonicalName).toBe(`${MARKER} Giza Academy`)
  })

  it('resolves through a SchoolAlias without ever overwriting the alias target', async () => {
    const target = await resolveSchool(prisma, `${MARKER} Alexandria School`)
    createdSchoolIds.push(target.id)

    const alias = await prisma.schoolAlias.create({
      data: { schoolId: target.id, aliasKey: normaliseSchoolNameKey(`${MARKER} Alexandria Old Name`) },
    })

    const resolved = await resolveSchool(prisma, `${MARKER} Alexandria Old Name`)
    expect(resolved.id).toBe(target.id)

    await prisma.schoolAlias.delete({ where: { id: alias.id } })
  })
})
