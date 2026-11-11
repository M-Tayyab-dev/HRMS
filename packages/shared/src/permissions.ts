/**
 * Permission catalogue (A1, F4, H2).
 * Permissions are plain strings so tenants can re-assign them to roles at runtime.
 */
export const ROLES = ['SUPER_ADMIN', 'HR', 'OPERATIONS', 'TEAM_LEAD', 'EMPLOYEE'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR: 'HR',
  OPERATIONS: 'Operations',
  TEAM_LEAD: 'Team Lead',
  EMPLOYEE: 'Employee',
};

export const PERMISSIONS = {
  // Access & roles (A1)
  ROLES_MANAGE: 'roles.manage',
  USERS_MANAGE_ACCESS: 'users.manage_access',
  TENANT_SETTINGS: 'tenant.settings',
  AUDIT_READ: 'audit.read',

  // Employees (B)
  EMPLOYEES_READ_ALL: 'employees.read.all',
  EMPLOYEES_READ_TEAM: 'employees.read.team',
  EMPLOYEES_MANAGE: 'employees.manage',
  EMPLOYEE_DOCS_MANAGE: 'employee_docs.manage',
  EMPLOYMENT_DOCS_MANAGE: 'employment_docs.manage',
  DEPARTMENTS_MANAGE: 'departments.manage',
  TEAMS_MANAGE: 'teams.manage',
  TEAMS_MANAGE_OWN: 'teams.manage_own',
  TEAM_TRANSFER_APPROVE: 'team_transfer.approve',
  PROMOTIONS_MANAGE: 'promotions.manage',
  RESIGNATION_APPROVE_TL: 'resignation.approve.tl',
  RESIGNATION_APPROVE_HR: 'resignation.approve.hr',
  HEADCOUNT_READ: 'headcount.read',
  DIRECTORY_SETTINGS: 'directory.settings',

  // Attendance, overtime, leave, calendar (C)
  ATTENDANCE_READ_ALL: 'attendance.read.all',
  ATTENDANCE_READ_TEAM: 'attendance.read.team',
  ATTENDANCE_MANAGE: 'attendance.manage',
  ATTENDANCE_CORRECTION_APPROVE_TL: 'attendance_correction.approve.tl',
  ATTENDANCE_CORRECTION_APPROVE_HR: 'attendance_correction.approve.hr',
  OVERTIME_APPROVE_TL: 'overtime.approve.tl',
  COMPENSATION_APPROVE_TL: 'compensation.approve.tl',
  COMPENSATION_APPROVE_HR: 'compensation.approve.hr',
  LEAVE_APPROVE_TL: 'leave.approve.tl',
  LEAVE_APPROVE_HR: 'leave.approve.hr',
  LEAVE_MANAGE: 'leave.manage',
  HOLIDAYS_MANAGE: 'holidays.manage',
  CALENDAR_MANAGE: 'calendar.manage',

  // Payroll (D)
  PAYROLL_READ_ALL: 'payroll.read.all',
  PAYROLL_PROCESS: 'payroll.process',
  PAYROLL_APPROVE_HR: 'payroll.approve.hr',
  PAYROLL_APPROVE_OPS: 'payroll.approve.ops',
  LOANS_MANAGE: 'loans.manage',
  MEDICAL_MANAGE: 'medical.manage',
  FOOD_ALLOWANCE_MANAGE: 'food_allowance.manage',

  // Performance (E)
  KPI_APPROVE_TL: 'kpi.approve.tl',
  KPI_APPROVE_HR: 'kpi.approve.hr',
  KPI_TARGETS_MANAGE: 'kpi.targets.manage',
  INCENTIVES_MANAGE: 'incentives.manage',

  // Compliance (F)
  POLICIES_MANAGE: 'policies.manage',
  GUIDELINES_MANAGE: 'guidelines.manage',
  COMPLAINTS_MANAGE: 'complaints.manage',
  QUERIES_RESPOND: 'queries.respond',
  QUERIES_READ_ALL: 'queries.read.all',
  SURVEYS_MANAGE: 'surveys.manage',
  SURVEYS_MANAGE_TEAM: 'surveys.manage_team',

  // Community (G)
  COMMUNITY_MODERATE: 'community.moderate',
  COMMUNITY_POSTING_MANAGE: 'community.posting.manage',
  ANNOUNCEMENTS_PUBLISH: 'announcements.publish',

  // Reports
  REPORTS_READ: 'reports.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

const P = PERMISSIONS;

/** Default permission sets per role (tenants may customise; A1). */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  HR: [
    P.USERS_MANAGE_ACCESS, P.ROLES_MANAGE, P.AUDIT_READ,
    P.EMPLOYEES_READ_ALL, P.EMPLOYEES_MANAGE, P.EMPLOYEE_DOCS_MANAGE, P.EMPLOYMENT_DOCS_MANAGE,
    P.DEPARTMENTS_MANAGE, P.TEAMS_MANAGE, P.TEAM_TRANSFER_APPROVE, P.PROMOTIONS_MANAGE,
    P.RESIGNATION_APPROVE_HR, P.HEADCOUNT_READ,
    P.ATTENDANCE_READ_ALL, P.ATTENDANCE_MANAGE, P.ATTENDANCE_CORRECTION_APPROVE_HR,
    P.COMPENSATION_APPROVE_HR, P.LEAVE_APPROVE_HR, P.LEAVE_MANAGE, P.HOLIDAYS_MANAGE, P.CALENDAR_MANAGE,
    P.PAYROLL_READ_ALL, P.PAYROLL_PROCESS, P.PAYROLL_APPROVE_HR, P.LOANS_MANAGE, P.MEDICAL_MANAGE,
    P.FOOD_ALLOWANCE_MANAGE,
    P.KPI_APPROVE_HR, P.KPI_TARGETS_MANAGE, P.INCENTIVES_MANAGE,
    P.POLICIES_MANAGE, P.GUIDELINES_MANAGE, P.COMPLAINTS_MANAGE, P.QUERIES_READ_ALL, P.SURVEYS_MANAGE,
    P.COMMUNITY_MODERATE, P.COMMUNITY_POSTING_MANAGE, P.ANNOUNCEMENTS_PUBLISH,
    P.REPORTS_READ,
  ],
  OPERATIONS: [
    P.USERS_MANAGE_ACCESS, P.EMPLOYEES_READ_ALL, P.HEADCOUNT_READ, P.DIRECTORY_SETTINGS,
    P.ATTENDANCE_READ_ALL, P.ATTENDANCE_MANAGE,
    P.PAYROLL_READ_ALL, P.PAYROLL_PROCESS, P.PAYROLL_APPROVE_OPS, P.LOANS_MANAGE, P.FOOD_ALLOWANCE_MANAGE,
    P.COMMUNITY_POSTING_MANAGE, P.REPORTS_READ,
  ],
  TEAM_LEAD: [
    P.EMPLOYEES_READ_TEAM, P.TEAMS_MANAGE_OWN, P.RESIGNATION_APPROVE_TL,
    P.ATTENDANCE_READ_TEAM, P.ATTENDANCE_CORRECTION_APPROVE_TL, P.OVERTIME_APPROVE_TL,
    P.COMPENSATION_APPROVE_TL, P.LEAVE_APPROVE_TL,
    P.KPI_APPROVE_TL, P.QUERIES_RESPOND, P.SURVEYS_MANAGE_TEAM,
  ],
  EMPLOYEE: [],
};

/** Roles allowed to grant/revoke a given role (Super Admin is only grantable by Super Admin). */
export function canAssignRole(actorRoles: Role[], target: Role): boolean {
  if (actorRoles.includes('SUPER_ADMIN')) return true;
  if (target === 'SUPER_ADMIN') return false;
  return actorRoles.includes('HR') || actorRoles.includes('OPERATIONS');
}
