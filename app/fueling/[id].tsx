import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Loading } from '@/components/ui';
import { fromFueling } from '@/features/fueling/formSchema';
import { FuelingForm } from '@/features/fueling/FuelingForm';
import { useDeleteFueling, useFueling, useUpdateFueling, useVehicles } from '@/hooks';
import { colors, spacing } from '@/theme';

export default function EditFuelingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fueling = useFueling(id);
  const vehicles = useVehicles({ includeArchived: true });
  const update = useUpdateFueling();
  const remove = useDeleteFueling();

  if (fueling.isPending || !vehicles.data) return <Loading />;
  if (!fueling.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Abastecimento não encontrado.</Text>
      </View>
    );
  }

  const current = fueling.data;
  // Veículos ativos, mais o veículo do registro caso esteja arquivado.
  const options = vehicles.data.filter((v) => v.archivedAt === null || v.id === current.vehicleId);

  return (
    <FuelingForm
      key={current.id}
      editingId={current.id}
      vehicles={options}
      initialValues={fromFueling(current)}
      onSave={(input, options) => update.mutateAsync({ id: current.id, input, options })}
      onDelete={() => {
        void remove.mutateAsync(current.id).then(() => router.back());
      }}
      onDone={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  text: { color: colors.muted },
});
