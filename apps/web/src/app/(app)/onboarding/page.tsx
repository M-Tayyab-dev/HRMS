'use client';

import { DOC_CATEGORY_LABELS, REQUIRED_ONBOARDING_DOCS, type DocCategory } from '@hrms/shared';
import { CheckCircle2, Circle, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { Doc } from '@/components/employee-panels';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/display';
import { Field, FormGrid, Input, CnicInput, PhoneInput } from '@/components/ui/form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';

/** B2 – required profile documents during initial registration. */
export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { me, refresh } = useAuth();
  const id = me?.employee?.id;
  const docsKey = id ? `/employees/${id}/documents` : null;
  const { data: docs } = useApi<Doc[]>(docsKey);
  const [busy, setBusy] = useState<string | null>(null);
  const [cnic, setCnic] = useState('');
  const [emergency, setEmergency] = useState('');
  const [finishing, setFinishing] = useState(false);
  const have = new Set(docs?.map((d) => d.category));

  const upload = async (category: DocCategory, file: File) => {
    const fd = new FormData();
    fd.set('file', file);
    fd.set('category', category);
    setBusy(category);
    try {
      await api.post('/me/documents', fd);
      qc.invalidateQueries({ queryKey: [docsKey] });
      toast.success(`${DOC_CATEGORY_LABELS[category]} uploaded`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      const patch: Record<string, string> = {};
      if (cnic) patch.cnic = cnic;
      if (emergency) patch.emergencyContact = emergency;
      if (Object.keys(patch).length) await api.patch('/me/profile', patch);
      await api.post('/me/onboarding/complete');
      await refresh();
      toast.success('Welcome aboard!');
      router.replace('/dashboard');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Welcome, ${me?.employee?.fullName.split(' ')[0] ?? ''}!`} description="Before you start, please upload your documents. They're submitted once and can only be changed by HR afterwards." />
      <Card className="mb-6">
        <CardHeader title="1. Required documents" />
        <ul className="divide-y">
          {REQUIRED_ONBOARDING_DOCS.map((c) => (
            <li key={c} className="flex items-center gap-3 px-5 py-3">
              {have.has(c) ? <CheckCircle2 className="h-5 w-5 text-success" aria-label="Uploaded" /> : <Circle className="h-5 w-5 text-muted-foreground" aria-label="Missing" />}
              <span className="flex-1 text-sm font-medium">{DOC_CATEGORY_LABELS[c]}</span>
              {!have.has(c) && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" aria-hidden /> {busy === c ? 'Uploading…' : 'Upload'}
                  <input type="file" className="sr-only" accept={c === 'PHOTO' ? 'image/*' : '.pdf,image/*'} disabled={!!busy} onChange={(e) => e.target.files?.[0] && upload(c, e.target.files[0])} />
                </label>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="mb-6">
        <CardHeader title="2. Essential details" description="Skip any field you've already provided." />
        <CardBody>
          <FormGrid>
            <Field label="CNIC number" hint="e.g. 35202-1234567-1">{(a) => <CnicInput {...a} value={cnic} onChange={(e) => setCnic(e.target.value)} />}</Field>
            <Field label="Emergency contact number">{(a) => <PhoneInput {...a} value={emergency} onChange={(e) => setEmergency(e.target.value)} />}</Field>
          </FormGrid>
        </CardBody>
      </Card>
      <div className="flex justify-end">
        <Button size="lg" onClick={finish} loading={finishing} disabled={!REQUIRED_ONBOARDING_DOCS.every((c) => have.has(c))}>
          Complete onboarding
        </Button>
      </div>
    </div>
  );
}
