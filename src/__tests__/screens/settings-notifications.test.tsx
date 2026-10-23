import { render, screen } from '@testing-library/react-native';

import SettingsScreen from '../../../app/(tabs)/settings';
import { setMeta } from '@/repositories';
import { createTestContext } from '@/test/db';
import { reset, state } from '@/test/fakeNotifications';
import { createTestProviders } from '@/test/render';

jest.mock('expo-notifications', () => jest.requireActual('@/test/fakeNotifications'));
jest.mock('expo-router', () => jest.requireActual('@/test/expoRouter'));

beforeEach(reset);

async function renderSettings(preference: '1' | '0', granted: boolean) {
  const ctx = createTestContext();
  setMeta(ctx, 'notifications_enabled', preference);
  state.granted = granted;
  const { Wrapper } = createTestProviders(ctx);
  await render(<SettingsScreen />, { wrapper: Wrapper });
}

describe('Settings notification toggle', () => {
  it('is on with preference and permission', async () => {
    await renderSettings('1', true);
    const toggle = await screen.findByLabelText('Notificação de fechamento do mês');
    await screen.findByText('No dia 1, às 9h, um resumo do gasto do mês anterior.');
    expect(toggle.props.value).toBe(true);
  });

  it('appears off with an explanation when permission is denied', async () => {
    await renderSettings('1', false);
    expect(
      await screen.findByText(
        'Permissão de notificações negada. Ative-a nas configurações do sistema.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Notificação de fechamento do mês').props.value).toBe(false);
  });
});
