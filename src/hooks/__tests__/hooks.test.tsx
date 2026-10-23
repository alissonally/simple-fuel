import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getMeta, listVehicles, type FuelingInput } from '@/repositories';
import { createTestProviders } from '@/test/render';

import {
  onFuelingDataChanged,
  useActiveVehicle,
  useCreateFueling,
  useCreateVehicle,
  useCycles,
  useMonthlySummary,
  useSetExcludeFromAverage,
} from '..';

function useFixture(vehicleId: string, month: string) {
  return {
    cycles: useCycles(vehicleId),
    monthly: useMonthlySummary(month, vehicleId),
    create: useCreateFueling(),
    exclude: useSetExcludeFromAverage(),
  };
}

describe('hooks', () => {
  it('cycles and monthly summary are derived from the repository and refresh after mutations', async () => {
    const { ctx, Wrapper } = createTestProviders();
    const vehicleId = listVehicles(ctx)[0]?.id ?? '';
    const listener = jest.fn();
    const unsubscribe = onFuelingDataChanged(listener);
    const { result } = await renderHook(() => useFixture(vehicleId, '2026-10'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.cycles.data).toEqual([]));

    const input = (overrides: Partial<FuelingInput>): FuelingInput => ({
      vehicleId,
      date: '2026-10-01',
      odometerKm: 10000,
      pricePerLiterMilli: 5899,
      totalCents: 20000,
      fullTank: true,
      fuelType: 'gasoline',
      ...overrides,
    });

    await act(async () => {
      await result.current.create.mutateAsync({ input: input({}) });
      await result.current.create.mutateAsync({
        input: input({ odometerKm: 10200, date: '2026-10-05', totalCents: 10000, fullTank: false }),
      });
    });
    let closing = '';
    await act(async () => {
      const saved = await result.current.create.mutateAsync({
        input: input({ odometerKm: 10450, date: '2026-10-10', totalCents: 15000 }),
      });
      closing = saved.id;
    });

    await waitFor(() => expect(result.current.cycles.data).toHaveLength(1));
    expect(result.current.cycles.data?.[0]?.km).toBe(450);
    expect(result.current.monthly.data).toMatchObject({ spentCents: 45000, km: 450 });
    expect(listener).toHaveBeenCalledTimes(3);

    await act(async () => {
      await result.current.exclude.mutateAsync({ id: closing, exclude: true });
    });
    await waitFor(() => expect(result.current.cycles.data?.[0]?.excluded).toBe(true));
    expect(result.current.monthly.data).toMatchObject({ km: 0, kmPerLiter: null });
    unsubscribe();
  });

  it('persists the active vehicle in app_meta.last_vehicle_id', async () => {
    const { ctx, Wrapper } = createTestProviders();
    const first = listVehicles(ctx)[0];
    const { result } = await renderHook(
      () => ({ active: useActiveVehicle(), createVehicle: useCreateVehicle() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.active.vehicle?.id).toBe(first?.id));

    let secondId = '';
    await act(async () => {
      const second = await result.current.createVehicle.mutateAsync({
        nickname: 'Moto',
        defaultFuel: 'gasoline',
      });
      secondId = second.id;
      await result.current.active.setActiveVehicle(second.id);
    });

    await waitFor(() => expect(result.current.active.vehicle?.id).toBe(secondId));
    expect(getMeta(ctx, 'last_vehicle_id')).toBe(secondId);
  });
});
