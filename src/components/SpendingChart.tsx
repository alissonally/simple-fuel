import { StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { monthName } from '@/domain/dates';
import type { MonthlySummary } from '@/domain/types';
import { colors } from '@/theme';

/** Barras de gasto mensal. Tocar numa barra seleciona o mês. */
export function SpendingChart({
  summaries,
  selectedMonth,
  onSelectMonth,
}: {
  summaries: MonthlySummary[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}) {
  const data = summaries.map((summary) => ({
    value: summary.spentCents / 100,
    label: monthName(summary.month).slice(0, 3),
    frontColor: summary.month === selectedMonth ? colors.primary : colors.chartMuted,
    onPress: () => onSelectMonth(summary.month),
  }));

  return (
    <View style={styles.container} accessibilityLabel="Gasto dos últimos 6 meses">
      <BarChart
        data={data}
        barWidth={28}
        spacing={18}
        initialSpacing={12}
        barBorderTopLeftRadius={4}
        barBorderTopRightRadius={4}
        noOfSections={3}
        height={140}
        hideRules
        yAxisThickness={0}
        xAxisThickness={StyleSheet.hairlineWidth}
        xAxisColor={colors.border}
        yAxisTextStyle={styles.axis}
        xAxisLabelTextStyle={styles.axis}
        formatYLabel={(label) => `R$${Math.round(Number(label))}`}
        yAxisLabelWidth={48}
        disableScroll
        isAnimated={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  axis: { color: colors.muted, fontSize: 11 },
});
