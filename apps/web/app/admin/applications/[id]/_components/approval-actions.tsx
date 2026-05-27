'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { recordApproval } from '../actions';

type Tier = 'l1' | 'l2' | 'l3';

const TIER_BY_STATUS: Record<string, Tier> = {
  l1_pending: 'l1',
  l2_pending: 'l2',
  l3_pending: 'l3',
};

const ALLOWED: Record<Tier, string[]> = {
  l1: ['approver_l1', 'branch_manager', 'master_admin'],
  l2: ['approver_l2', 'branch_manager', 'master_admin'],
  l3: ['cfo', 'master_admin'],
};

export function ApprovalActions({
  applicationId,
  status,
  callerRole,
  callerIsMaker,
  callerHasApproved,
}: {
  applicationId: string;
  status: 'l1_pending' | 'l2_pending' | 'l3_pending';
  callerRole: string;
  callerIsMaker: boolean;
  callerHasApproved: boolean;
}): React.ReactElement {
  const tier = TIER_BY_STATUS[status]!;
  const allowed = ALLOWED[tier];
  const roleOk = allowed.includes(callerRole);
  const blocked = callerIsMaker || callerHasApproved;
  const canAct = roleOk && !blocked;

  const [notes, setNotes] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(decision: 'approve' | 'reject' | 'request_info') {
    setError(null);
    if (decision === 'reject' && notes.trim().length < 5) {
      setError('Provide a rejection reason (at least 5 characters).');
      return;
    }
    start(() => {
      void (async () => {
        const res = await recordApproval({
          applicationId,
          tier,
          decision,
          notes: notes.trim() || null,
        });
        if (res.error) setError(res.error);
        else setNotes('');
      })();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tier.toUpperCase()} decision</CardTitle>
        <CardDescription>
          {canAct ? (
            <>This application requires a {tier.toUpperCase()} approval. Maker-checker is enforced.</>
          ) : blocked ? (
            <span className="text-status-danger">
              {callerIsMaker
                ? 'You created this application; you cannot also approve it.'
                : 'You already approved at a prior tier; another approver must act.'}
            </span>
          ) : (
            <>Your role ({callerRole}) cannot approve at {tier.toUpperCase()}.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canAct ? (
          <>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes (required for reject)"
            />
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => go('approve')} disabled={pending}>
                Approve
              </Button>
              <Button
                variant="secondary"
                onClick={() => go('request_info')}
                disabled={pending}
              >
                Request info
              </Button>
              <Button
                variant="secondary"
                onClick={() => go('reject')}
                disabled={pending}
                className="!text-status-danger"
              >
                Reject
              </Button>
            </div>
            {error ? (
              <p className="rounded-md bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
