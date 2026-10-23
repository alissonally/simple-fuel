import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useRepo } from '@/hooks';

import { hasPermission, notificationsPreference, setNotificationsEnabled } from './scheduler';

const KEY = ['notificationSetting'] as const;

/** Estado do toggle: ligado só com a preferência ativa e a permissão concedida. */
export function useNotificationSetting() {
  const ctx = useRepo();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const preference = notificationsPreference(ctx);
      const granted = await hasPermission();
      return { enabled: preference === true && granted, preference, granted };
    },
  });
  return {
    ...query.data,
    loading: query.isPending,
    setEnabled: async (enabled: boolean) => {
      const result = await setNotificationsEnabled(ctx, enabled);
      await client.invalidateQueries({ queryKey: KEY });
      return result;
    },
  };
}
