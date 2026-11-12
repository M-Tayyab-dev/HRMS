import { PERMISSIONS as P, type Permission } from '@hrms/shared';
import {
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  CalendarRange,
  Clock,
  Contact,
  FileText,
  Gift,
  HandCoins,
  HeartPulse,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  MessageSquareWarning,
  Network,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  UserMinus,
  Users,
  UsersRound,
  Utensils,
  Vote,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user holds any of these permissions. Empty = everyone. */
  any?: Permission[];
  teamLead?: boolean;
  employeeOnly?: boolean;
}

/**
 * A sidebar entry. Groups with several pages show only the group in the sidebar;
 * its pages appear as tabs at the top of the page (H3 navigation structure).
 */
export interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Approvals', icon: Inbox, items: [{ href: '/approvals', label: 'Approvals', icon: Inbox }] },
  {
    label: 'Employees',
    icon: Users,
    items: [
      { href: '/employees', label: 'Profiles', icon: Users, any: [P.EMPLOYEES_READ_ALL, P.EMPLOYEES_READ_TEAM] },
      { href: '/directory', label: 'Directory', icon: Contact },
      { href: '/org-chart', label: 'Org chart', icon: Network },
      { href: '/headcount', label: 'Headcount & reports', icon: TrendingUp, any: [P.HEADCOUNT_READ] },
      { href: '/departments', label: 'Departments & levels', icon: Building2, any: [P.DEPARTMENTS_MANAGE] },
      { href: '/teams', label: 'Teams', icon: UsersRound, any: [P.TEAMS_MANAGE, P.TEAMS_MANAGE_OWN] },
      { href: '/promotions', label: 'Promotions', icon: BadgeCheck, any: [P.PROMOTIONS_MANAGE] },
      { href: '/resignations', label: 'Resignations', icon: UserMinus },
    ],
  },
  {
    label: 'Attendance & leave',
    icon: Clock,
    items: [
      { href: '/attendance', label: 'Attendance', icon: Clock },
      { href: '/overtime', label: 'Overtime & compensation', icon: Timer },
      { href: '/leave', label: 'Leave & holidays', icon: CalendarRange },
      { href: '/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Payroll',
    icon: Banknote,
    items: [
      { href: '/payroll', label: 'Payroll', icon: Banknote, any: [P.PAYROLL_READ_ALL] },
      { href: '/payslips', label: 'My salary slips', icon: Receipt, employeeOnly: true },
      { href: '/loans', label: 'Loans', icon: HandCoins },
      { href: '/medical', label: 'Medical claims', icon: HeartPulse },
      { href: '/food-allowance', label: 'Food allowance', icon: Utensils, any: [P.FOOD_ALLOWANCE_MANAGE] },
    ],
  },
  { label: 'KPI & performance', icon: Target, items: [{ href: '/kpi', label: 'KPI & performance', icon: Target }] },
  {
    label: 'Compliance',
    icon: FileText,
    items: [
      { href: '/policies', label: 'Policies & documents', icon: FileText },
      { href: '/guidelines', label: 'Community guidelines', icon: ScrollText },
      { href: '/complaints', label: 'Complaints', icon: MessageSquareWarning },
      { href: '/queries', label: 'Queries & support', icon: LifeBuoy },
      { href: '/surveys', label: 'Surveys', icon: Vote },
    ],
  },
  {
    label: 'Community',
    icon: Sparkles,
    items: [
      { href: '/community', label: 'Feed', icon: Sparkles },
      { href: '/announcements', label: 'Announcements', icon: Megaphone },
      { href: '/birthdays', label: 'Birthdays', icon: Gift },
    ],
  },
  {
    label: 'Access & roles',
    icon: ShieldCheck,
    items: [
      { href: '/access/users', label: 'Users & access', icon: KeyRound, any: [P.USERS_MANAGE_ACCESS] },
      { href: '/access/roles', label: 'Roles & permissions', icon: ShieldCheck, any: [P.ROLES_MANAGE] },
      { href: '/access/audit', label: 'Audit trail', icon: History, any: [P.AUDIT_READ] },
    ],
  },
  { label: 'Settings', icon: Settings, items: [{ href: '/settings', label: 'Settings', icon: Settings, any: [P.TENANT_SETTINGS, P.ATTENDANCE_MANAGE, P.LEAVE_MANAGE, P.DIRECTORY_SETTINGS] }] },
];

/** True when `pathname` is `href` or a page below it. */
export const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** The nav item a path belongs to: the longest matching href wins (e.g. /community/guidelines → Feed). */
export function activeItem(pathname: string, items: NavItem[]): NavItem | undefined {
  return items.filter((i) => matches(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0];
}

export const LogoutIcon = LogOut;
