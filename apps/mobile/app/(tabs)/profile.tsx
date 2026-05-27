import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth-context';
import { colors, radii, spacing, text } from '../../lib/theme';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
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
