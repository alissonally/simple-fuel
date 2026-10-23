import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, CardTitle, Loading } from '@/components/ui';
import { VehicleSelector } from '@/components/VehicleSelector';
import { averageConsumption } from '@/domain/cycles';
import { formatDate, monthOf, toISODate } from '@/domain/dates';
import { FUEL_LABELS, formatKmPerLiter, formatVolume } from '@/domain/format';
import { formatBRL } from '@/domain/money';
import { useActiveVehicle, useCycles, useFuelings, useMonthlySummary, useRepo } from '@/hooks';
import { needsFirstVehicleCompletion } from '@/repositories';
import { colors, spacing } from '@/theme';

const FIRST_CYCLE_MESSAGE = 'O consumo aparece a partir do próximo tanque cheio';

function newFueling() {
  router.push('/fueling/new');
}

export default function HomeScreen() {
  const ctx = useRepo();

  // Se o app foi fechado no meio do fluxo do 2º veículo, retoma o passo obrigatório.
  useEffect(() => {
    if (needsFirstVehicleCompletion(ctx)) router.push('/vehicle/complete-first');
  }, [ctx]);

  const { vehicle } = useActiveVehicle();
  const vehicleId = vehicle?.id;
  const fuelings = useFuelings(vehicleId);
  const cycles = useCycles(vehicleId);
  const month = monthOf(toISODate(new Date()));
  const summary = useMonthlySummary(month, vehicleId);

  const averages = useMemo(() => averageConsumption(cycles.data ?? []), [cycles.data]);

  if (!vehicle || !fuelings.data || !cycles.data || !summary.data) return <Loading />;

  if (fuelings.data.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.selector}>
          <VehicleSelector />
        </View>
        <View style={styles.empty}>
          <Ionicons name="water-outline" size={72} color={colors.primary} />
          <Text style={styles.emptyTitle}>Registre seu primeiro abastecimento</Text>
          <Button title="Registrar abastecimento" large onPress={newFueling} />
        </View>
      </View>
    );
  }

  const lastCycle = cycles.data.at(-1);
  const showByFuel = averages.byFuel.length > 1;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <VehicleSelector />

        {lastCycle ? (
          <>
            <Card>
              <CardTitle>Último consumo</CardTitle>
              <Text style={styles.big}>{formatKmPerLiter(lastCycle.kmPerLiter)}</Text>
              <Text style={styles.muted}>
                {formatDate(lastCycle.closedOn)} ·{' '}
                {lastCycle.mixed
                  ? 'Misto'
                  : lastCycle.fuelTypes.map((fuel) => FUEL_LABELS[fuel]).join(', ')}
              </Text>
              <View style={styles.badges}>
                {lastCycle.excluded ? <Badge label="ignorado" /> : null}
                {lastCycle.outlier && !lastCycle.excluded ? (
                  <Badge label="⚠ fora do padrão" tone="warning" />
                ) : null}
              </View>
            </Card>

            <Card>
              <CardTitle>Média geral</CardTitle>
              <Text style={styles.big}>
                {averages.overall !== null ? formatKmPerLiter(averages.overall) : '—'}
              </Text>
              {showByFuel
                ? averages.byFuel.map((item) => (
                    <Text key={item.fuelType} style={styles.muted}>
                      {FUEL_LABELS[item.fuelType]}:{' '}
                      {formatKmPerLiter(item.kmPerLiter, item.fuelType)}
                    </Text>
                  ))
                : null}
            </Card>
          </>
        ) : (
          <Card>
            <CardTitle>Consumo</CardTitle>
            <Text style={styles.text}>{FIRST_CYCLE_MESSAGE}</Text>
          </Card>
        )}

        <Card>
          <CardTitle>Este mês</CardTitle>
          <Text style={styles.big}>{formatBRL(summary.data.spentCents)}</Text>
          <Text style={styles.muted}>
            {summary.data.fuelingCount}{' '}
            {summary.data.fuelingCount === 1 ? 'abastecimento' : 'abastecimentos'} ·{' '}
            {formatVolume(summary.data.litersMl, vehicle.defaultFuel)}
          </Text>
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Registrar abastecimento" large onPress={newFueling} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  selector: { padding: spacing.md, paddingBottom: 0 },
  content: { padding: spacing.md, gap: spacing.md },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  big: { fontSize: 28, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  badges: { flexDirection: 'row', gap: spacing.sm },
  footer: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
