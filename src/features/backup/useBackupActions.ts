import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useRepo } from '@/hooks';

import {
  exportBackup,
  exportCsv,
  importBackup,
  parseBackup,
  serializeBackup,
  type Backup,
  type ImportMode,
} from './backup';
import { pickBackupText, shareBackupFile, shareCsvFile } from './files';

function chooseMode(backup: Backup): Promise<ImportMode | null> {
  const count = backup.fuelings.filter((f) => f.deletedAt === null).length;
  return new Promise((resolve) => {
    Alert.alert(
      'Importar backup',
      `O arquivo tem ${backup.vehicles.length} veículo(s) e ${count} abastecimento(s).\n\n` +
        '"Substituir tudo" apaga os dados atuais. "Mesclar" combina os dois, mantendo a versão ' +
        'mais recente de cada registro.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Mesclar', onPress: () => resolve('merge') },
        { text: 'Substituir tudo', style: 'destructive', onPress: () => resolve('replace') },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

function fail(title: string, error: unknown) {
  Alert.alert(title, error instanceof Error ? error.message : String(error));
}

/** Ações de backup da tela de Ajustes (seção 6.5). */
export function useBackupActions(onDataChanged?: () => void) {
  const ctx = useRepo();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    exportJson: () =>
      run(() =>
        shareBackupFile(serializeBackup(exportBackup(ctx))).catch((e: unknown) =>
          fail('Não foi possível exportar', e),
        ),
      ),
    exportCsv: () =>
      run(() =>
        shareCsvFile(exportCsv(ctx)).catch((e: unknown) => fail('Não foi possível exportar', e)),
      ),
    importJson: () =>
      run(async () => {
        try {
          const text = await pickBackupText();
          if (text === null) return;
          const backup = parseBackup(text);
          const mode = await chooseMode(backup);
          if (!mode) return;
          importBackup(ctx, backup, mode);
          await queryClient.invalidateQueries();
          onDataChanged?.();
          Alert.alert('Backup importado', 'Seus dados foram restaurados.');
        } catch (error) {
          fail('Não foi possível importar', error);
        }
      }),
  };
}
