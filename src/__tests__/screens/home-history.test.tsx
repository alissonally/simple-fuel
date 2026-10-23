import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import HistoryScreen from '../../../app/(tabs)/history';
import HomeScreen from '../../../app/(tabs)/index';
import { createVehicle, listFuelings } from '@/repositories';
import { createTestContext } from '@/test/db';
import { createTestProviders } from '@/test/render';
import { seedFuelings } from '@/test/seed';

jest.mock('expo-router', () => jest.requireActual('@/test/expoRouter'));

beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 23, 12), advanceTimers: true });
});
afterAll(() => jest.useRealTimers());

async function renderWith(ui: React.ReactElement, seed = 0) {
  const ctx = createTestContext();
  seedFuelings(ctx, seed);
  const { Wrapper } = createTestProviders(ctx);
  await render(ui, { wrapper: Wrapper });
  return ctx;
}

describe('Home', () => {
  it('shows the empty state with 0 records', async () => {
    await renderWith(<HomeScreen />);
    expect(await screen.findByText('Registre seu primeiro abastecimento')).toBeTruthy();
    expect(screen.getByText('Registrar abastecimento')).toBeTruthy();
  });

  it('asks for the next full tank with 1 record', async () => {
    await renderWith(<HomeScreen />, 1);
    expect(
      await screen.findByText('O consumo aparece a partir do próximo tanque cheio'),
    ).toBeTruthy();
    expect(screen.getByText('R$ 200,00')).toBeTruthy();
    expect(screen.getByText('1 abastecimento · 33,90 L')).toBeTruthy();
  });

  it('shows the last consumption, average and month with a closed cycle', async () => {
    await renderWith(<HomeScreen />, 3);
    expect(await screen.findByText('Último consumo')).toBeTruthy();
    expect(screen.getAllByText('10,6 km/l')).toHaveLength(2); // último e média
    expect(screen.getByText('10/10/2026 · Gasolina')).toBeTruthy();
    expect(screen.getByText('R$ 450,00')).toBeTruthy();
    expect(screen.queryByText('O consumo aparece a partir do próximo tanque cheio')).toBeNull();
  });

  it('shows the vehicle selector only with 2+ active vehicles', async () => {
    const ctx = createTestContext();
    const { Wrapper } = createTestProviders(ctx);
    await render(<HomeScreen />, { wrapper: Wrapper });
    await screen.findByText('Registre seu primeiro abastecimento');
    expect(screen.queryByLabelText('Veículo')).toBeNull();

    createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    const second = createTestProviders(ctx);
    await render(<HomeScreen />, { wrapper: second.Wrapper });
    expect(await screen.findByLabelText('Veículo')).toBeTruthy();
    expect(screen.getByText('Moto')).toBeTruthy();
  });
});

describe('History', () => {
  it('shows an empty message without records', async () => {
    await renderWith(<HistoryScreen />);
    expect(await screen.findByText('Nenhum abastecimento registrado.')).toBeTruthy();
  });

  it('lists records grouped by month with the cycle consumption', async () => {
    await renderWith(<HistoryScreen />, 3);
    expect(await screen.findByText('Outubro 2026')).toBeTruthy();
    expect(screen.getByText('10/10/2026')).toBeTruthy();
    expect(screen.getByText('05/10/2026')).toBeTruthy();
    expect(screen.getByText('10,6 km/l')).toBeTruthy();
    expect(screen.getByText('10.450 km · 25,43 L · Gasolina')).toBeTruthy();
  });

  it('long press toggles "Ignorar na média" and the average updates', async () => {
    const ctx = createTestContext();
    const [, , closing] = seedFuelings(ctx, 4);
    const { Wrapper } = createTestProviders(ctx);
    await render(
      <>
        <HomeScreen />
        <HistoryScreen />
      </>,
      { wrapper: Wrapper },
    );

    // Ciclos: 450 km / 42,38 L e 400 km / 33,904 L → média 850 / 76,284 = 11,1 km/l
    expect(await screen.findByText('Média geral')).toBeTruthy();
    expect(screen.getByText('11,1 km/l')).toBeTruthy();

    await fireEvent(screen.getByTestId(`fueling-${closing?.id}`), 'longPress');

    await waitFor(() => expect(screen.getByText('ignorado')).toBeTruthy());
    // Resta só o 2º ciclo: 400 / 33,904 = 11,8 km/l (último consumo e média)
    expect(screen.getAllByText('11,8 km/l').length).toBeGreaterThanOrEqual(2);
    expect(listFuelings(ctx).find((f) => f.id === closing?.id)?.excludeFromAverage).toBe(true);
  });
});
