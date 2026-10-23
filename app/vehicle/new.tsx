import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { goBack } from '@/components/navigation';
import { vehicleFormValues, VehicleForm } from '@/features/vehicle/VehicleForm';
import { useActiveVehicle, useCreateVehicle, useRepo } from '@/hooks';
import { needsFirstVehicleCompletion } from '@/repositories';

export default function NewVehicleScreen() {
  const ctx = useRepo();
  const create = useCreateVehicle();
  const { setActiveVehicle } = useActiveVehicle();
  const queryClient = useQueryClient();

  return (
    <VehicleForm
      initialValues={vehicleFormValues()}
      onSubmit={async (input) => {
        const vehicle = await create.mutateAsync(input);
        await setActiveVehicle(vehicle.id);
        await queryClient.invalidateQueries();
        if (needsFirstVehicleCompletion(ctx)) {
          router.replace('/vehicle/complete-first');
        } else {
          goBack();
        }
      }}
    />
  );
}
