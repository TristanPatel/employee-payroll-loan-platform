import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ROLE_GROUPS, type RoleGroup } from '@eplp/shared';

export default function SplashScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>RF</Text>
        </View>
        <Text style={styles.title}>Employee Payroll Loan Portal</Text>
        <Text style={styles.subtitle}>Sign in by selecting your role</Text>

        <View style={styles.roleList}>
          {ROLE_GROUPS.map((group) => (
            <RoleRow key={group.key} group={group} />
          ))}
        </View>

        <Text style={styles.footnote}>
          Sign-in wiring lands in Phase 1 (Supabase Auth + biometric unlock).
        </Text>
      </View>
    </SafeAreaView>
  );
}

function RoleRow({ group }: { group: RoleGroup }) {
  return (
    <Link href={`/sign-in?role=${group.key}` as never} asChild>
      <Pressable style={styles.roleBtn} disabled>
        <View style={{ flex: 1 }}>
          <Text style={styles.roleLabel}>{group.label}</Text>
          <Text style={styles.roleDesc}>{group.description}</Text>
        </View>
        <Text style={styles.roleKey}>{group.key.toUpperCase()}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#c0392b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: 'white', fontWeight: '700', fontSize: 18 },
  title: { marginTop: 16, fontSize: 20, fontWeight: '600', color: '#0f172a' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#64748b' },
  roleList: { marginTop: 32, width: '100%', gap: 12 },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    opacity: 0.7,
  },
  roleLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  roleDesc: { marginTop: 2, fontSize: 12, color: '#64748b' },
  roleKey: { fontSize: 11, color: '#94a3b8', letterSpacing: 1 },
  footnote: { marginTop: 32, fontSize: 11, color: '#94a3b8', textAlign: 'center' },
});
