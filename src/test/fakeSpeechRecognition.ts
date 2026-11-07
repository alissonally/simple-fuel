/** Fake do expo-speech-recognition: os testes disparam os eventos com `emit`. */
type Listener = (event: unknown) => void;

export const state = {
  available: true,
  grantOnRequest: true,
  listeners: new Map<string, Set<Listener>>(),
  started: [] as unknown[],
};

export function reset() {
  state.available = true;
  state.grantOnRequest = true;
  state.listeners.clear();
  state.started = [];
}

export function emit(name: string, event: unknown = null) {
  state.listeners.get(name)?.forEach((listener) => listener(event));
}

export const ExpoSpeechRecognitionModule = {
  isRecognitionAvailable: jest.fn(() => state.available),
  requestPermissionsAsync: jest.fn(async () => ({ granted: state.grantOnRequest })),
  addListener: jest.fn((name: string, listener: Listener) => {
    const set = state.listeners.get(name) ?? new Set<Listener>();
    set.add(listener);
    state.listeners.set(name, set);
    return { remove: () => set.delete(listener) };
  }),
  start: jest.fn((options: unknown) => {
    state.started.push(options);
    emit('start');
  }),
  stop: jest.fn(() => emit('end')),
  abort: jest.fn(() => {
    emit('error', { error: 'aborted', message: '' });
    emit('end');
  }),
};
