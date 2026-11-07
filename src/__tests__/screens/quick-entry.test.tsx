import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import NewFuelingScreen from '../../../app/fueling/new';
import { listFuelings } from '@/repositories';
import { createTestContext } from '@/test/db';
import { createTestProviders } from '@/test/render';
import { ExpoSpeechRecognitionModule, emit, reset, state } from '@/test/fakeSpeechRecognition';

jest.mock('expo-router', () => jest.requireActual('@/test/expoRouter'));
jest.mock('expo-speech-recognition', () => jest.requireActual('@/test/fakeSpeechRecognition'));

beforeEach(() => {
  reset();
  jest.clearAllMocks();
});

async function renderNew() {
  const ctx = createTestContext();
  const { Wrapper } = createTestProviders(ctx);
  const view = await render(<NewFuelingScreen />, { wrapper: Wrapper });
  await screen.findByTestId('quick-entry');
  return { ctx, view };
}

const speak = (transcript: string, isFinal: boolean) =>
  act(async () => emit('result', { isFinal, results: [{ transcript, confidence: 0.9 }] }));

describe('Quick entry on the new fueling form', () => {
  it('fills the form from a sentence and saves it', async () => {
    const { ctx } = await renderNew();
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

  describe('microphone', () => {
    it('dictates in pt-BR and fills the form with the final transcript', async () => {
      await renderNew();
      await fireEvent.press(screen.getByTestId('quick-entry-mic'));

      expect(await screen.findByText('Ouvindo… diga valor, odômetro, preço e data.')).toBeTruthy();
      expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).toHaveBeenCalled();
      expect(state.started[0]).toMatchObject({ lang: 'pt-BR', interimResults: true });
      expect(screen.getByLabelText('Parar de ouvir')).toBeTruthy();

      await speak('200 reais', false);
      expect(screen.getByTestId('quick-entry').props.value).toBe('200 reais');
      expect(screen.getByTestId('total').props.value).toBe('');

      await speak('200 reais odômetro 85.500 litro a 6,65 ontem', true);
      await act(async () => emit('end'));

      expect(
        await screen.findByText(
          'Preenchido: odômetro, preço, valor, data. Confira antes de salvar.',
        ),
      ).toBeTruthy();
      expect(screen.getByTestId('odometer').props.value).toBe('85.500');
      expect(screen.getByTestId('price').props.value).toBe('6,650');
      expect(screen.getByTestId('total').props.value).toBe('200,00');
      expect(screen.getByTestId('date').props.value).toBe('22/10/2026');
      expect(screen.getByLabelText('Falar o abastecimento')).toBeTruthy();
    });

    it('stops listening when pressed again', async () => {
      await renderNew();
      await fireEvent.press(screen.getByTestId('quick-entry-mic'));
      await screen.findByLabelText('Parar de ouvir');
      await fireEvent.press(screen.getByTestId('quick-entry-mic'));
      expect(ExpoSpeechRecognitionModule.stop).toHaveBeenCalled();
      expect(await screen.findByLabelText('Falar o abastecimento')).toBeTruthy();
    });

    it('explains a denied permission', async () => {
      state.grantOnRequest = false;
      await renderNew();
      await fireEvent.press(screen.getByTestId('quick-entry-mic'));
      expect(
        await screen.findByText(
          'Permita o microfone e o reconhecimento de voz nas configurações do aparelho.',
        ),
      ).toBeTruthy();
      expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
    });

    it('shows recognition errors', async () => {
      await renderNew();
      await fireEvent.press(screen.getByTestId('quick-entry-mic'));
      await act(async () => {
        emit('error', { error: 'no-speech', message: '' });
        emit('end');
      });
      expect(
        await screen.findByText('Não ouvi nada. Toque no microfone e tente de novo.'),
      ).toBeTruthy();
    });

    it('hides the button when recognition is unavailable', async () => {
      state.available = false;
      await renderNew();
      expect(screen.queryByTestId('quick-entry-mic')).toBeNull();
      expect(screen.getByText('Digite ou use o microfone do teclado.')).toBeTruthy();
    });

    it('aborts an active session when the screen closes', async () => {
      const { view } = await renderNew();
      await fireEvent.press(screen.getByTestId('quick-entry-mic'));
      await screen.findByLabelText('Parar de ouvir');
      await view.unmount();
      expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    });
  });
});
