import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SpendingChart } from '@/components/SpendingChart';
import { Card, CardTitle, Chips, Loading } from '@/components/ui';
import { addMonths, formatMonth, lastMonths, monthOf, toISODate } from '@/domain/dates';
import { formatCostPerKm, formatKm, formatKmPerLiter, formatVolume } from '@/domain/format';
import { formatBRL, formatPrice } from '@/domain/money';
import { summarizeMonth } from '@/domain/monthly';
import type { MonthlySummary } from '@/domain/types';
import {
  useActiveVehicle,
  useCycles,
  useFuelings,
  useHasMultipleVehicles,
  useMonthlyRange,
  useMonthlySummary,
  useVehicles,
} from '@/hooks';
import { colors, spacing } from '@/theme';

const ALL = 'all';
const CHART_MONTHS = 6;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Mês da rota (deep link), limitado ao mês atual. */
function initialMonth(param: string | undefined, current: string): string {
  if (param && MONTH_PATTERN.test(param)) return param > current ? current : param;
  return current;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.metric}>
      <CardTitle>{label}</CardTitle>
      <Text style={styles.metricValue}>{value}</Text>
    </Card>
  );
}

function Metrics({ summary }: { summary: MonthlySummary }) {
  const perVehicle = summary.vehicleId !== ALL;
  return (
    <View style={styles.grid}>
      <Metric label="Gasto" value={formatBRL(summary.spentCents)} />
      <Metric label="Litros" value={formatVolume(summary.litersMl)} />
      <Metric label="Abastecimentos" value={String(summary.fuelingCount)} />
      <Metric label="Km rodados" value={formatKm(summary.km)} />
      {perVehicle ? (
        <>
          <Metric
            label="Consumo médio"
            value={summary.kmPerLiter !== null ? formatKmPerLiter(summary.kmPerLiter) : '—'}
          />
          <Metric
            label="Custo/km"
            value={summary.costPerKmCents !== null ? formatCostPerKm(summary.costPerKmCents) : '—'}
          />
        </>
      ) : null}
      <Metric
        label="Preço médio/litro"
        value={
          summary.avgPricePerLiterMilli !== null ? formatPrice(summary.avgPricePerLiterMilli) : '—'
        }
      />
    </View>
  );
}

function SpendingByVehicle({ month }: { month: string }) {
  const vehicles = useVehicles({ includeArchived: true }).data ?? [];
  const fuelings = useFuelings(ALL).data ?? [];
  const cycles = useCycles(ALL).data ?? [];
  const rows = vehicles
    .map((v) => ({ vehicle: v, summary: summarizeMonth(month, fuelings, cycles, v.id) }))
    // Arquivados aparecem só nos meses em que tiveram registros.
    .filter(({ vehicle, summary }) => vehicle.archivedAt === null || summary.fuelingCount > 0);

  return (
    <Card>
      <CardTitle>Gasto por veículo</CardTitle>
      {rows.map(({ vehicle, summary }) => (
        <View key={vehicle.id} style={styles.tableRow}>
          <Text style={styles.text}>{vehicle.nickname}</Text>
          <Text style={styles.text}>{formatBRL(summary.spentCents)}</Text>
        </View>
      ))}
    </Card>
  );
}

export default function MonthlyScreen() {
  const params = useLocalSearchParams<{ month?: string }>();
  const current = monthOf(toISODate(new Date()));
  const [month, setMonth] = useState(() => initialMonth(params.month, current));

  // Deep link para outro mês com a tela já aberta.
  const [lastParam, setLastParam] = useState(params.month);
  if (params.month !== lastParam) {
    setLastParam(params.month);
    setMonth(initialMonth(params.month, current));
  }

  const multiple = useHasMultipleVehicles();
  const { vehicle } = useActiveVehicle();
  const [scopeChoice, setScopeChoice] = useState<string | null>(null);
  const scope = multiple ? (scopeChoice ?? vehicle?.id) : vehicle?.id;
  const vehicles = useVehicles().data ?? [];

  const chartEnd = month < addMonths(current, -(CHART_MONTHS - 1)) ? month : current;
  const chartMonths = useMemo(() => lastMonths(chartEnd, CHART_MONTHS), [chartEnd]);
  const summary = useMonthlySummary(month, scope);
  const range = useMonthlyRange(chartMonths, scope);

  if (!summary.data || !range.data) return <Loading />;

  const canGoForward = month < current;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {multiple ? (
        <Chips
          accessibilityLabel="Veículo do resumo"
          options={[
            { value: ALL, label: 'Todos' },
            ...vehicles.map((v) => ({ value: v.id, label: v.nickname })),
          ]}
          value={scope}
          onChange={setScopeChoice}
        />
      ) : null}

      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          hitSlop={12}
          onPress={() => setMonth(addMonths(month, -1))}
        >
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.month} accessibilityRole="header">
          {formatMonth(month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          accessibilityState={{ disabled: !canGoForward }}
          disabled={!canGoForward}
          hitSlop={12}
          onPress={() => setMonth(addMonths(month, 1))}
        >
          <Text style={[styles.arrow, !canGoForward && styles.arrowDisabled]}>›</Text>
        </Pressable>
      </View>

      <Metrics summary={summary.data} />

      <Card>
        <CardTitle>Gasto dos últimos 6 meses</CardTitle>
        <SpendingChart summaries={range.data} selectedMonth={month} onSelectMonth={setMonth} />
      </Card>

      {scope === ALL ? <SpendingByVehicle month={month} /> : null}

      <Text style={styles.note}>
        Gasto pela data do abastecimento. Consumo pelos ciclos fechados no mês.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { fontSize: 32, color: colors.primary, paddingHorizontal: spacing.md },
  arrowDisabled: { color: colors.border },
  month: { fontSize: 18, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, flexBasis: '45%' },
  metricValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  text: { fontSize: 15, color: colors.text },
  note: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
