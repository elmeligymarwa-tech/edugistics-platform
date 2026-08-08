import { prisma } from './prisma'

/** Lowercases, strips punctuation, and collapses whitespace/hyphen runs into single hyphens. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Generates a slug from the course name and appends a numeric suffix until
 * it is free. Only called on create — an existing course's slug is never
 * regenerated, since that would break any link already shared.
 */
export async function generateUniqueCourseSlug(name: string): Promise<string> {
  const base = slugify(name) || 'course'
  let candidate = base
  let suffix = 2

  while (await prisma.course.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}
