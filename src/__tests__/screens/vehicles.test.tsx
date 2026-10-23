import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import HistoryScreen from '../../../app/(tabs)/history';
import HomeScreen from '../../../app/(tabs)/index';
import MonthlyScreen from '../../../app/(tabs)/monthly';
import SettingsScreen from '../../../app/(tabs)/settings';
import EditVehicleScreen from '../../../app/vehicle/[id]';
import CompleteFirstVehicleScreen from '../../../app/vehicle/complete-first';
import NewVehicleScreen from '../../../app/vehicle/new';
import { createVehicle, getMeta, listVehicles } from '@/repositories';
import { createTestContext } from '@/test/db';
import { router, useLocalSearchParams } from '@/test/expoRouter';
import { createTestProviders } from '@/test/render';
import { seedFuelings } from '@/test/seed';

jest.mock('expo-router', () => jest.requireActual('@/test/expoRouter'));
jest.mock('react-native-gifted-charts', () => ({ BarChart: () => null }));

beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 23, 12), advanceTimers: true });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({});
});

describe('multiple vehicles', () => {
  it('with 1 active vehicle no selector appears on any screen', async () => {
    const ctx = createTestContext();
    seedFuelings(ctx, 3);
    const { Wrapper } = createTestProviders(ctx);
    await render(
      <>
        <HomeScreen />
        <HistoryScreen />
        <MonthlyScreen />
      </>,
      { wrapper: Wrapper },
    );
    await screen.findByText('Último consumo');
    expect(screen.queryByLabelText('Veículo')).toBeNull();
    expect(screen.queryByLabelText('Filtrar por veículo')).toBeNull();
    expect(screen.queryByLabelText('Veículo do resumo')).toBeNull();
    expect(screen.queryByText('Todos')).toBeNull();
  });

  it('adding the 2nd vehicle leads to complete-first and selects the new vehicle', async () => {
    const ctx = createTestContext();
    const { Wrapper } = createTestProviders(ctx);
    await render(<NewVehicleScreen />, { wrapper: Wrapper });

    await fireEvent.changeText(screen.getByTestId('vehicle-nickname'), 'Moto');
    await fireEvent.changeText(screen.getByTestId('vehicle-plate'), 'abc1d23');
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/vehicle/complete-first'));
    const moto = listVehicles(ctx).find((v) => v.nickname === 'Moto');
    expect(moto?.plate).toBe('ABC1D23');
    expect(getMeta(ctx, 'last_vehicle_id')).toBe(moto?.id);
  });

  it('adding a 3rd vehicle just goes back', async () => {
    const ctx = createTestContext();
    createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    const { Wrapper } = createTestProviders(ctx);
    await render(<NewVehicleScreen />, { wrapper: Wrapper });
    await fireEvent.changeText(screen.getByTestId('vehicle-nickname'), 'Van');
    await fireEvent.press(screen.getByTestId('save'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('complete-first refuses a duplicate nickname and then saves', async () => {
    const ctx = createTestContext();
    createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    const { Wrapper } = createTestProviders(ctx);
    await render(<CompleteFirstVehicleScreen />, { wrapper: Wrapper });

    const nickname = await screen.findByTestId('vehicle-nickname');
    expect(nickname.props.value).toBe('Meu veículo');
    expect(screen.queryByText(/pular/i)).toBeNull();

    await fireEvent.changeText(nickname, 'moto');
    await fireEvent.press(screen.getByTestId('save'));
    expect(await screen.findByText('Já existe um veículo com esse apelido')).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();

    await fireEvent.changeText(nickname, 'Carro');
    await fireEvent.press(screen.getByTestId('save'));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(listVehicles(ctx).map((v) => v.nickname)).toEqual(['Carro', 'Moto']);
  });

  it('archiving down to 1 vehicle goes back to simple mode', async () => {
    const ctx = createTestContext();
    const moto = createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    useLocalSearchParams.mockReturnValue({ id: moto.id });
    const { Wrapper } = createTestProviders(ctx);
    await render(
      <>
        <HomeScreen />
        <EditVehicleScreen />
      </>,
      { wrapper: Wrapper },
    );
    expect(await screen.findByLabelText('Veículo')).toBeTruthy();

    await fireEvent.press(await screen.findByText('Arquivar'));
    await waitFor(() => expect(screen.queryByLabelText('Veículo')).toBeNull());
    expect(listVehicles(ctx)).toHaveLength(1);
    expect(listVehicles(ctx, { includeArchived: true })).toHaveLength(2);
  });

  it('cannot delete or archive the last active vehicle', async () => {
    const ctx = createTestContext();
    const only = listVehicles(ctx)[0];
    useLocalSearchParams.mockReturnValue({ id: only?.id });
    const { Wrapper } = createTestProviders(ctx);
    await render(<EditVehicleScreen />, { wrapper: Wrapper });

    expect(await screen.findByText(/único veículo ativo/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Arquivar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excluir veículo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reiniciar odômetro' })).toBeEnabled();
  });

  it('settings lists vehicles, including archived ones', async () => {
    const ctx = createTestContext();
    createVehicle(ctx, { nickname: 'Moto', plate: 'ABC1234', defaultFuel: 'ethanol' });
    const { Wrapper } = createTestProviders(ctx);
    await render(<SettingsScreen />, { wrapper: Wrapper });
    expect(await screen.findByText('Moto')).toBeTruthy();
    expect(screen.getByText('ABC-1234 · Etanol')).toBeTruthy();
    await fireEvent.press(screen.getByText('Adicionar veículo'));
    expect(router.push).toHaveBeenCalledWith('/vehicle/new');
  });
});
