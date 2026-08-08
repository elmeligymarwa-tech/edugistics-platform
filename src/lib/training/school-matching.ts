import type { Prisma, School } from '@prisma/client'

import { prisma } from './prisma'
import { normaliseSchoolNameKey } from './normalise'

type SchoolClient = typeof prisma | Prisma.TransactionClient

/** Exact nameKey match against School or SchoolAlias, else create a new School. No fuzzy matching — merging is a manual admin action. */
export async function resolveSchool(client: SchoolClient, schoolNameOriginal: string): Promise<School> {
  const nameKey = normaliseSchoolNameKey(schoolNameOriginal)

  const alias = await client.schoolAlias.findUnique({ where: { aliasKey: nameKey } })
  if (alias) {
    return client.school.findUniqueOrThrow({ where: { id: alias.schoolId } })
  }

  const existing = await client.school.findUnique({ where: { nameKey } })
  if (existing) return existing

  return client.school.create({
    data: {
      canonicalName: schoolNameOriginal.trim(),
      nameKey,
    },
  })
}
