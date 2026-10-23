import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Notificações locais exigem um development build: no web o módulo não existe e, no
 * Expo Go (Android, SDK 53+), só importar `expo-notifications` já lança erro.
 */
export const notificationsSupported = Platform.OS !== 'web' && !isRunningInExpoGo();

let cached: NotificationsModule | null = null;

/** Carrega `expo-notifications` sob demanda; null onde não há suporte. */
export function getNotifications(): NotificationsModule | null {
  if (!notificationsSupported) return null;
  // Import tardio de propósito: um import estático quebraria o app no Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cached ??= require('expo-notifications') as NotificationsModule;
  return cached;
}
