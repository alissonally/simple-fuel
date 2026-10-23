import { router } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { Loading } from '@/components/ui';
import { vehicleFormValues, VehicleForm } from '@/features/vehicle/VehicleForm';
import { useNeedsFirstVehicleCompletion, useUpdateVehicle, useVehicles } from '@/hooks';

/** Passo obrigatório ao cadastrar o 2º veículo: dar nome ao primeiro (seção 6.6). */
export default function CompleteFirstVehicleScreen() {
  const vehicles = useVehicles();
  const pending = useNeedsFirstVehicleCompletion();
  const update = useUpdateVehicle();

  // Sem "pular": o botão voltar do Android também fica bloqueado.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const first = pending.data ?? vehicles.data?.[0];
  if (!first) return <Loading />;

  return (
    <VehicleForm
      initialValues={vehicleFormValues(first)}
      intro="Agora que você tem dois veículos, dê um apelido ao primeiro para diferenciá-los."
      submitLabel="Concluir"
      onSubmit={async (input) => {
        await update.mutateAsync({ id: first.id, input });
        router.dismissTo('/');
      }}
    />
  );
}
