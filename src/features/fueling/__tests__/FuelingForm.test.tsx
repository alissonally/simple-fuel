import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import {
  createFueling,
  getFueling,
  listFuelings,
  listVehicles,
  updateFueling,
} from '@/repositories';
import { createTestContext } from '@/test/db';
import { createTestProviders } from '@/test/render';

import { emptyValues, fromFueling } from '../formSchema';
import { FuelingForm, type FuelingFormProps } from '../FuelingForm';

const TODAY = new Date(2026, 9, 23);

async function renderForm(overrides: Partial<FuelingFormProps> = {}) {
  const ctx = createTestContext();
  const { Wrapper } = createTestProviders(ctx);
  const vehicles = listVehicles(ctx);
  const vehicle = vehicles[0];
  if (!vehicle) throw new Error('no vehicle');
  const onDone = jest.fn();
  const props: FuelingFormProps = {
    vehicles,
    initialValues: emptyValues({
      vehicleId: vehicle.id,
      fuelType: 'gasoline',
      priceMilli: null,
      today: TODAY,
    }),
    onSave: async (input, options) => createFueling(ctx, input, options),
    onDone,
    ...overrides,
  };
  await render(<FuelingForm {...props} />, { wrapper: Wrapper });
  return { ctx, vehicle, onDone };
}

async function fill(values: { odometer?: string; price?: string; total?: string; date?: string }) {
  for (const [testID, value] of Object.entries(values)) {
    await fireEvent.changeText(screen.getByTestId(testID), value);
  }
}

/** Responde ao próximo Alert pressionando o botão `text`. */
function answerAlert(spy: jest.SpyInstance, text: string) {
  spy.mockImplementationOnce((_title: string, _message: string, buttons: AlertButton[]) => {
    buttons.find((b) => b.text === text)?.onPress?.();
  });
}

describe('FuelingForm', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => alertSpy.mockRestore());

  it('masks input and updates the estimated liters while typing', async () => {
    await renderForm();
    await fill({ price: '5899' });
    expect(screen.getByTestId('price').props.value).toBe('5,899');
    expect(screen.queryByText(/^≈/)).toBeNull();

    await fill({ total: '20000' });
    expect(screen.getByTestId('total').props.value).toBe('200,00');
    expect(screen.getByText('≈ 33,90 L')).toBeTruthy();

    await fill({ total: '200000' });
    expect(screen.getByText('≈ 339,04 L')).toBeTruthy();
  });

  it('shows field errors and does not save', async () => {
    const { ctx, onDone } = await renderForm();
    await fill({ date: '24102026' });
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() => expect(screen.getByText('A data não pode ser futura')).toBeTruthy());
    expect(screen.getAllByText('Campo obrigatório')).toHaveLength(3);
    expect(listFuelings(ctx)).toHaveLength(0);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('opens a "Salvar mesmo assim" dialog for warnings and saves only after confirming', async () => {
    const { ctx, onDone } = await renderForm();
    await fill({ odometer: '10000', price: '25000', total: '20000' });
    answerAlert(alertSpy, 'Salvar mesmo assim');
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [title, message] = alertSpy.mock.calls[0] as [string, string];
    expect(title).toBe('Confira antes de salvar');
    expect(message).toContain('erro de digitação');
    expect(listFuelings(ctx)).toHaveLength(1);
  });

  it('does not save when the user reviews the warning', async () => {
    const { ctx, onDone } = await renderForm();
    await fill({ odometer: '10000', price: '25000', total: '20000' });
    answerAlert(alertSpy, 'Revisar');
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
    expect(listFuelings(ctx)).toHaveLength(0);
  });

  it('shows a consumption toast when saving closes a cycle', async () => {
    const ctx = createTestContext();
    const vehicle = listVehicles(ctx)[0];
    const base = {
      vehicleId: vehicle?.id ?? '',
      pricePerLiterMilli: 5899,
      fuelType: 'gasoline' as const,
    };
    createFueling(ctx, {
      ...base,
      date: '2026-10-01',
      odometerKm: 10000,
      totalCents: 20000,
      fullTank: true,
    });
    createFueling(ctx, {
      ...base,
      date: '2026-10-05',
      odometerKm: 10200,
      totalCents: 10000,
      fullTank: false,
    });

    const { Wrapper } = createTestProviders(ctx);
    const onDone = jest.fn();
    await render(
      <FuelingForm
        vehicles={listVehicles(ctx)}
        initialValues={emptyValues({
          vehicleId: vehicle?.id ?? '',
          fuelType: 'gasoline',
          priceMilli: 5899,
          today: TODAY,
        })}
        onSave={async (input, options) => createFueling(ctx, input, options)}
        onDone={onDone}
      />,
      { wrapper: Wrapper },
    );

    expect(await screen.findByText('Último registro: 10.200 km')).toBeTruthy();
    await fill({ odometer: '10450', total: '15000' });
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(screen.getByText('Consumo: 10,6 km/l')).toBeTruthy();
  });

  it('loads values when editing and allows deleting', async () => {
    const ctx = createTestContext();
    const vehicle = listVehicles(ctx)[0];
    const saved = createFueling(ctx, {
      vehicleId: vehicle?.id ?? '',
      date: '2026-10-01',
      odometerKm: 45230,
      pricePerLiterMilli: 5899,
      totalCents: 20000,
      fullTank: false,
      fuelType: 'ethanol',
      station: 'Posto Central',
    });
    const { Wrapper } = createTestProviders(ctx);
    const onDelete = jest.fn();
    const onDone = jest.fn();
    await render(
      <FuelingForm
        editingId={saved.id}
        vehicles={listVehicles(ctx)}
        initialValues={fromFueling(saved)}
        onSave={async (input, options) => updateFueling(ctx, saved.id, input, options)}
        onDelete={onDelete}
        onDone={onDone}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('odometer').props.value).toBe('45.230');
    expect(screen.getByTestId('price').props.value).toBe('5,899');
    expect(screen.getByTestId('total').props.value).toBe('200,00');
    expect(screen.getByTestId('date').props.value).toBe('01/10/2026');
    expect(screen.getByDisplayValue('Posto Central')).toBeTruthy();

    await fill({ total: '15000' });
    await fireEvent.press(screen.getByTestId('save'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(getFueling(ctx, saved.id)?.totalCents).toBe(15000);

    answerAlert(alertSpy, 'Excluir');
    await fireEvent.press(screen.getByText('Excluir'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('shows the vehicle selector only with 2+ vehicles', async () => {
    await renderForm();
    expect(screen.queryByLabelText('Veículo')).toBeNull();
  });
});
