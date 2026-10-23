import { router } from 'expo-router';

import { Loading } from '@/components/ui';
import { emptyValues } from '@/features/fueling/formSchema';
import { FuelingForm } from '@/features/fueling/FuelingForm';
import { useActiveVehicle, useCreateFueling, useRepo, useVehicles } from '@/hooks';
import { lastPriceMilli } from '@/repositories';

export default function NewFuelingScreen() {
  const ctx = useRepo();
  const vehicles = useVehicles();
  const { vehicle } = useActiveVehicle();
  const create = useCreateFueling();

  if (!vehicles.data || !vehicle) return <Loading />;

  return (
    <FuelingForm
      vehicles={vehicles.data}
      initialValues={emptyValues({
        vehicleId: vehicle.id,
        fuelType: vehicle.defaultFuel,
        priceMilli: lastPriceMilli(ctx, vehicle.defaultFuel),
      })}
      onSave={(input, options) => create.mutateAsync({ input, options })}
      onDone={() => router.back()}
    />
  );
}
