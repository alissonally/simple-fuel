import { render } from '@testing-library/react-native';

import { createFueling, getMeta, listVehicles, type FuelingInput } from '@/repositories';
import { createTestContext, type TestContext } from '@/test/db';
import { router } from '@/test/expoRouter';
import { reset, state } from '@/test/fakeNotifications';
import { createTestProviders } from '@/test/render';

import { NotificationsManager } from '../NotificationsManager';
import {
  handleFuelingDataChanged,
  rescheduleMonthClosing,
  setNotificationsEnabled,
} from '../scheduler';

jest.mock('expo-notifications', () => jest.requireActual('@/test/fakeNotifications'));
jest.mock('expo-router', () => jest.requireActual('@/test/expoRouter'));

beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 23, 12), advanceTimers: true });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  reset();
  jest.clearAllMocks();
});

function addFueling(ctx: TestContext, overrides: Partial<FuelingInput> = {}) {
  return createFueling(ctx, {
    vehicleId: listVehicles(ctx)[0]?.id ?? '',
    date: '2026-10-01',
    odometerKm: 10000,
    pricePerLiterMilli: 5899,
    totalCents: 20000,
    fullTank: true,
    fuelType: 'gasoline',
    ...overrides,
  });
}

describe('month closing notification', () => {
  it('asks for permission only after the first fueling', async () => {
    const ctx = createTestContext();
    await rescheduleMonthClosing(ctx); // abertura do app
    await handleFuelingDataChanged(ctx); // mutação sem registros (ex.: veículo criado)
    expect(state.requests).toBe(0);
    expect(getMeta(ctx, 'notifications_enabled')).toBeNull();

    addFueling(ctx);
    await handleFuelingDataChanged(ctx);
    expect(state.requests).toBe(1);
    expect(getMeta(ctx, 'notifications_enabled')).toBe('1');
    expect(state.scheduled).toHaveLength(1);
    expect(state.scheduled[0]).toMatchObject({
      content: {
        body: 'Outubro: você gastou R$ 200,00 em combustível',
        data: { url: '/monthly?month=2026-10' },
      },
      trigger: { date: new Date(2026, 10, 1, 9) },
    });

    addFueling(ctx, { odometerKm: 10400, date: '2026-10-10', totalCents: 28730 });
    await handleFuelingDataChanged(ctx);
    expect(state.requests).toBe(1);
  });

  it('keeps at most 1 scheduled notification with the updated text', async () => {
    const ctx = createTestContext();
    for (const [i, total] of [20000, 15000, 13730].entries()) {
      addFueling(ctx, {
        odometerKm: 10000 + i * 400,
        date: `2026-10-0${i + 1}`,
        totalCents: total,
      });
      await handleFuelingDataChanged(ctx);
      expect(state.scheduled).toHaveLength(1);
    }
    expect(state.scheduled[0]?.content.body).toBe('Outubro: você gastou R$ 487,30 em combustível');
  });

  it('turns off without scheduling when permission is denied', async () => {
    const ctx = createTestContext();
    state.grantOnRequest = false;
    addFueling(ctx);
    await handleFuelingDataChanged(ctx);
    expect(getMeta(ctx, 'notifications_enabled')).toBe('0');
    expect(state.scheduled).toHaveLength(0);
  });

  it('the settings toggle cancels and reschedules', async () => {
    const ctx = createTestContext();
    addFueling(ctx);
    await handleFuelingDataChanged(ctx);
    expect(await setNotificationsEnabled(ctx, false)).toBe(false);
    expect(state.scheduled).toHaveLength(0);
    expect(await setNotificationsEnabled(ctx, true)).toBe(true);
    expect(state.scheduled).toHaveLength(1);
  });

  it('cancels a stale notification on open when the month has no records', async () => {
    const ctx = createTestContext();
    addFueling(ctx, { date: '2026-09-10' });
    await handleFuelingDataChanged(ctx);
    expect(state.scheduled).toHaveLength(0); // setembro já foi notificado; outubro está vazio
  });

  it('reschedules on open and opens the previous month summary when tapped', async () => {
    const ctx = createTestContext();
    addFueling(ctx);
    state.granted = true;
    const { setMeta } = jest.requireActual<typeof import('@/repositories')>('@/repositories');
    setMeta(ctx, 'notifications_enabled', '1');
    state.lastResponse = {
      notification: { request: { content: { data: { url: '/monthly?month=2026-09' } } } },
    };

    const { Wrapper } = createTestProviders(ctx);
    await render(<NotificationsManager />, { wrapper: Wrapper });

    expect(router.push).toHaveBeenCalledWith('/monthly?month=2026-09');
    expect(state.lastResponse).toBeNull();
    await jest.runAllTimersAsync();
    expect(state.scheduled).toHaveLength(1);
  });
});
