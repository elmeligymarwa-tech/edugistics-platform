import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { trainingPrisma?: PrismaClient }

export const prisma = globalForPrisma.trainingPrisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.trainingPrisma = prisma
}
