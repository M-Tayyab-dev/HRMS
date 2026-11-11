'use client';

import { password } from '@hrms/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { api, ApiError } from '@/lib/api';
import { fieldError, useZodForm } from '@/lib/form';

const schema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const invite = params.get('invite') === '1';
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(schema, { password: '', confirm: '' });

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await api.post<{ workspace: string; email: string }>('/auth/reset-password', { token, password: v.password });
      await api.post('/auth/login', { workspace: r.workspace, email: r.email, password: v.password });
      try {
        localStorage.setItem('hrms-workspace', r.workspace);
      } catch {
        /* ignore */
      }
      router.replace('/dashboard');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
  });

  if (!token) {
    return (
      <p className="text-sm">
        This link is incomplete. <Link href="/forgot-password" className="text-primary hover:underline">Request a new one</Link>.
      </p>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{invite ? 'Welcome! Set your password' : 'Choose a new password'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Use at least 12 characters with upper and lower case letters and a number.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Field label="New password" error={fieldError(form, 'password')}>
          {(a) => <Input {...a} type="password" autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <Field label="Confirm password" error={fieldError(form, 'confirm')}>
          {(a) => <Input {...a} type="password" autoComplete="new-password" {...form.register('confirm')} />}
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
          {invite ? 'Activate account' : 'Update password'}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
