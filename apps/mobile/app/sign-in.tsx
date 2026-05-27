import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors, radii, spacing, text } from '../lib/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [otp, setOtp]     = useState('');
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp() {
    setError(null);
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStage('otp');
  }

  async function verifyOtp() {
    setError(null);
    if (otp.length < 6) { setError('Enter the 6-digit code from your email'); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>RF</Text>
          </View>
          <Text style={text.h1}>Richmond Finance</Text>
          <Text style={[text.muted, { marginTop: spacing.xs, marginBottom: spacing.xl }]}>
            Employee Payroll Loan Portal
          </Text>

          {stage === 'email' ? (
            <>
              <Text style={text.micro}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@employer.com"
                placeholderTextColor={colors.inkSubtle}
                style={styles.input}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable onPress={sendOtp} disabled={busy} style={[styles.button, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send code</Text>}
              </Pressable>
              <Text style={[text.muted, { marginTop: spacing.lg, textAlign: 'center' }]}>
                Don&apos;t have an account yet? Open your application link on the web first.
              </Text>
            </>
          ) : (
            <>
              <Text style={text.micro}>6-digit code from {email}</Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor={colors.inkSubtle}
                style={styles.input}
                maxLength={6}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable onPress={verifyOtp} disabled={busy} style={[styles.button, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Verify &amp; sign in</Text>}
              </Pressable>
              <Pressable onPress={() => { setStage('email'); setOtp(''); }} style={{ marginTop: spacing.md }}>
                <Text style={[text.muted, { textAlign: 'center' }]}>Use a different email</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceBase },
  container: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.richmondRed,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: colors.white, fontWeight: '700', fontSize: 18 },
  input: {
    width: '100%', backgroundColor: colors.white, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.divider,
    marginTop: spacing.xs, marginBottom: spacing.md, fontSize: 15, color: colors.inkBase,
  },
  button: {
    width: '100%', backgroundColor: colors.richmondRed, paddingVertical: 14,
    borderRadius: radii.md, alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  error: { color: colors.danger, marginBottom: spacing.sm, fontSize: 12 },
});
