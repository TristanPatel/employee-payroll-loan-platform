import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy per-employer landing. Employer schemes are no longer discoverable by
 * slug (that was the confidentiality leak P-F closes); entry is by access code
 * or HR invite link. We keep this path alive only to redirect old posters/QRs
 * to the generic access-code entry.
 */
export default function LegacyApplySlug(): never {
  redirect('/join');
}
