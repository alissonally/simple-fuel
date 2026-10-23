import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { Badge, Chips, Loading } from '@/components/ui';
import type { Cycle } from '@/domain/types';
import { formatDate, formatMonth, monthOf } from '@/domain/dates';
import { FUEL_LABELS, formatKm, formatKmPerLiter, formatVolume } from '@/domain/format';
import { formatBRL } from '@/domain/money';
import {
  useCycles,
  useFuelings,
  useHasMultipleVehicles,
  useSetExcludeFromAverage,
  useVehicles,
} from '@/hooks';
import type { Fueling } from '@/repositories';
import { colors, spacing } from '@/theme';

const ALL = 'all';

interface Section {
  month: string;
  data: Fueling[];
}

function groupByMonth(fuelings: Fueling[]): Section[] {
  const sections: Section[] = [];
  for (const fueling of fuelings) {
    const month = monthOf(fueling.date);
    const last = sections.at(-1);
    if (last?.month === month) last.data.push(fueling);
    else sections.push({ month, data: [fueling] });
  }
  return sections;
}

function FuelingItem({
  fueling,
  cycle,
  vehicleName,
  onToggleExclude,
}: {
  fueling: Fueling;
  cycle: Cycle | undefined;
  vehicleName: string | null;
  onToggleExclude: (cycle: Cycle) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={cycle ? 'Pressione e segure para ignorar na média' : undefined}
      testID={`fueling-${fueling.id}`}
      onPress={() => router.push(`/fueling/${fueling.id}`)}
      onLongPress={cycle ? () => onToggleExclude(cycle) : undefined}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Ionicons
        name={fueling.fullTank ? 'battery-full' : 'battery-half'}
        size={22}
        color={fueling.fullTank ? colors.primary : colors.muted}
        accessibilityLabel={fueling.fullTank ? 'Tanque cheio' : 'Parcial'}
      />
      <View style={styles.itemBody}>
        <View style={styles.row}>
          <Text style={styles.itemTitle}>{formatDate(fueling.date)}</Text>
          <Text style={styles.itemTitle}>{formatBRL(fueling.totalCents)}</Text>
        </View>
        <Text style={styles.muted}>
          {formatKm(fueling.odometerKm)} · {formatVolume(fueling.litersMl, fueling.fuelType)} ·{' '}
          {FUEL_LABELS[fueling.fuelType]}
          {vehicleName ? ` · ${vehicleName}` : ''}
        </Text>
        {cycle ? (
          <View style={styles.cycleRow}>
            <Text style={[styles.consumption, cycle.excluded && styles.excluded]}>
              {formatKmPerLiter(cycle.kmPerLiter, fueling.fuelType)}
            </Text>
            {cycle.mixed ? <Badge label="misto" /> : null}
            {cycle.excluded ? <Badge label="ignorado" /> : null}
            {cycle.outlier ? <Badge label="fora do padrão" tone="warning" /> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const multiple = useHasMultipleVehicles();
  const vehiclesQuery = useVehicles({ includeArchived: true });
  const allVehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);
  const [filter, setFilter] = useState<string>(ALL);
  const scope = multiple ? filter : ALL;
  const fuelings = useFuelings(scope);
  const cycles = useCycles(scope);
  const toggle = useSetExcludeFromAverage();

  const cycleByClosing = useMemo(
    () => new Map((cycles.data ?? []).map((c) => [c.closingFuelingId, c])),
    [cycles.data],
  );
  const sections = useMemo(() => groupByMonth(fuelings.data ?? []), [fuelings.data]);
  const names = useMemo(() => new Map(allVehicles.map((v) => [v.id, v.nickname])), [allVehicles]);

  if (!fuelings.data || !cycles.data) return <Loading />;

  // Arquivados aparecem no filtro só se tiverem registros.
  const vehicleOptions = allVehicles.filter(
    (v) =>
      v.archivedAt === null || fuelings.data.some((f) => f.vehicleId === v.id) || v.id === filter,
  );

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled
      ListHeaderComponent={
        multiple ? (
          <View style={styles.filter}>
            <Chips
              accessibilityLabel="Filtrar por veículo"
              options={[
                { value: ALL, label: 'Todos' },
                ...vehicleOptions.map((v) => ({ value: v.id, label: v.nickname })),
              ]}
              value={filter}
              onChange={setFilter}
            />
          </View>
        ) : undefined
      }
      ListEmptyComponent={<Text style={styles.empty}>Nenhum abastecimento registrado.</Text>}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{formatMonth(section.month)}</Text>
      )}
      renderItem={({ item }) => (
        <FuelingItem
          fueling={item}
          cycle={cycleByClosing.get(item.id)}
          vehicleName={multiple && scope === ALL ? (names.get(item.vehicleId) ?? null) : null}
          onToggleExclude={(cycle) =>
            void toggle.mutateAsync({ id: cycle.closingFuelingId, exclude: !cycle.excluded })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  filter: { padding: spacing.md, paddingBottom: 0 },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  itemBody: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  cycleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  consumption: { fontSize: 14, fontWeight: '700', color: colors.primary },
  excluded: { color: colors.muted, textDecorationLine: 'line-through' },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl },
});
