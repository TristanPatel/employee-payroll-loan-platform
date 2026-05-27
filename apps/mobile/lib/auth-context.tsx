import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Tables } from '@eplp/shared';
import { authenticate, biometricsAvailable, isBiometricEnabled } from './biometrics';
import { registerForPush } from './push';

type Profile = Tables<'profiles'>;

interface AuthCtx {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  biometricLocked: boolean;
  unlock: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  loading: true,
  session: null,
  profile: null,
  biometricLocked: false,
  unlock: async () => false,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [biometricLocked, setBiometricLocked] = useState(false);

  async function loadProfile(sess: Session | null) {
    if (!sess) { setProfile(null); return; }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sess.user.id)
      .maybeSingle();
    setProfile(data ?? null);
  }

  async function maybeLockBiometric(sess: Session | null) {
    if (!sess) { setBiometricLocked(false); return; }
    const [enabled, available] = await Promise.all([
      isBiometricEnabled(),
      biometricsAvailable(),
    ]);
    setBiometricLocked(enabled && available);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      await maybeLockBiometric(data.session);
      setLoading(false);
      // Best-effort push registration; failure is non-fatal.
      if (data.session) {
        try { await registerForPush(); } catch { /* ignore */ }
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      void loadProfile(sess);
      if (event === 'SIGNED_IN') {
        void registerForPush().catch(() => {});
        // Fresh sign-in skips the biometric lock — user just authenticated.
        setBiometricLocked(false);
      } else {
        void maybeLockBiometric(sess);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const value: AuthCtx = {
    loading,
    session,
    profile,
    biometricLocked,
    unlock: async () => {
      const ok = await authenticate();
      if (ok) setBiometricLocked(false);
      return ok;
    },
    signOut: async () => { await supabase.auth.signOut(); },
    refresh: async () => {
      const { data } = await supabase.auth.getSession();
      await loadProfile(data.session);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}
