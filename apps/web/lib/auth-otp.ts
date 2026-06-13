'use client';

import type { AuthResponse } from '@supabase/supabase-js';
import { getSupabaseBrowser } from './supabase/browser';

/**
 * Verify an email OTP, resilient to GoTrue's token-type split.
 *
 * `signInWithOtp({ shouldCreateUser: true })` issues different token types:
 *   - a brand-new (never-confirmed) account gets a `signup` confirmation token
 *   - a returning, confirmed account gets an `email` OTP token
 *
 * The browser can't reliably tell which, and verifyOtp must be called with the
 * matching `type` or GoTrue returns "token has expired or is invalid". A failed
 * verify does not consume the token, so we try the common case (`email`) and
 * fall back to `signup`. The magic-link button always worked because its URL
 * carries the correct type — this brings the typed-code path to parity.
 */
export async function verifyEmailOtp(email: string, token: string): Promise<AuthResponse> {
  const supabase = getSupabaseBrowser();
  const trimmed = token.trim();

  const asEmail = await supabase.auth.verifyOtp({ email, token: trimmed, type: 'email' });
  if (!asEmail.error) return asEmail;

  const asSignup = await supabase.auth.verifyOtp({ email, token: trimmed, type: 'signup' });
  // If the fallback also fails, surface the original error message.
  return asSignup.error ? asEmail : asSignup;
}
