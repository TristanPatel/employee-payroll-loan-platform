// Employer confidential-entry helpers (P-F).
//
// Entry to an employer scheme requires a credential — an HR-distributed invite
// TOKEN or the employer's poster ACCESS CODE — resolved through SECURITY DEFINER
// RPCs (migration 47) that return a single employer and never a list. This
// module holds the credential generators (pure, unit-tested) plus thin typed
// wrappers over the RPCs, keeping the untyped-RPC casts in one place until the
// generated Database types catch up with migration 47.

import type { SupabaseClient } from '@supabase/supabase-js';

/** The public-safe employer projection returned by the entry RPCs (jsonb). */
export interface EmployerApplyInfo {
  id: string;
  legal_name: string;
  trading_name: string | null;
  slug: string;
  monthly_interest_rate: number;
  admin_fee_pct: number;
  insurance_fee_pct: number;
  max_debt_ratio_pct: number;
  max_tenure_months: number;
  salary_advance_enabled: boolean;
  salary_advance_max_months: number;
  brand_primary_color: string | null;
  brand_logo_path: string | null;
}

// Crockford base32 minus the visually ambiguous I, L, O, U — an access code is
// read off a poster and typed on a phone, so legibility beats entropy density.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LEN = 8;

/** Deterministic core, exposed for testing. Maps bytes → poster-friendly code. */
export function codeFromBytes(bytes: Uint8Array, len = CODE_LEN): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    const b = bytes[i % bytes.length] ?? 0;
    out += CODE_ALPHABET[b % 32] ?? '0';
  }
  return out;
}

/** Deterministic core, exposed for testing. Maps bytes → URL-safe token. */
export function tokenFromBytes(bytes: Uint8Array): string {
  // base64url without padding: safe in a path segment, no percent-encoding.
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A fresh poster access code (8 chars, unambiguous alphabet). */
export function generateAccessCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  return codeFromBytes(bytes);
}

/** A fresh invite token (24 random bytes → 32-char URL-safe string). */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return tokenFromBytes(bytes);
}

/** Format the shareable HR link for a token against a portal origin. */
export function inviteLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/join/${token}`;
}

// ── Typed RPC wrappers ───────────────────────────────────────────────────────
// The generated Database type predates migration 47, so `.rpc(<new fn>)` isn't
// in the union yet. Narrow, `unknown`-based casts (never `any`) keep these
// call sites honest without weakening the rest of the client.

type UntypedRpc = (
  name: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

function asUntypedRpc(supabase: SupabaseClient): UntypedRpc {
  return supabase.rpc as unknown as UntypedRpc;
}

/** Look up an employer by its (globally unique) poster access code. Null when no match. */
export async function employerByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<EmployerApplyInfo | null> {
  const { data, error } = await asUntypedRpc(supabase)('employer_apply_info_by_code', {
    p_code: code,
  });
  if (error || !data) return null;
  return data as EmployerApplyInfo;
}

/** Look up an employer by an HR invite token. Null when invalid/expired/revoked. */
export async function employerByInvite(
  supabase: SupabaseClient,
  token: string,
): Promise<EmployerApplyInfo | null> {
  const { data, error } = await asUntypedRpc(supabase)('employer_apply_info_by_invite', {
    p_token: token,
  });
  if (error || !data) return null;
  return data as EmployerApplyInfo;
}

/**
 * Bind the signed-in borrower to one employer via token OR slug+code.
 * Returns the employer id on success, or an error message.
 */
export async function redeemEmployerEntry(
  supabase: SupabaseClient,
  args: { token?: string; code?: string },
): Promise<{ employerId?: string; error?: string }> {
  const { data, error } = await asUntypedRpc(supabase)('redeem_employer_entry', {
    p_token: args.token ?? null,
    p_code: args.code ?? null,
  });
  if (error) return { error: error.message };
  if (!data || typeof data !== 'string') return { error: 'Could not join this employer.' };
  return { employerId: data };
}
