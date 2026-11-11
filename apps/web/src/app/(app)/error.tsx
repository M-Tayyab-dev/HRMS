'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/display';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <EmptyState icon={AlertTriangle} title="Something went wrong" description="This section failed to load. Your data is safe. Please try again." action={<Button onClick={reset}>Try again</Button>} />
    </Card>
  );
}
