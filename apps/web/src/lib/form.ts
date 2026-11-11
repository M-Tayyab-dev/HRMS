'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { ApiError } from './api';

/** react-hook-form bound to a shared Zod schema. */
export function useZodForm<S extends z.ZodType<FieldValues, FieldValues>>(schema: S, defaultValues?: DefaultValues<z.input<S>>) {
  return useForm<z.input<S>, unknown, z.output<S>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as any,
    defaultValues,
    mode: 'onTouched',
  });
}

/** Map server-side validation issues back onto form fields. Returns true if any were applied. */
export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T, unknown, FieldValues>, err: unknown): boolean {
  if (!(err instanceof ApiError) || !err.issues?.length) return false;
  for (const i of err.issues) form.setError(i.path as Path<T>, { message: i.message });
  return true;
}

export const fieldError = (form: { formState: { errors: Record<string, unknown> } }, name: string): string | undefined => {
  const parts = name.split('.');
  let cur: unknown = form.formState.errors;
  for (const p of parts) cur = (cur as Record<string, unknown> | undefined)?.[p];
  return (cur as { message?: string } | undefined)?.message;
};
