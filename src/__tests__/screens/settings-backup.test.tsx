import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import SettingsScreen from '../../../app/(tabs)/settings';
import { exportBackup, serializeBackup } from '@/features/backup/backup';
import { pickBackupText, shareBackupFile, shareCsvFile } from '@/features/backup/files';
import { listFuelings } from '@/repositories';
import { createTestContext } from '@/test/db';
import { createTestProviders } from '@/test/render';
import { seedFuelings } from '@/test/seed';

jest.mock('expo-router', () => jest.requireActual('@/test/expoRouter'));
jest.mock('@/features/backup/files', () => ({
  pickBackupText: jest.fn(),
  shareBackupFile: jest.fn(async () => {}),
  shareCsvFile: jest.fn(async () => {}),
}));

const pick = jest.mocked(pickBackupText);

describe('Settings backup', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => alertSpy.mockRestore());

  async function renderSettings(seed = 0) {
    const ctx = createTestContext();
    seedFuelings(ctx, seed);
    const { Wrapper } = createTestProviders(ctx);
    await render(<SettingsScreen />, { wrapper: Wrapper });
    return ctx;
  }

  it('exports JSON and CSV through the share sheet', async () => {
    await renderSettings(2);
    await fireEvent.press(screen.getByText('Exportar dados (JSON)'));
    await waitFor(() => expect(shareBackupFile).toHaveBeenCalled());
    const json = jest.mocked(shareBackupFile).mock.calls[0]?.[0] ?? '';
    expect(JSON.parse(json)).toMatchObject({ schemaVersion: 1, fuelings: expect.any(Array) });

    await fireEvent.press(screen.getByText('Exportar planilha (CSV)'));
    await waitFor(() => expect(shareCsvFile).toHaveBeenCalled());
    expect(jest.mocked(shareCsvFile).mock.calls[0]?.[0]).toMatch(/^﻿Data;/);
  });

  it('shows an error for invalid JSON and changes nothing', async () => {
    const ctx = await renderSettings(2);
    pick.mockResolvedValueOnce('not json');
    await fireEvent.press(screen.getByText('Importar dados (JSON)'));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Não foi possível importar',
        'O arquivo não é um JSON válido.',
      ),
    );
    expect(listFuelings(ctx)).toHaveLength(2);
  });

  it('imports with "Substituir tudo"', async () => {
    const source = createTestContext();
    seedFuelings(source, 4);
    const ctx = await renderSettings(1);
    pick.mockResolvedValueOnce(serializeBackup(exportBackup(source)));
    alertSpy.mockImplementationOnce((_t: string, _m: string, buttons: AlertButton[]) => {
      buttons.find((b) => b.text === 'Substituir tudo')?.onPress?.();
    });

    await fireEvent.press(screen.getByText('Importar dados (JSON)'));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Backup importado', expect.any(String)),
    );
    expect(listFuelings(ctx)).toHaveLength(4);
  });
});
