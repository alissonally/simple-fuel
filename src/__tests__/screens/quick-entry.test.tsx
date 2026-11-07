import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import NewFuelingScreen from '../../../app/fueling/new';
import { listFuelings } from '@/repositories';
import { createTestContext } from '@/test/db';
import { createTestProviders } from '@/test/render';

jest.mock('expo-router', () => jest.requireActual('@/test/expoRouter'));

async function renderNew() {
  const ctx = createTestContext();
  const { Wrapper } = createTestProviders(ctx);
  await render(<NewFuelingScreen />, { wrapper: Wrapper });
  await screen.findByTestId('quick-entry');
  return ctx;
}

describe('Quick entry on the new fueling form', () => {
  it('fills the form from a sentence and saves it', async () => {
    const ctx = await renderNew();
    await fireEvent.changeText(
      screen.getByTestId('quick-entry'),
      'Abasteci R$ 200 em 20 de outubro de 2026, etanol no posto Shell. ' +
        'Odômetro 85500, valor do litro R$ 4,65',
    );
    await fireEvent.press(screen.getByTestId('quick-entry-apply'));

    expect(
      await screen.findByText(
        'Preenchido: odômetro, preço, valor, combustível, data, posto. Confira antes de salvar.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('odometer').props.value).toBe('85.500');
    expect(screen.getByTestId('price').props.value).toBe('4,650');
    expect(screen.getByTestId('total').props.value).toBe('200,00');
    expect(screen.getByTestId('date').props.value).toBe('20/10/2026');
    expect(screen.getByLabelText('Posto').props.value).toBe('Shell');

    await fireEvent.press(screen.getByTestId('save'));
    await waitFor(() => expect(listFuelings(ctx)).toHaveLength(1));
    expect(listFuelings(ctx)[0]).toMatchObject({
      date: '2026-10-20',
      odometerKm: 85500,
      pricePerLiterMilli: 4650,
      totalCents: 20000,
      fuelType: 'ethanol',
      fullTank: true,
      station: 'Shell',
    });
  });

  it('says when nothing was recognized', async () => {
    await renderNew();
    await fireEvent.changeText(screen.getByTestId('quick-entry'), 'oi');
    await fireEvent.press(screen.getByTestId('quick-entry-apply'));
    expect(
      await screen.findByText('Não reconheci nenhum dado. Inclua valor, odômetro ou preço.'),
    ).toBeTruthy();
    expect(screen.getByTestId('odometer').props.value).toBe('');
  });
});
