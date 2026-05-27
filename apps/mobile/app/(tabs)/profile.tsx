import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth-context';
import { biometricsAvailable, isBiometricEnabled, setBiometricEnabled } from '../../lib/biometrics';
import { colors, radii, spacing, text } from '../../lib/theme';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void (async () => {
      setAvailable(await biometricsAvailable());
      setEnabled(await isBiometricEnabled());
    })();
  }, []);

  async function toggleBio(next: boolean) {
    setEnabled(next);
    await setBiometricEnabled(next);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={text.h1}>Profile</Text>

        <View style={styles.card}>
          <Row label="Full name" value={profile?.full_name ?? '—'} />
          <Row label="Email" value={profile?.email ?? '—'} />
          <Row label="Phone" value={profile?.phone ?? '—'} />
          <Row label="NRC" value={profile?.nrc_no ?? '—'} />
          <Row label="Role" value={profile?.role ?? '—'} />
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.body, { fontWeight: '500' }]}>Biometric unlock</Text>
              <Text style={text.muted}>
                {available
                  ? 'Require Face ID / Touch ID / passcode when re-opening the app.'
                  : 'No biometric hardware available on this device.'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggleBio}
              disabled={!available}
              trackColor={{ true: colors.richmondRed, false: colors.divider }}
            />
          </View>
        </View>

        <Pressable onPress={signOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={[text.muted, { textAlign: 'center', marginTop: spacing.xl }]}>
          Richmond Finance Limited · Lusaka, Zambia
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={text.micro}>{label}</Text>
      <Text style={[text.body, { fontWeight: '500' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceBase },
  container: { padding: spacing.xl, gap: spacing.lg },
  card: {
    backgroundColor: colors.white, padding: spacing.lg, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.divider, gap: spacing.md,
  },
  row: { gap: 2 },
  signOut: {
    backgroundColor: colors.white, padding: spacing.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.divider, alignItems: 'center',
  },
  signOutText: { color: colors.danger, fontWeight: '600' },
});
