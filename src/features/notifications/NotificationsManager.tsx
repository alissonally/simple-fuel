import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { onFuelingDataChanged, useRepo } from '@/hooks';

import { getNotifications } from './module';
import { handleFuelingDataChanged, rescheduleMonthClosing } from './scheduler';

function logError(error: unknown) {
  console.warn('[notifications]', error);
}

function openFromResponse(response: {
  notification: { request: { content: { data?: unknown } } };
}) {
  const data = response.notification.request.content.data;
  const url = typeof data === 'object' && data !== null && 'url' in data ? data.url : undefined;
  if (typeof url !== 'string') return;
  router.push(url as Href);
  getNotifications()?.clearLastNotificationResponse();
}

/** Reagenda ao abrir e após mutações; abre o Resumo ao tocar na notificação. */
export function NotificationsManager() {
  const ctx = useRepo();

  useEffect(() => {
    const notifications = getNotifications();
    if (!notifications) return;

    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    // Toque que abriu o app (frio) e toques com o app já aberto.
    notifications
      .getLastNotificationResponseAsync()
      .then((response) => response && openFromResponse(response))
      .catch(logError);
    const subscription = notifications.addNotificationResponseReceivedListener(openFromResponse);

    rescheduleMonthClosing(ctx).catch(logError);
    const unsubscribe = onFuelingDataChanged(() => {
      handleFuelingDataChanged(ctx).catch(logError);
    });
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [ctx]);

  return null;
}
