import { AuthCallbackClient } from './callback-client';

export const dynamic = 'force-dynamic';

/**
 * Magic-link landing. `next` is validated to a same-origin path (single leading
 * slash, never //host or a backslash) so the callback can never bounce a user
 * off-origin; anything else falls back to /portal.
 */
export default function AuthCallbackPage({
  searchParams,
}: {
  searchParams: { next?: string };
}): React.ReactElement {
  const raw = searchParams.next ?? '';
  const next = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/portal';
  return <AuthCallbackClient next={next} />;
}
