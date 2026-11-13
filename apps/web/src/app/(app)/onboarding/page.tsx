'use client';

import { REQUIRED_ONBOARDING_DOCS } from '@hrms/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { Doc } from '@/components/employee-panels';
import { DocUploadCard } from '@/components/onboarding-docs';
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
  const [cnic, setCnic] = useState('');
  const [emergency, setEmergency] = useState('');
  const [finishing, setFinishing] = useState(false);
  const have = new Set(docs?.map((d) => d.category));
  const done = REQUIRED_ONBOARDING_DOCS.filter((c) => have.has(c)).length;

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
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Welcome, ${me?.employee?.fullName.split(' ')[0] ?? ''}!`} description="Before you start, please upload your documents. They're submitted once and can only be changed by HR afterwards." />
      <Card className="mb-6">
        <CardHeader title="1. Required documents" description={`${done} of ${REQUIRED_ONBOARDING_DOCS.length} uploaded. Check each file in the preview before uploading.`} />
        <CardBody className="space-y-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={REQUIRED_ONBOARDING_DOCS.length} aria-valuenow={done} aria-label="Documents uploaded">
            <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${(done / REQUIRED_ONBOARDING_DOCS.length) * 100}%` }} />
          </div>
          {REQUIRED_ONBOARDING_DOCS.map((c) => (
            <DocUploadCard key={c} category={c} uploaded={docs?.find((d) => d.category === c)} onUploaded={() => qc.invalidateQueries({ queryKey: [docsKey] })} />
          ))}
        </CardBody>
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
