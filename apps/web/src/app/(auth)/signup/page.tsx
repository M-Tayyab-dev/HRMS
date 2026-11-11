'use client';

import { signupSchema } from '@hrms/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { api, ApiError } from '@/lib/api';
import { applyServerErrors, fieldError, useZodForm } from '@/lib/form';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(signupSchema, { companyName: '', workspace: '', adminName: '', email: '', password: '', timezone: 'Asia/Karachi', currency: 'PKR' });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post('/auth/signup', values);
      try {
        localStorage.setItem('hrms-workspace', values.workspace);
      } catch {
        /* ignore */
      }
      router.replace('/dashboard');
    } catch (e) {
      if (!applyServerErrors(form, e)) setError(e instanceof ApiError ? e.message : 'Could not create workspace');
    }
  });

  const suggestSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="mt-1 text-sm text-muted-foreground">Set up your company. You'll be the Super Admin.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Field label="Company name" error={fieldError(form, 'companyName')}>
          {(a) => (
            <Input
              {...a}
              autoComplete="organization"
              {...form.register('companyName', {
                onChange: (e) => {
                  if (!form.getFieldState('workspace').isDirty) form.setValue('workspace', suggestSlug(e.target.value));
                },
              })}
            />
          )}
        </Field>
        <Field label="Workspace" error={fieldError(form, 'workspace')} hint="Used to sign in. Lowercase letters, numbers and dashes.">
          {(a) => <Input {...a} autoCapitalize="none" {...form.register('workspace')} />}
        </Field>
        <Field label="Your name" error={fieldError(form, 'adminName')}>
          {(a) => <Input {...a} autoComplete="name" {...form.register('adminName')} />}
        </Field>
        <Field label="Work email" error={fieldError(form, 'email')}>
          {(a) => <Input {...a} type="email" autoComplete="email" {...form.register('email')} />}
        </Field>
        <Field label="Password" error={fieldError(form, 'password')} hint="At least 12 characters with upper and lower case letters and a number.">
          {(a) => <Input {...a} type="password" autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
          Create workspace
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
