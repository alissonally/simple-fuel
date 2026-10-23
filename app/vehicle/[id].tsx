import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Loading } from '@/components/ui';
import { formatDate } from '@/domain/dates';
import { vehicleFormValues, VehicleForm } from '@/features/vehicle/VehicleForm';
import {
  useArchiveVehicle,
  useDeleteVehicle,
  useRestartOdometer,
  useSegments,
  useUpdateVehicle,
  useVehicle,
  useVehicles,
} from '@/hooks';
import { colors, spacing } from '@/theme';

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

function reportError(error: unknown) {
  Alert.alert('Não foi possível concluir', error instanceof Error ? error.message : String(error));
}

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id);
  const active = useVehicles().data ?? [];
  const segments = useSegments(id).data ?? [];
  const update = useUpdateVehicle();
  const archive = useArchiveVehicle();
  const remove = useDeleteVehicle();
  const restart = useRestartOdometer();

  if (vehicle.isPending) return <Loading />;
  const current = vehicle.data;
  if (!current) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Veículo não encontrado.</Text>
      </View>
    );
  }

  const archived = current.archivedAt !== null;
  const lastActive = !archived && active.length <= 1;
  const segment = segments.at(-1);

  return (
    <VehicleForm
      key={current.id}
      initialValues={vehicleFormValues(current)}
      onSubmit={async (input) => {
        await update.mutateAsync({ id: current.id, input });
        router.back();
      }}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Odômetro</Text>
        <Text style={styles.muted}>
          {segment && segment.sequence > 1
            ? `Reiniciado em ${formatDate(segment.startedOn)}.`
            : 'Use se o odômetro foi trocado ou zerado.'}
        </Text>
        <Button
          title="Reiniciar odômetro"
          variant="secondary"
          onPress={() =>
            confirm(
              'Reiniciar odômetro?',
              'Os próximos abastecimentos começam uma nova contagem de km a partir de hoje. ' +
                'O histórico é mantido, mas o ciclo em aberto é descartado e nenhum consumo ' +
                'será calculado entre o odômetro antigo e o novo.',
              'Reiniciar',
              () => restart.mutateAsync(current.id).catch(reportError),
            )
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gerenciar</Text>
        {lastActive ? (
          <Text style={styles.muted}>
            Este é o único veículo ativo. Adicione outro para poder arquivar ou excluir este.
          </Text>
        ) : null}
        <Button
          title={archived ? 'Desarquivar' : 'Arquivar'}
          variant="secondary"
          disabled={lastActive}
          onPress={() =>
            archive
              .mutateAsync({ id: current.id, archived: !archived })
              .then(() => router.back())
              .catch(reportError)
          }
        />
        <Button
          title="Excluir veículo"
          variant="danger"
          disabled={lastActive}
          onPress={() =>
            confirm(
              'Excluir veículo?',
              `"${current.nickname}" e todos os seus abastecimentos serão excluídos.`,
              'Excluir',
              () =>
                remove
                  .mutateAsync(current.id)
                  .then(() => router.back())
                  .catch(reportError),
            )
          }
        />
      </View>
    </VehicleForm>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  section: { gap: spacing.sm, marginTop: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 14 },
});
