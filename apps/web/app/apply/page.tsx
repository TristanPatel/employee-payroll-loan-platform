import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy employer picker. Listing partner employers was the confidentiality
 * leak P-F closes — borrowers now enter with their employer's access code or HR
 * invite link. This path redirects to the access-code entry.
 */
export default function LegacyEmployerPicker(): never {
  redirect('/join');
}
