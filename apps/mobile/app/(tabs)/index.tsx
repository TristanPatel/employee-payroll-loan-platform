import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatZmw, formatLusakaDate } from '@eplp/shared';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { colors, radii, spacing, text } from '../../lib/theme';

interface LoanSummary {
  id: string;
  loan_no: string | null;
  status: string;
  principal_ngwee: number;
  current_outstanding_ngwee: number;
  monthly_installment_ngwee: number;
  total_collectable_ngwee: number;
  start_date: string;
  end_date: string;
  next_due_date: string | null;
  next_due_amount: number | null;
}

export default function HomeScreen() {
  const { profile } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile.home', profile?.id],
    enabled: !!profile,
    queryFn: async (): Promise<LoanSummary[]> => {
      const { data: loans } = await supabase
        .from('loans')
        .select(`id, loan_no, status, principal_ngwee, current_outstanding_ngwee,
                 monthly_installment_ngwee, total_collectable_ngwee, start_date, end_date,
                 loan_schedule ( due_date, scheduled_amount_ngwee, status )`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      return (loans ?? []).map((l) => {
        const sched = (l.loan_schedule as { due_date: string; scheduled_amount_ngwee: number; status: string }[] | null) ?? [];
        const next = sched
          .filter((s) => s.status === 'scheduled')
          .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
        return {
          id: l.id, loan_no: l.loan_no, status: l.status,
          principal_ngwee: Number(l.principal_ngwee),
          current_outstanding_ngwee: Number(l.current_outstanding_ngwee),
          monthly_installment_ngwee: Number(l.monthly_installment_ngwee),
          total_collectable_ngwee: Number(l.total_collectable_ngwee),
          start_date: l.start_date, end_date: l.end_date,
          next_due_date: next?.due_date ?? null,
          next_due_amount: next ? Number(next.scheduled_amount_ngwee) : null,
        };
      });
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
        <Text style={[text.h1, { marginBottom: spacing.xs }]}>
          Hello, {profile?.full_name?.split(' ')[0] ?? 'there'}
        </Text>
        <Text style={text.muted}>Richmond Finance · payroll loan portal</Text>

        {!data || data.length === 0 ? (
          <View style={styles.card}>
            <Text style={text.h2}>No active loan</Text>
            <Text style={[text.muted, { marginTop: spacing.sm }]}>
              When you have an active loan it will appear here with the next deduction
              date and your outstanding balance.
            </Text>
          </View>
        ) : (
          data.map((loan) => (
            <View key={loan.id} style={styles.card}>
              <Text style={text.micro}>{loan.loan_no ?? loan.id.slice(0, 8)}</Text>
              <Text style={[text.h2, { marginTop: spacing.xs }]}>
                {formatZmw(loan.current_outstanding_ngwee)}
              </Text>
              <Text style={text.muted}>outstanding · {loan.status.replace(/_/g, ' ')}</Text>

              <View style={styles.row}>
                <Stat label="Principal" value={formatZmw(loan.principal_ngwee)} />
                <Stat label="Monthly" value={formatZmw(loan.monthly_installment_ngwee)} />
              </View>
              <View style={styles.row}>
                <Stat label="Start" value={formatLusakaDate(loan.start_date)} />
                <Stat label="End"   value={formatLusakaDate(loan.end_date)} />
              </View>

              {loan.next_due_date ? (
                <View style={styles.nextDue}>
                  <Text style={[text.muted, { color: colors.richmondRedDark, fontWeight: '600' }]}>
                    Next deduction
                  </Text>
                  <Text style={[text.body, { fontWeight: '600', marginTop: 2 }]}>
                    {formatZmw(loan.next_due_amount ?? 0)} on {formatLusakaDate(loan.next_due_date)}
                  </Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={text.micro}>{label}</Text>
      <Text style={[text.body, { fontWeight: '500' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceBase },
  container: { padding: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBase },
  card: {
    backgroundColor: colors.white, padding: spacing.lg, borderRadius: radii.lg,
    marginTop: spacing.lg, borderWidth: 1, borderColor: colors.divider,
  },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  nextDue: {
    marginTop: spacing.md, padding: spacing.md, borderRadius: radii.md,
    backgroundColor: '#fbe7e3',
  },
});
