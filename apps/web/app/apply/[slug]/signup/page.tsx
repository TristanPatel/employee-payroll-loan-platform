import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Legacy slug-based signup. Superseded by the credential entry flow (/join);
// new borrowers create their account there so they bind to the right employer.
export default function LegacyApplySignup(): never {
  redirect('/join');
}
