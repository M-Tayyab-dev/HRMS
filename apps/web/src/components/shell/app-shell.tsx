'use client';

import { Bell, Building, Menu, Moon, Sun, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { cn, relative } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { LogoutIcon, NAV, type NavItem } from '@/lib/nav';
import { useTheme } from '../theme';
import { Button } from '../ui/button';
import { Avatar, Badge, Skeleton } from '../ui/display';
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '../ui/overlay';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

function NotificationBell() {
  const router = useRouter();
  const { data: count } = useApi<{ count: number }>('/notifications/unread-count', { refetchInterval: 60_000 });
  const { data: items } = useApi<Notification[]>('/notifications?limit=15');
  const read = useAction<string>('post', (id) => `/notifications/${id}/read`, { invalidate: ['/notifications'] });
  const readAll = useAction('post', '/notifications/read-all', { invalidate: ['/notifications'] });
  const n = count?.count ?? 0;
  return (
    <Dropdown
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Notifications${n ? `, ${n} unread` : ''}`} className="relative">
          <Bell className="h-5 w-5" />
          {n > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {n > 99 ? '99+' : n}
            </span>
          )}
        </Button>
      }
    >
      <div className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">Notifications</span>
          {n > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => readAll.mutate(undefined)}>
              Mark all read
            </button>
          )}
        </div>
        <DropdownSeparator />
        <div className="max-h-96 overflow-y-auto">
          {!items?.length && <p className="px-2 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>}
          {items?.map((i) => (
            <DropdownItem
              key={i.id}
              onSelect={() => {
                if (!i.readAt) read.mutate(i.id);
                if (i.link) router.push(i.link);
              }}
            >
              <div className="flex w-full gap-2 py-0.5">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', i.readAt ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                <div className="min-w-0">
                  <p className={cn('text-sm leading-snug', !i.readAt && 'font-medium')}>{i.title}</p>
                  {i.body && <p className="truncate text-xs text-muted-foreground">{i.body}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{relative(i.createdAt)}</p>
                </div>
              </div>
            </DropdownItem>
          ))}
        </div>
        <DropdownSeparator />
        <DropdownItem onSelect={() => router.push('/notifications')}>View all notifications</DropdownItem>
      </div>
    </Dropdown>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, isTeamLead, me } = useAuth();
  const { data: inbox } = useApi<unknown[]>('/approvals/inbox', { refetchInterval: 120_000 });
  const visible = (i: NavItem) => {
    if (i.employeeOnly && !me?.employee) return false;
    if (i.teamLead && !isTeamLead) return false;
    if (i.any?.length && !can(...i.any)) return false;
    return true;
  };
  return (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map((s, idx) => {
        const items = s.items.filter(visible);
        if (!items.length) return null;
        return (
          <div key={s.label ?? idx}>
            {s.label && <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-sidebar-heading uppercase">{s.label}</p>}
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = pathname === i.href || (i.href !== '/dashboard' && pathname.startsWith(`${i.href}/`));
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-active hover:text-white',
                        active && 'bg-sidebar-active font-medium text-white',
                      )}
                    >
                      <i.icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      <span className="truncate">{i.label}</span>
                      {i.href === '/approvals' && !!inbox?.length && (
                        <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-white">{inbox.length}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, loading, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Gates: forced password change, onboarding documents (B2).
  useEffect(() => {
    if (!me) return;
    if (me.user.mustChangePassword && pathname !== '/profile') router.replace('/profile?tab=security&force=1');
    else if (me.onboardingRequired && pathname !== '/onboarding') router.replace('/onboarding');
  }, [me, pathname, router]);

  if (loading || !me) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 bg-sidebar lg:block" />
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
          <Building className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{me.tenant.name}</p>
          <p className="truncate text-[11px] text-sidebar-heading">{me.tenant.slug}</p>
        </div>
      </div>
      <SideNav onNavigate={() => setMobileOpen(false)} />
      <div className="border-t border-white/10 p-3">
        <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-active hover:text-white">
          <LogoutIcon className="h-4 w-4" aria-hidden /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%]">{sidebar}</div>
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-white" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <NotificationBell />
        <Dropdown
          trigger={
            <button className="ml-1 flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-muted" aria-label="Account menu">
              <Avatar name={me.employee?.fullName ?? me.user.email} fileId={me.employee?.avatarFileId} size="sm" />
              <span className="hidden text-sm font-medium sm:block">{me.employee?.fullName ?? me.user.email}</span>
            </button>
          }
        >
          <DropdownLabel>
            <span className="block text-sm font-medium text-foreground">{me.employee?.fullName ?? me.user.email}</span>
            <span className="block">{me.user.email}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              {me.user.roles
                .filter((r) => r !== 'EMPLOYEE')
                .map((r) => (
                  <Badge key={r} tone="primary">
                    {r.replace('_', ' ').toLowerCase()}
                  </Badge>
                ))}
            </span>
          </DropdownLabel>
          <DropdownSeparator />
          <DropdownItem onSelect={() => router.push('/profile')}>
            <UserRound className="h-4 w-4" /> My profile
          </DropdownItem>
          <DropdownItem onSelect={logout} danger>
            <LogoutIcon className="h-4 w-4" /> Log out
          </DropdownItem>
        </Dropdown>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
