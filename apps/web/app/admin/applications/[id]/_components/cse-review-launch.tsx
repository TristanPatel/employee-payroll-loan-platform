'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { advanceToCseReview } from '../actions';

export function CseReviewLaunch({
  applicationId,
  hasContract,
}: {
  applicationId: string;
  hasContract: boolean;
}): React.ReactElement {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    start(() => {
      void (async () => {
        const res = await advanceToCseReview(applicationId);
        if (res.error) setError(res.error);
      })();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start CSE review</CardTitle>
        <CardDescription>
          Seeds the 12-item due-diligence checklist and notifies the CSE queue.
          {hasContract ? null : (
            <span className="mt-1 block text-xs text-status-warning">
              Note: no loan_agreement contract has been created yet — borrower hasn&apos;t signed.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={go} disabled={pending}>
          {pending ? 'Advancing…' : 'Start CSE review'}
        </Button>
        {error ? (
          <p className="mt-3 rounded-md bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
