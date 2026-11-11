import { Building, CalendarCheck2, ShieldCheck, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Building className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold">HRMS</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold">Your whole team, from first day to payday.</h2>
          <p className="mt-3 text-slate-300">Attendance, leave, payroll, performance and policies in one secure workspace.</p>
          <ul className="mt-8 space-y-4 text-sm text-slate-200">
            <li className="flex gap-3"><CalendarCheck2 className="h-5 w-5 text-blue-300" aria-hidden /> Biometric attendance with Team Lead → HR approvals</li>
            <li className="flex gap-3"><Wallet className="h-5 w-5 text-blue-300" aria-hidden /> Working-hours payroll with PDF salary slips</li>
            <li className="flex gap-3"><ShieldCheck className="h-5 w-5 text-blue-300" aria-hidden /> Role-based access, audit trail and anonymous complaints</li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} HRMS</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  );
}
