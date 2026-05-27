import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatLusakaDateTime } from '@eplp/shared';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { colors, radii, spacing, text } from '../../lib/theme';

const LABEL: Record<string, string> = {
  application_approved: 'Your application was approved',
  application_rejected: 'Your application was declined',
  approval_progress: 'Application moved forward',
  loan_created: 'Loan created',
  loan_disbursed: 'Loan disbursed',
  repayment_received: 'Repayment received',
  loan_settled: 'Loan fully settled',
  loan_closed: 'Loan closed',
  loan_written_off: 'Loan written off',
};

export default function InboxScreen() {
  const { profile } = useAuth();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile.inbox', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, template, payload, created_at')
        .eq('recipient_id', profile!.id)
        .eq('channel', 'in_app')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.richmondRed} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        <Text style={text.h1}>Inbox</Text>

        {(data ?? []).length === 0 ? (
          <View style={styles.card}><Text style={text.muted}>No notifications yet.</Text></View>
        ) : (
          (data ?? []).map((n) => {
            const p = (n.payload ?? {}) as Record<string, unknown>;
            const label = LABEL[n.template] ?? n.template.replace(/_/g, ' ');
            const appNo = (p.application_no as string | undefined) ?? (p.loan_no as string | undefined);
            return (
              <View key={n.id} style={styles.row}>
                <Text style={[text.body, { fontWeight: '600' }]}>{label}</Text>
                {appNo ? <Text style={text.muted}>{appNo}</Text> : null}
                <Text style={[text.micro, { marginTop: 4 }]}>{formatLusakaDateTime(n.created_at)}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceBase },
  container: { padding: spacing.xl, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBase },
  card: {
    backgroundColor: colors.white, padding: spacing.lg, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.divider,
  },
  row: {
    backgroundColor: colors.white, padding: spacing.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.divider, gap: 2,
  },
});
