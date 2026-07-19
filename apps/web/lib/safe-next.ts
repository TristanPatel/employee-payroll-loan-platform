/**
 * Return `next` only if it is a same-origin absolute path *inside* `home`;
 * otherwise fall back to `home`. Rejects protocol-relative (`//host`) and
 * backslash (`/\host`) forms that browsers can resolve to another origin.
 *
 * Used by /launch to decide whether a post-sign-in `next` may be honoured:
 * a stale cross-role `next` (e.g. an employer carrying `next=/admin`) is
 * dropped so the user lands on their role's home instead of bouncing off a
 * layout that rejects them and looping back to /sign-in.
 */
export function safeNext(next: string | null, home: string): string {
  if (!next || next[0] !== '/' || next[1] === '/' || next[1] === '\\') return home;
  const path = next.split(/[?#]/)[0] ?? '';
  return path === home || path.startsWith(`${home}/`) ? next : home;
}
