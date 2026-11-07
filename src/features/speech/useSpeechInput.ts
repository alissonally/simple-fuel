import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';

import { getSpeechRecognition } from './module';

const UNAVAILABLE = 'Reconhecimento de voz indisponível. Use o microfone do teclado.';
const NO_SPEECH = 'Não ouvi nada. Toque no microfone e tente de novo.';

/** Mensagem para cada erro; null quando não há o que mostrar (cancelado pelo usuário). */
export function speechErrorMessage(code: ExpoSpeechRecognitionErrorCode): string | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'Permita o microfone e o reconhecimento de voz nas configurações do aparelho.';
    case 'no-speech':
    case 'speech-timeout':
      return NO_SPEECH;
    case 'network':
      return 'Sem conexão para reconhecer a voz. Use o microfone do teclado.';
    case 'service-not-allowed':
    case 'language-not-supported':
      return UNAVAILABLE;
    case 'busy':
    case 'too-many-requests':
      return 'O reconhecimento de voz está ocupado. Tente de novo em instantes.';
    default:
      return 'Não foi possível ouvir. Tente de novo.';
  }
}

/** Termos do app que o reconhecedor deve preferir. */
const CONTEXTUAL_STRINGS = ['odômetro', 'etanol', 'GNV', 'diesel', 'tanque cheio', 'parcial'];

/**
 * Ditado em pt-BR. `onTranscript` recebe o texto parcial enquanto o usuário fala e,
 * por fim, o texto final (`isFinal`).
 */
export function useSpeechInput(onTranscript: (text: string, isFinal: boolean) => void) {
  const speech = getSpeechRecognition();
  const [available] = useState(() => {
    try {
      return speech?.isRecognitionAvailable() ?? false;
    } catch {
      return false;
    }
  });
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });
  const listeningRef = useRef(false);

  useEffect(() => {
    if (!speech || !available) return;
    const setActive = (active: boolean) => {
      listeningRef.current = active;
      setListening(active);
    };
    const subscriptions = [
      speech.addListener('start', () => setActive(true)),
      speech.addListener('end', () => setActive(false)),
      speech.addListener('result', (event) => {
        const transcript = event.results[0]?.transcript.trim();
        if (transcript) onTranscriptRef.current(transcript, event.isFinal);
      }),
      speech.addListener('nomatch', () => setError(NO_SPEECH)),
      speech.addListener('error', (event) => setError(speechErrorMessage(event.error))),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      if (listeningRef.current) speech.abort();
    };
  }, [speech, available]);

  const start = useCallback(async () => {
    if (!speech) return;
    setError(null);
    const permission = await speech.requestPermissionsAsync();
    if (!permission.granted) {
      setError(speechErrorMessage('not-allowed'));
      return;
    }
    speech.start({
      lang: 'pt-BR',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      contextualStrings: CONTEXTUAL_STRINGS,
      iosTaskHint: 'dictation',
    });
  }, [speech]);

  const stop = useCallback(() => speech?.stop(), [speech]);

  return { available, listening, error, start, stop };
}
