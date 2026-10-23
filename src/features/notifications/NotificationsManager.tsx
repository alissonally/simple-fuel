import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { onFuelingDataChanged, useRepo } from '@/hooks';

import { handleFuelingDataChanged, rescheduleMonthClosing } from './scheduler';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function logError(error: unknown) {
  console.warn('[notifications]', error);
}

/** Reagenda ao abrir e após mutações; abre o Resumo ao tocar na notificação. */
export function NotificationsManager() {
  const ctx = useRepo();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    rescheduleMonthClosing(ctx).catch(logError);
    return onFuelingDataChanged(() => {
      handleFuelingDataChanged(ctx).catch(logError);
    });
  }, [ctx]);

  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url !== 'string') return;
    router.push(url as Href);
    Notifications.clearLastNotificationResponse();
  }, [response]);

  return null;
}
