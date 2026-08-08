import { Badge } from '@/components/ui/badge'

export function CourseStatusBadge({ isActive, archivedAt }: { isActive: boolean; archivedAt: Date | null }) {
  if (archivedAt) return <Badge variant="outline">Archived</Badge>
  if (isActive) return <Badge variant="success">Active</Badge>
  return <Badge variant="default">Draft</Badge>
}
