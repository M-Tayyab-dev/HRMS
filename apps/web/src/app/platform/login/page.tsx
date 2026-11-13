'use client';

import { platformLoginSchema } from '@hrms/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/display';
import { Field, Input } from '@/components/ui/form';
import { api, ApiError } from '@/lib/api';
import { fieldError, useZodForm } from '@/lib/form';

export default function PlatformLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(platformLoginSchema, { email: '', password: '' });
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post('/platform/login', v);
      router.replace('/platform');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not sign in');
    }
  });
  return (
    <div className="mx-auto max-w-sm pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Super Admin sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">For Super Admins who run the platform. Company staff sign in at the regular login page.</p>
      <Card className="mt-6">
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {error && <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
            <Field label="Email" error={fieldError(form, 'email')}>{(a) => <Input {...a} type="email" autoComplete="username" {...form.register('email')} />}</Field>
            <Field label="Password" error={fieldError(form, 'password')}>{(a) => <Input {...a} type="password" autoComplete="current-password" {...form.register('password')} />}</Field>
            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Sign in</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
