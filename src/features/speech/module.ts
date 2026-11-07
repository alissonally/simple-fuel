import { isRunningInExpoGo } from 'expo';

export type SpeechRecognitionModule =
  (typeof import('expo-speech-recognition'))['ExpoSpeechRecognitionModule'];

let loaded = false;
let cached: SpeechRecognitionModule | null = null;

/**
 * Carrega `expo-speech-recognition` sob demanda; null onde não há suporte. O módulo
 * nativo não existe no Expo Go nem num development build anterior à instalação, e
 * só importar o pacote já lança erro nesses casos.
 */
export function getSpeechRecognition(): SpeechRecognitionModule | null {
  if (loaded) return cached;
  loaded = true;
  if (isRunningInExpoGo()) return null;
  try {
    // Import tardio de propósito: um import estático quebraria o app sem o módulo nativo.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = (require('expo-speech-recognition') as typeof import('expo-speech-recognition'))
      .ExpoSpeechRecognitionModule;
  } catch {
    cached = null;
  }
  return cached;
}
