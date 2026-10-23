import { Platform } from 'react-native';

import type { RepoContext } from '@/db/types';
import { getMeta, listFuelings, setMeta } from '@/repositories';

import { getNotifications, notificationsSupported } from './module';
import { planMonthClosing } from './plan';

export { notificationsSupported };

const CHANNEL_ID = 'month-closing';
const NOTIFICATION_ID = 'month-closing';

/** Preferência salva: null enquanto o usuário não registrou o primeiro abastecimento. */
export function notificationsPreference(ctx: RepoContext): boolean | null {
  const value = getMeta(ctx, 'notifications_enabled');
  return value === null ? null : value === '1';
}

async function ensureChannel() {
  const notifications = getNotifications();
  if (!notifications || Platform.OS !== 'android') return;
  await notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Fechamento do mês',
    importance: notifications.AndroidImportance.DEFAULT,
  });
}

export async function hasPermission(): Promise<boolean> {
  const notifications = getNotifications();
  if (!notifications) return false;
  const { granted } = await notifications.getPermissionsAsync();
  return granted;
}

async function requestPermission(): Promise<boolean> {
  const notifications = getNotifications();
  if (!notifications) return false;
  await ensureChannel();
  if (await hasPermission()) return true;
  const { granted } = await notifications.requestPermissionsAsync();
  return granted;
}

/**
 * Cancela e reagenda a notificação (no máximo uma por vez). Nunca pede permissão.
 * Chamado ao abrir o app e após cada mutação.
 */
export async function rescheduleMonthClosing(ctx: RepoContext, now = new Date()): Promise<void> {
  const notifications = getNotifications();
  if (!notifications) return;
  await notifications.cancelAllScheduledNotificationsAsync();
  if (notificationsPreference(ctx) !== true || !(await hasPermission())) return;

  const plan = planMonthClosing(now, listFuelings(ctx));
  if (!plan) return;
  await ensureChannel();
  await notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: { title: plan.title, body: plan.body, data: { url: plan.url } },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DATE,
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
  if (!notificationsSupported) return false;
  const granted = enabled ? await requestPermission() : false;
  setMeta(ctx, 'notifications_enabled', granted ? '1' : '0');
  await rescheduleMonthClosing(ctx);
  return granted;
}
