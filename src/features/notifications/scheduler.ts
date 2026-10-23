import {
  AndroidImportance,
  cancelAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { Platform } from 'react-native';

import type { RepoContext } from '@/db/types';
import { getMeta, listFuelings, setMeta } from '@/repositories';

import { planMonthClosing } from './plan';

const CHANNEL_ID = 'month-closing';
const NOTIFICATION_ID = 'month-closing';

/** Preferência salva: null enquanto o usuário não registrou o primeiro abastecimento. */
export function notificationsPreference(ctx: RepoContext): boolean | null {
  const value = getMeta(ctx, 'notifications_enabled');
  return value === null ? null : value === '1';
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Fechamento do mês',
    importance: AndroidImportance.DEFAULT,
  });
}

/** expo-notifications não funciona no web: lá tudo vira no-op. */
export const notificationsSupported = Platform.OS !== 'web';

export async function hasPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const { granted } = await getPermissionsAsync();
  return granted;
}

async function requestPermission(): Promise<boolean> {
  await ensureChannel();
  if (await hasPermission()) return true;
  const { granted } = await requestPermissionsAsync();
  return granted;
}

/**
 * Cancela e reagenda a notificação (no máximo uma por vez). Nunca pede permissão.
 * Chamado ao abrir o app e após cada mutação.
 */
export async function rescheduleMonthClosing(ctx: RepoContext, now = new Date()): Promise<void> {
  if (!notificationsSupported) return;
  await cancelAllScheduledNotificationsAsync();
  if (notificationsPreference(ctx) !== true || !(await hasPermission())) return;

  const plan = planMonthClosing(now, listFuelings(ctx));
  if (!plan) return;
  await ensureChannel();
  await scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: { title: plan.title, body: plan.body, data: { url: plan.url } },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: plan.fireAt,
      channelId: CHANNEL_ID,
    },
  });
}

/**
 * Após uma mutação: no primeiro abastecimento, liga a notificação por padrão e só então
 * pede a permissão. Depois, reagenda.
 */
export async function handleFuelingDataChanged(ctx: RepoContext): Promise<void> {
  if (!notificationsSupported) return;
  if (notificationsPreference(ctx) === null && listFuelings(ctx).length > 0) {
    const granted = await requestPermission();
    setMeta(ctx, 'notifications_enabled', granted ? '1' : '0');
  }
  await rescheduleMonthClosing(ctx);
}

/** Toggle de Ajustes. Retorna o estado final (desligado se a permissão for negada). */
export async function setNotificationsEnabled(
  ctx: RepoContext,
  enabled: boolean,
): Promise<boolean> {
  const granted = enabled ? await requestPermission() : false;
  setMeta(ctx, 'notifications_enabled', granted ? '1' : '0');
  await rescheduleMonthClosing(ctx);
  return granted;
}
