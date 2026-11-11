'use client';

import { loginSchema } from '@hrms/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { api, ApiError } from '@/lib/api';
import { applyServerErrors, fieldError, useZodForm } from '@/lib/form';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(loginSchema, { workspace: '', email: '', password: '' });

  useEffect(() => {
    try {
      const ws = localStorage.getItem('hrms-workspace');
      if (ws) form.setValue('workspace', ws);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post('/auth/login', values);
      try {
        localStorage.setItem('hrms-workspace', values.workspace);
      } catch {
        /* ignore */
      }
      const next = params.get('next');
      // Only allow same-site relative redirects (no open redirect).
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
    } catch (e) {
      if (!applyServerErrors(form, e)) setError(e instanceof ApiError ? e.message : 'Could not sign in');
    }
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back. Enter your company workspace and credentials.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Field label="Workspace" error={fieldError(form, 'workspace')} hint="Your company's workspace name, e.g. acme">
          {(a) => <Input {...a} autoComplete="organization" autoCapitalize="none" {...form.register('workspace')} />}
        </Field>
        <Field label="Work email" error={fieldError(form, 'email')}>
          {(a) => <Input {...a} type="email" autoComplete="username" {...form.register('email')} />}
        </Field>
        <Field label="Password" error={fieldError(form, 'password')}>
          {(a) => <Input {...a} type="password" autoComplete="current-password" {...form.register('password')} />}
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New company?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create a workspace
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
