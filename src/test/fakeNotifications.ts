/** Fake em memória do expo-notifications. */
export const state = {
  granted: false,
  canAsk: true,
  grantOnRequest: true,
  requests: 0,
  scheduled: [] as {
    identifier: string;
    content: { body: string; data: unknown };
    trigger: { date: Date };
  }[],
  lastResponse: null as unknown,
};

export function reset() {
  Object.assign(state, {
    granted: false,
    canAsk: true,
    grantOnRequest: true,
    requests: 0,
    scheduled: [],
    lastResponse: null,
  });
}

export const AndroidImportance = { DEFAULT: 3 };
export const SchedulableTriggerInputTypes = { DATE: 'date' };
export const setNotificationHandler = jest.fn();
export const setNotificationChannelAsync = jest.fn(async () => null);
export const getPermissionsAsync = jest.fn(async () => ({ granted: state.granted }));
export const requestPermissionsAsync = jest.fn(async () => {
  state.requests += 1;
  state.granted = state.grantOnRequest;
  return { granted: state.granted };
});
export const cancelAllScheduledNotificationsAsync = jest.fn(async () => {
  state.scheduled = [];
});
export const scheduleNotificationAsync = jest.fn(
  async (request: (typeof state.scheduled)[number]) => {
    state.scheduled = state.scheduled.filter((n) => n.identifier !== request.identifier);
    state.scheduled.push(request);
    return request.identifier;
  },
);
export const getAllScheduledNotificationsAsync = jest.fn(async () => state.scheduled);
export const useLastNotificationResponse = jest.fn(() => state.lastResponse);
export const clearLastNotificationResponse = jest.fn(() => {
  state.lastResponse = null;
});
