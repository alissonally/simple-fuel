import { fireEvent, render, screen } from '@testing-library/react-native';

import MonthlyScreen from '../../../app/(tabs)/monthly';
import { createVehicle, listVehicles } from '@/repositories';
import { createTestContext } from '@/test/db';
import { useLocalSearchParams } from '@/test/expoRouter';
import { createTestProviders } from '@/test/render';
import { seedFuelings } from '@/test/seed';

jest.mock('expo-router', () => jest.requireActual('@/test/expoRouter'));

// O gráfico real depende de SVG; aqui cada barra vira um botão com o rótulo.
jest.mock('react-native-gifted-charts', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BarChart: ({ data }: { data: { label: string; value: number; onPress: () => void }[] }) =>
      data.map((bar) => (
        <Pressable key={bar.label} accessibilityLabel={`barra ${bar.label}`} onPress={bar.onPress}>
          <Text>{`${bar.label}:${bar.value}`}</Text>
        </Pressable>
      )),
  };
});

beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 23, 12), advanceTimers: true });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => useLocalSearchParams.mockReturnValue({}));

async function renderMonthly(seed = 3) {
  const ctx = createTestContext();
  seedFuelings(ctx, seed);
  const { Wrapper } = createTestProviders(ctx);
  await render(<MonthlyScreen />, { wrapper: Wrapper });
  return ctx;
}

describe('Monthly summary', () => {
  it('shows the metrics of section 2.3 for the current month', async () => {
    await renderMonthly();
    expect(await screen.findByText('Outubro 2026')).toBeTruthy();
    expect(screen.getByText('R$ 450,00')).toBeTruthy();
    expect(screen.getByText('450 km')).toBeTruthy();
    expect(screen.getByText('10,6 km/l')).toBeTruthy();
    expect(screen.getByText('R$ 0,56/km')).toBeTruthy(); // R$ 250,00 do ciclo / 450 km
    expect(screen.getByText('R$ 5,899')).toBeTruthy();
    expect(
      screen.getByText('Gasto pela data do abastecimento. Consumo pelos ciclos fechados no mês.'),
    ).toBeTruthy();
  });

  it('shows "—" for consumption in an empty month', async () => {
    await renderMonthly(0);
    expect(await screen.findByText('Outubro 2026')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('R$ 0,00')).toBeTruthy();
  });

  it('navigates between months without going past the current one', async () => {
    await renderMonthly();
    await screen.findByText('Outubro 2026');
    const next = screen.getByLabelText('Próximo mês');
    expect(next.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(next);
    expect(screen.getByText('Outubro 2026')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Mês anterior'));
    expect(await screen.findByText('Setembro 2026')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Próximo mês'));
    expect(await screen.findByText('Outubro 2026')).toBeTruthy();
  });

  it('tapping a bar navigates to its month', async () => {
    await renderMonthly();
    expect(await screen.findByText('Out:450')).toBeTruthy();
    expect(screen.getByText('Mai:0')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('barra Jul'));
    expect(await screen.findByText('Julho 2026')).toBeTruthy();
  });

  it('accepts the month route param (deep link), capped at the current month', async () => {
    useLocalSearchParams.mockReturnValue({ month: '2026-09' });
    await renderMonthly();
    expect(await screen.findByText('Setembro 2026')).toBeTruthy();
  });

  it('ignores a future or invalid month param', async () => {
    useLocalSearchParams.mockReturnValue({ month: '2027-01' });
    await renderMonthly();
    expect(await screen.findByText('Outubro 2026')).toBeTruthy();
  });

  it('with 2+ vehicles shows "Todos" with spending per vehicle and no consumption', async () => {
    const ctx = createTestContext();
    seedFuelings(ctx, 3);
    const moto = createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    seedFuelings(ctx, 1, moto.id);
    const { Wrapper } = createTestProviders(ctx);
    await render(<MonthlyScreen />, { wrapper: Wrapper });

    await fireEvent.press(await screen.findByText('Todos'));
    expect(await screen.findByText('Gasto por veículo')).toBeTruthy();
    expect(await screen.findByText('R$ 650,00')).toBeTruthy();
    expect(screen.getAllByText(listVehicles(ctx)[0]?.nickname ?? '')).toHaveLength(2);
    expect(screen.queryByText('Consumo médio')).toBeNull();
  });
});
