import { StyleSheet, View } from 'react-native';

import { useActiveVehicle, useVehicles } from '@/hooks';
import { spacing } from '@/theme';

import { Chips } from './ui';

/** Seletor do veículo ativo. Só aparece com 2+ veículos ativos. */
export function VehicleSelector() {
  const vehicles = useVehicles().data ?? [];
  const { vehicle, setActiveVehicle } = useActiveVehicle();
  if (vehicles.length < 2) return null;
  return (
    <View style={styles.container}>
      <Chips
        accessibilityLabel="Veículo"
        options={vehicles.map((v) => ({ value: v.id, label: v.nickname }))}
        value={vehicle?.id}
        onChange={(id) => void setActiveVehicle(id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { paddingBottom: spacing.sm } });
