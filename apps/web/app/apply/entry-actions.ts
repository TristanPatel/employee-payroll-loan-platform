'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { redeemEmployerEntry } from '@/lib/employer-entry';

export interface EntryState {
  error?: string;
}

/**
 * Borrower presents a credential (invite token OR access code). If they aren't
 * signed in yet we bounce to sign-in, carrying enough context to come straight
 * back and redeem. Once signed in, redeem binds them to the single employer and
 * drops them into the apply wizard.
 */
export async function redeemEntry(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const token = (formData.get('token') as string | null)?.trim() || undefined;
  const code = (formData.get('code') as string | null)?.trim()?.toUpperCase() || undefined;

  if (!token && !code) {
    return { error: 'Enter your access code to continue.' };
  }

  const profile = await getSessionProfile();
  if (!profile) {
    // Sign in, then return to the credentialled entry point to finish joining.
    const next = token ? `/join/${token}` : `/join?code=${encodeURIComponent(code ?? '')}`;
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }
  if (profile.role !== 'employee') {
    return {
      error: 'Only borrowers can join an employer scheme. Staff sign in through the admin console.',
    };
  }

  const supabase = await createSupabaseServer();
  const { employerId, error } = await redeemEmployerEntry(supabase, { token, code });
  if (error || !employerId) {
    return { error: error ?? 'That link or access code is not valid.' };
  }

  redirect(`/portal/apply?employer=${employerId}`);
}
