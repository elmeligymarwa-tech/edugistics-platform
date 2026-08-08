import {
  LayoutDashboard,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Receipt,
  Landmark,
  Handshake,
  FileText,
  LineChart,
  BarChart3,
  GitBranch,
  BookOpen,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { title: 'Setup', href: '/app/setup', icon: SlidersHorizontal },
  { title: 'Revenue', href: '/app/revenue', icon: TrendingUp },
  { title: 'Staffing', href: '/app/staffing', icon: Users },
  { title: 'Expenses', href: '/app/expenses', icon: Receipt },
  { title: 'Financing', href: '/app/financing', icon: Landmark },
  { title: 'STM', href: '/app/stm', icon: Handshake },
  { title: 'Statements', href: '/app/statements', icon: FileText },
  { title: 'Valuation', href: '/app/valuation', icon: LineChart },
  { title: 'Reports', href: '/app/reports', icon: BarChart3 },
  { title: 'Scenarios', href: '/app/scenarios', icon: GitBranch },
  { title: 'Glossary', href: '/app/glossary', icon: BookOpen },
  { title: 'Settings', href: '/app/settings', icon: Settings },
]

export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
}
