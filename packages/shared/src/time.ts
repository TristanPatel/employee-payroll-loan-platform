/**
 * Time helpers. All dates stored as ISO timestamptz; rendered in
 * Africa/Lusaka (UTC+2, no DST). Full implementation lands in Phase 2.
 */

export const LUSAKA_TZ = 'Africa/Lusaka';

export function nowLusaka(): Date {
  throw new Error('Not implemented — Phase 2');
}

export function formatLusakaDate(_iso: string): string {
  throw new Error('Not implemented — Phase 2');
}

export function formatLusakaDateTime(_iso: string): string {
  throw new Error('Not implemented — Phase 2');
}
