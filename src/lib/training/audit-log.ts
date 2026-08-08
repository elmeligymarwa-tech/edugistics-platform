import 'server-only'

import { Prisma } from '@prisma/client'

import { prisma } from './prisma'

/** No per-admin identity exists yet (a single shared admin password) — every entry is attributed to this constant actor. */
export const ADMIN_ACTOR = 'admin'

export interface AuditLogEntry {
  action: string
  entityType: string
  entityId: string
  beforeJson?: Prisma.InputJsonValue
  afterJson?: Prisma.InputJsonValue
}

/** Writes one audit trail row. Called after the mutation it records has already committed. */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actor: ADMIN_ACTOR,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeJson: entry.beforeJson,
      afterJson: entry.afterJson,
    },
  })
}
