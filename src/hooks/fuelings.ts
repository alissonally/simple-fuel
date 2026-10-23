import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { buildCycles } from '@/domain/cycles';
import { summarizeMonth, summarizeRange } from '@/domain/monthly';
import type { FuelType } from '@/domain/types';
import {
  createFueling,
  deleteFueling,
  getFueling,
  lastFueling,
  lastPriceMilli,
  listFuelings,
  setExcludeFromAverage,
  updateFueling,
  type Fueling,
  type FuelingInput,
  type SaveOptions,
} from '@/repositories';

import { invalidateFuelingData, queryKeys, type VehicleScope } from './keys';
import { useRepo } from './RepoProvider';

const scopeArg = (scope: VehicleScope) => (scope === 'all' ? undefined : scope);

/** Mutações registradas aqui rodam após cada inserção, edição ou exclusão (ex.: notificação). */
const dataChangedListeners = new Set<() => void>();

export function onFuelingDataChanged(listener: () => void): () => void {
  dataChangedListeners.add(listener);
  return () => dataChangedListeners.delete(listener);
}

export function useFuelings(scope: VehicleScope | undefined) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.fuelings(scope ?? ''),
    queryFn: () => listFuelings(ctx, scopeArg(scope ?? 'all')),
    enabled: Boolean(scope),
  });
}

export function useFueling(id: string | undefined) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.fueling(id ?? ''),
    queryFn: () => getFueling(ctx, id ?? '') ?? null,
    enabled: Boolean(id),
  });
}

/** Ciclos calculados na leitura por `buildCycles`, sem SQL de cálculo. */
export function useCycles(scope: VehicleScope | undefined) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.cycles(scope ?? ''),
    queryFn: () => buildCycles(listFuelings(ctx, scopeArg(scope ?? 'all'))),
    enabled: Boolean(scope),
  });
}

export function useMonthlySummary(month: string, scope: VehicleScope | undefined) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.monthly(month, scope ?? ''),
    queryFn: () => {
      const records = listFuelings(ctx, scopeArg(scope ?? 'all'));
      return summarizeMonth(month, records, buildCycles(records), scope ?? 'all');
    },
    enabled: Boolean(scope),
  });
}

export function useMonthlyRange(months: string[], scope: VehicleScope | undefined) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.monthlyRange(months, scope ?? ''),
    queryFn: () => {
      const records = listFuelings(ctx, scopeArg(scope ?? 'all'));
      return summarizeRange(months, records, buildCycles(records), scope ?? 'all');
    },
    enabled: Boolean(scope),
  });
}

export function useLastFueling(vehicleId: string | undefined) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.lastFueling(vehicleId ?? ''),
    queryFn: () => lastFueling(ctx, vehicleId ?? '') ?? null,
    enabled: Boolean(vehicleId),
  });
}

export function useLastPrice(fuelType: FuelType | undefined) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.lastPrice(fuelType ?? ''),
    queryFn: () => lastPriceMilli(ctx, fuelType ?? 'gasoline'),
    enabled: Boolean(fuelType),
  });
}

function useFuelingMutation<TArgs, TResult>(fn: (args: TArgs) => TResult) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => fn(args),
    onSuccess: async () => {
      await invalidateFuelingData(client);
      // O veículo ativo pode ter mudado (last_vehicle_id).
      await client.invalidateQueries({ queryKey: queryKeys.activeVehicle() });
      dataChangedListeners.forEach((listener) => listener());
    },
  });
}

export function useCreateFueling() {
  const ctx = useRepo();
  return useFuelingMutation(
    ({ input, options }: { input: FuelingInput; options?: SaveOptions }): Fueling =>
      createFueling(ctx, input, options),
  );
}

export function useUpdateFueling() {
  const ctx = useRepo();
  return useFuelingMutation(
    ({ id, input, options }: { id: string; input: FuelingInput; options?: SaveOptions }) =>
      updateFueling(ctx, id, input, options),
  );
}

export function useDeleteFueling() {
  const ctx = useRepo();
  return useFuelingMutation((id: string) => deleteFueling(ctx, id));
}

export function useSetExcludeFromAverage() {
  const ctx = useRepo();
  return useFuelingMutation(({ id, exclude }: { id: string; exclude: boolean }) =>
    setExcludeFromAverage(ctx, id, exclude),
  );
}
