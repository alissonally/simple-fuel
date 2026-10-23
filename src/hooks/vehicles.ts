import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { VehicleRow } from '@/db/schema';
import {
  archiveVehicle,
  createVehicle,
  deleteVehicle,
  getMeta,
  getVehicle,
  listSegments,
  listVehicles,
  needsFirstVehicleCompletion,
  restartOdometer,
  setMeta,
  unarchiveVehicle,
  updateVehicle,
  type VehicleInput,
} from '@/repositories';

import { notifyFuelingDataChanged } from './fuelings';
import { invalidateAll, queryKeys } from './keys';
import { useRepo } from './RepoProvider';

export function useVehicles({ includeArchived = false }: { includeArchived?: boolean } = {}) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.vehicles(includeArchived),
    queryFn: () => listVehicles(ctx, { includeArchived }),
  });
}

export function useVehicle(id: string | undefined) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.vehicle(id ?? ''),
    queryFn: () => getVehicle(ctx, id ?? '') ?? null,
    enabled: Boolean(id),
  });
}

/** Seletores aparecem só com 2+ veículos ativos. */
export function useHasMultipleVehicles(): boolean {
  return (useVehicles().data?.length ?? 0) > 1;
}

/**
 * Veículo ativo: o último usado (`app_meta.last_vehicle_id`), se ainda estiver ativo;
 * senão, o primeiro veículo ativo.
 */
export function useActiveVehicle() {
  const ctx = useRepo();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.activeVehicle(),
    queryFn: (): VehicleRow | null => {
      const active = listVehicles(ctx);
      const lastId = getMeta(ctx, 'last_vehicle_id');
      return active.find((v) => v.id === lastId) ?? active[0] ?? null;
    },
  });
  const select = useMutation({
    mutationFn: async (vehicleId: string) => setMeta(ctx, 'last_vehicle_id', vehicleId),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.activeVehicle() }),
  });
  return {
    ...query,
    vehicle: query.data ?? null,
    setActiveVehicle: select.mutateAsync,
  };
}

export function useSegments(vehicleId: string | undefined) {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.segments(vehicleId ?? ''),
    queryFn: () => listSegments(ctx, vehicleId),
    enabled: Boolean(vehicleId),
  });
}

export function useNeedsFirstVehicleCompletion() {
  const ctx = useRepo();
  return useQuery({
    queryKey: queryKeys.needsFirstCompletion(),
    queryFn: () => needsFirstVehicleCompletion(ctx),
  });
}

function useVehicleMutation<TArgs, TResult>(fn: (args: TArgs) => TResult) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => fn(args),
    onSuccess: async () => {
      await invalidateAll(client);
      // Excluir um veículo remove abastecimentos do gasto do mês.
      notifyFuelingDataChanged();
    },
  });
}

export function useCreateVehicle() {
  const ctx = useRepo();
  return useVehicleMutation((input: VehicleInput) => createVehicle(ctx, input));
}

export function useUpdateVehicle() {
  const ctx = useRepo();
  return useVehicleMutation(({ id, input }: { id: string; input: VehicleInput }) =>
    updateVehicle(ctx, id, input),
  );
}

export function useArchiveVehicle() {
  const ctx = useRepo();
  return useVehicleMutation(({ id, archived }: { id: string; archived: boolean }) =>
    archived ? archiveVehicle(ctx, id) : unarchiveVehicle(ctx, id),
  );
}

export function useDeleteVehicle() {
  const ctx = useRepo();
  return useVehicleMutation((id: string) => deleteVehicle(ctx, id));
}

export function useRestartOdometer() {
  const ctx = useRepo();
  return useVehicleMutation((vehicleId: string) => restartOdometer(ctx, vehicleId));
}
