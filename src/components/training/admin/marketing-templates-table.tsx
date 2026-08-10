import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAdminTimestamp } from '@/domain/training/format'
import type { MarketingTemplateListItem } from '@/lib/training/marketing-templates'
import { MarketingTemplateRowActions } from './marketing-template-row-actions'

export function MarketingTemplatesTable({ templates }: { templates: MarketingTemplateListItem[] }) {
  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">No templates yet.</p>
  }

  return (
    <Table className="data-table">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last updated</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.id}>
            <TableCell className="font-medium text-foreground">{template.name}</TableCell>
            <TableCell>{template.subject}</TableCell>
            <TableCell>
              {template.archivedAt ? <Badge variant="default">Archived</Badge> : <Badge variant="success">Active</Badge>}
            </TableCell>
            <TableCell>{formatAdminTimestamp(template.updatedAt)}</TableCell>
            <TableCell>
              <MarketingTemplateRowActions template={template} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
