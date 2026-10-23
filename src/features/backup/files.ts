import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { toISODate } from '@/domain/dates';

async function shareText(name: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await isAvailableAsync())) {
    throw new Error('O compartilhamento não está disponível neste aparelho.');
  }
  await shareAsync(file.uri, { mimeType, dialogTitle: name });
}

export function shareBackupFile(json: string) {
  return shareText(`combustivel-backup-${toISODate(new Date())}.json`, json, 'application/json');
}

export function shareCsvFile(csv: string) {
  return shareText(`combustivel-${toISODate(new Date())}.csv`, csv, 'text/csv');
}

/** Abre o seletor de arquivos e devolve o texto do JSON escolhido, ou null se cancelado. */
export async function pickBackupText(): Promise<string | null> {
  const result = await getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return new File(asset.uri).text();
}
