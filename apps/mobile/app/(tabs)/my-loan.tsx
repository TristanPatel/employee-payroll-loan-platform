import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatZmw, formatLusakaDate } from '@eplp/shared';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { colors, radii, spacing, text } from '../../lib/theme';

export default function MyLoanScreen() {
  const { profile } = useAuth();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile.my-loan', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data: loans } = await supabase
        .from('loans')
        .select(`id, loan_no, status, principal_ngwee, current_outstanding_ngwee,
                 monthly_installment_ngwee, total_collectable_ngwee, tenure_months,
                 start_date, end_date, disbursement_method, disbursement_ref,
                 loan_schedule ( instalment_no, due_date, scheduled_amount_ngwee, status )`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      return loans ?? [];
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
        <Text style={text.h1}>My loans</Text>

        {(data ?? []).length === 0 ? (
          <View style={styles.card}>
            <Text style={text.muted}>You don&apos;t have any loans yet.</Text>
          </View>
        ) : (
          (data ?? []).map((loan) => {
            const schedule = ((loan.loan_schedule as { instalment_no: number; due_date: string; scheduled_amount_ngwee: number; status: string }[] | null) ?? [])
              .slice().sort((a, b) => a.instalment_no - b.instalment_no);
            const repaid = Number(loan.total_collectable_ngwee) - Number(loan.current_outstanding_ngwee);
            const pct = Math.round((repaid / Math.max(Number(loan.total_collectable_ngwee), 1)) * 100);
            return (
              <View key={loan.id} style={styles.card}>
                <Text style={text.micro}>{loan.loan_no ?? loan.id.slice(0, 8)}</Text>
                <Text style={text.h2}>{formatZmw(Number(loan.principal_ngwee))} principal</Text>
                <Text style={text.muted}>
                  {loan.status.replace(/_/g, ' ')} · {loan.tenure_months} months
                </Text>

                {/* progress bar */}
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%` }]} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                  <Text style={text.micro}>{pct}% repaid</Text>
                  <Text style={text.micro}>{formatZmw(Number(loan.current_outstanding_ngwee))} left</Text>
                </View>

                <Text style={[text.micro, { marginTop: spacing.lg }]}>Schedule</Text>
                <View style={styles.table}>
                  <View style={[styles.row, styles.head]}>
                    <Cell flex={0.5} bold>#</Cell>
                    <Cell flex={2} bold>Due</Cell>
                    <Cell flex={1.5} bold align="right">Amount</Cell>
                    <Cell flex={1.2} bold>Status</Cell>
                  </View>
                  {schedule.map((s) => (
                    <View key={s.instalment_no} style={styles.row}>
                      <Cell flex={0.5}>{String(s.instalment_no)}</Cell>
                      <Cell flex={2}>{formatLusakaDate(s.due_date)}</Cell>
                      <Cell flex={1.5} align="right">{formatZmw(Number(s.scheduled_amount_ngwee))}</Cell>
                      <Cell flex={1.2} color={
                        s.status === 'deducted' ? colors.success
                        : s.status === 'partial' ? colors.warning
                        : s.status === 'missed' ? colors.danger
                        : colors.inkMuted
                      }>{s.status}</Cell>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Cell({
  children, flex = 1, align = 'left', bold = false, color,
}: { children: React.ReactNode; flex?: number; align?: 'left' | 'right'; bold?: boolean; color?: string }) {
  return (
    <Text
      style={{
        flex, fontSize: 12, color: color ?? colors.inkBase,
        fontWeight: bold ? '600' : '400',
        textAlign: align, paddingVertical: 4,
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceBase },
  container: { padding: spacing.xl, gap: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBase },
  card: {
    backgroundColor: colors.white, padding: spacing.lg, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.divider, gap: spacing.xs,
  },
  barTrack: {
    marginTop: spacing.md, height: 6, borderRadius: 3,
    backgroundColor: colors.divider, overflow: 'hidden',
  },
  barFill: { height: 6, backgroundColor: colors.success },
  table: { marginTop: spacing.xs },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.divider },
  head: { borderBottomColor: colors.inkSubtle },
});
