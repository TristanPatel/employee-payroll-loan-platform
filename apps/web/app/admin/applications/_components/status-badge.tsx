export function ApplicationStatusBadge({ status }: { status: string }): React.ReactElement {
  const map: Record<string, string> = {
    draft: 'bg-ink-muted/10 text-ink-muted',
    submitted: 'bg-status-info/10 text-status-info',
    employer_review: 'bg-status-info/10 text-status-info',
    employer_confirmed: 'bg-status-info/10 text-status-info',
    cse_review: 'bg-status-warning/10 text-status-warning',
    l1_pending: 'bg-status-warning/10 text-status-warning',
    l2_pending: 'bg-status-warning/10 text-status-warning',
    l3_pending: 'bg-status-warning/10 text-status-warning',
    approved: 'bg-status-success/10 text-status-success',
    rejected: 'bg-status-danger/10 text-status-danger',
    expired: 'bg-ink-muted/10 text-ink-muted',
    withdrawn: 'bg-ink-muted/10 text-ink-muted',
  };
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
        map[status] ?? 'bg-ink-muted/10 text-ink-muted'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
