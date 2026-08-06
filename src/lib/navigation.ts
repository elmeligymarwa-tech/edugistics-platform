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
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Setup', href: '/setup', icon: SlidersHorizontal },
  { title: 'Revenue', href: '/revenue', icon: TrendingUp },
  { title: 'Staffing', href: '/staffing', icon: Users },
  { title: 'Expenses', href: '/expenses', icon: Receipt },
  { title: 'Financing', href: '/financing', icon: Landmark },
  { title: 'STM', href: '/stm', icon: Handshake },
  { title: 'Statements', href: '/statements', icon: FileText },
  { title: 'Valuation', href: '/valuation', icon: LineChart },
  { title: 'Reports', href: '/reports', icon: BarChart3 },
  { title: 'Scenarios', href: '/scenarios', icon: GitBranch },
  { title: 'Settings', href: '/settings', icon: Settings },
]

export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
}
