import type { QueryClient } from '@tanstack/react-query';

export type VehicleScope = string | 'all';

export const queryKeys = {
  vehicles: (includeArchived: boolean) => ['vehicles', { includeArchived }] as const,
  vehicle: (id: string) => ['vehicles', 'detail', id] as const,
  activeVehicle: () => ['activeVehicle'] as const,
  segments: (vehicleId: string) => ['segments', vehicleId] as const,
  fuelings: (scope: VehicleScope) => ['fuelings', scope] as const,
  fueling: (id: string) => ['fuelings', 'detail', id] as const,
  lastFueling: (vehicleId: string) => ['fuelings', 'last', vehicleId] as const,
  lastPrice: (fuelType: string) => ['fuelings', 'lastPrice', fuelType] as const,
  cycles: (scope: VehicleScope) => ['cycles', scope] as const,
  monthly: (month: string, scope: VehicleScope) => ['monthly', month, scope] as const,
  monthlyRange: (months: string[], scope: VehicleScope) =>
    ['monthly', 'range', months.join(','), scope] as const,
  needsFirstCompletion: () => ['vehicles', 'needsFirstCompletion'] as const,
};

/** Após qualquer mutação de abastecimento: fuelings, cycles e monthly. */
export function invalidateFuelingData(client: QueryClient): Promise<void> {
  return Promise.all(
    ['fuelings', 'cycles', 'monthly'].map((key) => client.invalidateQueries({ queryKey: [key] })),
  ).then(() => undefined);
}

/** Mutações de veículo afetam também listas, seletor e segmentos. */
export function invalidateAll(client: QueryClient): Promise<void> {
  return client.invalidateQueries();
}
