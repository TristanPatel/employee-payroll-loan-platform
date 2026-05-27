import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { colors, radii, spacing, text } from '../lib/theme';

const queryClient = new QueryClient();

function RouteGate() {
  const { loading, session, biometricLocked, unlock, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'sign-in';
    if (!session && !inAuth) router.replace('/sign-in');
    else if (session && inAuth) router.replace('/(tabs)');
  }, [loading, session, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBase }}>
        <ActivityIndicator color={colors.richmondRed} />
      </View>
    );
  }

  // If a session exists AND biometrics are enabled, gate the app behind a lock
  // screen until the user re-authenticates with Face ID / Touch ID / passcode.
  if (session && biometricLocked) {
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.surfaceBase, padding: spacing.xl, gap: spacing.lg,
      }}>
        <View style={{
          width: 64, height: 64, borderRadius: radii.lg,
          backgroundColor: colors.richmondRed, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: colors.white, fontSize: 24, fontWeight: '700' }}>RF</Text>
        </View>
        <Text style={text.h1}>Locked</Text>
        <Text style={[text.muted, { textAlign: 'center' }]}>
          Unlock with biometrics to view your loan details.
        </Text>
        <Pressable
          onPress={() => { void unlock(); }}
          style={{
            backgroundColor: colors.richmondRed, paddingVertical: 14, paddingHorizontal: 32,
            borderRadius: radii.md, marginTop: spacing.md,
          }}
        >
          <Text style={{ color: colors.white, fontWeight: '600', fontSize: 15 }}>
            Unlock
          </Text>
        </Pressable>
        <Pressable onPress={() => { void signOut(); }} style={{ marginTop: spacing.sm }}>
          <Text style={[text.muted, { color: colors.danger }]}>Sign out instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surfaceBase },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouteGate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
