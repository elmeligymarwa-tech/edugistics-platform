import 'server-only'

import { Badge } from '@/components/ui/badge'
import { databaseEnvironmentBadgeInfo, resolveDatabaseEnvironment } from '@/lib/training/database-environment'

/**
 * Reads DATABASE_URL directly, server-side only — the connection string
 * itself never leaves this component; only the resulting label/variant are
 * rendered. Invisible on production (the normal admin) by design; anything
 * else, including a database this can't identify, shows up rather than
 * being silently treated as safe. See TEST-DATABASE.md.
 */
export function DatabaseEnvironmentBadge() {
  const info = databaseEnvironmentBadgeInfo(resolveDatabaseEnvironment(process.env.DATABASE_URL))
  if (!info) return null
  return <Badge variant={info.variant}>{info.label}</Badge>
}
