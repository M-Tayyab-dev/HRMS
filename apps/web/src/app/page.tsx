import {
  ArrowRight,
  Building,
  CalendarDays,
  CircleCheck,
  Fingerprint,
  Lock,
  Megaphone,
  ShieldCheck,
  Target,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { absolute: 'HRMS: attendance, leave, payroll and people in one workspace' },
  description:
    'A multi-company HR workspace: employee records, biometric attendance, leave, working-hours payroll, performance and compliance, with role-based approvals.',
  robots: { index: true, follow: true },
};

const MODULES = [
  {
    icon: Users,
    title: 'Employees & documents',
    text: 'Profiles, documents, levels, promotions, resignations, a searchable directory and a live org chart.',
  },
  {
    icon: Fingerprint,
    title: 'Attendance & overtime',
    text: 'Biometric device punches or imports, daily and monthly views, corrections and overtime with approvals.',
  },
  {
    icon: CalendarDays,
    title: 'Leave & holidays',
    text: 'Leave types, allocations and balances, requests and cancellations, plus a shared company calendar.',
  },
  {
    icon: Wallet,
    title: 'Payroll',
    text: 'Working-hours payroll runs, adjustments, loans, medical claims, food allowance and PDF salary slips.',
  },
  {
    icon: Target,
    title: 'Performance',
    text: 'KPI targets and submissions, incentives and employee surveys with results.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance',
    text: 'Policies and guidelines, anonymous complaints, HR queries and a full audit trail.',
  },
  {
    icon: Megaphone,
    title: 'Community',
    text: 'Announcements, birthdays, a moderated company feed and in-app notifications.',
  },
  {
    icon: Workflow,
    title: 'Approval workflows',
    text: 'Team Lead to HR approval chains for leave, attendance, overtime, payroll and more.',
  },
];

const SECURITY = [
  'Every company gets its own isolated workspace, enforced in the database',
  'Role-based access with fine-grained permissions for admins, HR, team leads and employees',
  'Passwords hashed with Argon2id, secure cookies and CSRF protection',
  'Append-only audit log of every sensitive change',
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white">
              <Building className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg font-semibold">HRMS</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <a href="#features" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block">
              Features
            </a>
            <a href="#security" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block">
              Security
            </a>
            <Link href="/login" className="rounded-md px-3 py-2 font-medium hover:bg-muted">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-md bg-primary px-4 py-2 font-medium text-white hover:opacity-90">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-sidebar text-white">
          <div className="pointer-events-none absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary/30 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <p className="text-sm font-medium tracking-wide text-blue-300 uppercase">HR software for growing teams</p>
            <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold sm:text-5xl">
              Your whole team, from first day to payday.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-300">
              Attendance, leave, payroll, performance and policies in one secure workspace, with approvals that
              follow your org chart.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-medium text-white hover:opacity-90"
              >
                Create your workspace <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-3 font-medium text-white hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">Set up your company in minutes. You become its Super Admin.</p>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold">Everything HR runs on</h2>
            <p className="mt-3 text-muted-foreground">
              One place for the people side of your company, so nothing lives in spreadsheets and chat threads.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-lg border bg-card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="security" className="scroll-mt-20 border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Lock className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-3xl font-semibold">Built for sensitive people data</h2>
              <p className="mt-3 text-muted-foreground">
                Salaries, medical claims and complaints need more than a login screen. Security is built into every
                layer, from the database up.
              </p>
            </div>
            <ul className="space-y-4">
              {SECURITY.map((s) => (
                <li key={s} className="flex gap-3">
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-semibold">Ready to bring your team together?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Create a workspace for your company, invite your HR team and add employees.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-medium text-white hover:opacity-90"
            >
              Get started <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/login" className="inline-flex items-center rounded-md border px-5 py-3 font-medium hover:bg-muted">
              Sign in to your workspace
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} HRMS</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Create a workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
