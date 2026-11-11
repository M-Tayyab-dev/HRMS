'use client';

import { ROLE_LABELS, ROLES, canAssignRole, type Paginated, type Role } from '@hrms/shared';
import { KeyRound, Mail, MoreHorizontal, Search, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, PageHeader, StatusBadge } from '@/components/ui/display';
import { Checkbox, Field, Input } from '@/components/ui/form';
import { Dialog, Dropdown, DropdownItem, DropdownSeparator, useConfirm } from '@/components/ui/overlay';
import { DataTable, Pagination } from '@/components/ui/table';
import { qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relative } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface U { id: string; email: string; status: string; lastLoginAt: string | null; lockedUntil: string | null; fullName: string | null; employeeCode: string | null; designation: string | null; roles: Role[] }

/** A1 – grant/revoke access, reset links, direct password resets (HR, Operations, Super Admin). */
export default function UsersPage() {
  const { me } = useAuth();
  const actorRoles = me?.user.roles ?? [];
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading, error } = useApi<Paginated<U>>(`/access/users${qs({ page, pageSize: 25, search: q })}`);
  const [rolesFor, setRolesFor] = useState<U | null>(null);
  const [roleSel, setRoleSel] = useState<Role[]>([]);
  const [pwFor, setPwFor] = useState<U | null>(null);
  const [pw, setPw] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const { confirm, node } = useConfirm();

  const setRoles = useAction<{ id: string; roles: Role[] }>('put', (v) => `/access/users/${v.id}/roles`, { invalidate: ['/access/users'], success: 'Roles updated', body: (v) => ({ roles: v.roles }), onSuccess: () => setRolesFor(null) });
  const setStatus = useAction<{ id: string; status: 'ACTIVE' | 'DISABLED' }>('patch', (v) => `/access/users/${v.id}/status`, { invalidate: ['/access/users'], success: (r) => ((r as { status: string }).status === 'DISABLED' ? 'Access revoked and sessions signed out' : 'Access restored'), body: (v) => ({ status: v.status }) });
  const resetLink = useAction<string>('post', (id) => `/access/users/${id}/reset-link`, { success: 'Link emailed', body: () => ({}) });
  const setPassword = useAction<{ id: string }>('post', (v) => `/access/users/${v.id}/password`, { success: 'Password set. The user was signed out everywhere.', body: () => ({ password: pw, mustChange }), onSuccess: () => { setPwFor(null); setPw(''); } });

  const canManage = (u: U) => u.id !== me?.user.id && u.roles.every((r) => canAssignRole(actorRoles, r));

  return (
    <>
      <PageHeader title="Users & access" description="Grant or revoke access, send password reset links, or reset passwords directly." />
      <Card>
        <div className="border-b p-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input className="pl-9" placeholder="Search name or email…" aria-label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <DataTable loading={isLoading} error={error} rows={data?.items} rowKey={(u) => u.id} columns={[
          { key: 'u', header: 'User', cell: (u) => <div><p className="font-medium">{u.fullName ?? u.email}</p><p className="text-xs text-muted-foreground">{u.email}{u.employeeCode ? ` · ${u.employeeCode}` : ''}</p></div> },
          { key: 'r', header: 'Roles', cell: (u) => <div className="flex flex-wrap gap-1">{u.roles.filter((r) => r !== 'EMPLOYEE').map((r) => <Badge key={r} tone="primary">{ROLE_LABELS[r]}</Badge>)}{u.roles.length === 1 && <Badge>Employee</Badge>}</div> },
          { key: 's', header: 'Access', cell: (u) => <div className="flex flex-col gap-1"><StatusBadge status={u.status} />{u.lockedUntil && new Date(u.lockedUntil) > new Date() && <Badge tone="danger">locked</Badge>}</div> },
          { key: 'l', header: 'Last sign-in', hideOnMobile: true, cell: (u) => <span className="text-muted-foreground">{u.lastLoginAt ? relative(u.lastLoginAt) : 'Never'}</span> },
          {
            key: 'a', header: <span className="sr-only">Actions</span>, className: 'w-12',
            cell: (u) => canManage(u) ? (
              <Dropdown trigger={<Button variant="ghost" size="icon" aria-label={`Actions for ${u.email}`}><MoreHorizontal className="h-4 w-4" /></Button>}>
                <DropdownItem onSelect={() => { setRolesFor(u); setRoleSel(u.roles); }}><ShieldCheck className="h-4 w-4" /> Change roles</DropdownItem>
                <DropdownItem onSelect={() => resetLink.mutate(u.id)}><Mail className="h-4 w-4" /> {u.status === 'INVITED' ? 'Resend invitation' : 'Send reset link'}</DropdownItem>
                <DropdownItem onSelect={() => setPwFor(u)}><KeyRound className="h-4 w-4" /> Set password</DropdownItem>
                <DropdownSeparator />
                {u.status === 'DISABLED' ? (
                  <DropdownItem onSelect={() => setStatus.mutate({ id: u.id, status: 'ACTIVE' })}><UserCheck className="h-4 w-4" /> Restore access</DropdownItem>
                ) : (
                  <DropdownItem danger onSelect={async () => { if (await confirm({ title: `Revoke access for ${u.email}?`, body: 'They will be signed out immediately and cannot sign in until access is restored.', danger: true, confirmLabel: 'Revoke access' })) setStatus.mutate({ id: u.id, status: 'DISABLED' }); }}><UserX className="h-4 w-4" /> Revoke access</DropdownItem>
                )}
              </Dropdown>
            ) : null,
          },
        ]} />
        {data && <Pagination page={page} pageSize={25} total={data.total} onPage={setPage} />}
      </Card>

      <Dialog open={!!rolesFor} onOpenChange={(o) => !o && setRolesFor(null)} title={`Roles for ${rolesFor?.fullName ?? rolesFor?.email ?? ''}`} description="Everyone keeps the Employee role." size="sm"
        footer={<><Button variant="outline" onClick={() => setRolesFor(null)}>Cancel</Button><Button loading={setRoles.isPending} onClick={() => rolesFor && setRoles.mutate({ id: rolesFor.id, roles: roleSel })}>Save</Button></>}>
        <div className="flex flex-col gap-3">
          {ROLES.filter((r) => r !== 'EMPLOYEE').map((r) => (
            <Checkbox key={r} label={ROLE_LABELS[r]} disabled={!canAssignRole(actorRoles, r)} checked={roleSel.includes(r)} onChange={() => setRoleSel((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))} />
          ))}
        </div>
      </Dialog>

      <Dialog open={!!pwFor} onOpenChange={(o) => !o && setPwFor(null)} title={`Set password for ${pwFor?.email ?? ''}`} description="Share it securely. They'll be signed out of all devices." size="sm"
        footer={<><Button variant="outline" onClick={() => setPwFor(null)}>Cancel</Button><Button loading={setPassword.isPending} disabled={pw.length < 12} onClick={() => pwFor && setPassword.mutate({ id: pwFor.id })}>Set password</Button></>}>
        <div className="space-y-4">
          <Field label="New password" hint="At least 12 characters with upper and lower case letters and a number.">{(a) => <Input {...a} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
          <Checkbox label="Require a new password at next sign-in" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
        </div>
      </Dialog>
      {node}
    </>
  );
}
