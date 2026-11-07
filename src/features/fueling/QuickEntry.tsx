import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Input } from '@/components/ui';
import { useSpeechInput } from '@/features/speech/useSpeechInput';
import { colors, spacing } from '@/theme';

export interface QuickEntryProps {
  /** Preenche o formulário e devolve os nomes dos campos reconhecidos. */
  onApply: (text: string) => string[];
}

type Feedback = { message: string; ok: boolean };

/**
 * Campo para descrever o abastecimento em uma frase, digitada ou falada. Ao fim do
 * ditado, o formulário é preenchido automaticamente.
 */
export function QuickEntry({ onApply }: QuickEntryProps) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const apply = (value: string) => {
    const filled = onApply(value);
    setFeedback(
      filled.length > 0
        ? { ok: true, message: `Preenchido: ${filled.join(', ')}. Confira antes de salvar.` }
        : { ok: false, message: 'Não reconheci nenhum dado. Inclua valor, odômetro ou preço.' },
    );
  };

  const speech = useSpeechInput((transcript, isFinal) => {
    setText(transcript);
    if (isFinal) apply(transcript);
  });

  const toggleListening = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    setFeedback(null);
    void speech.start();
  };

  const status: Feedback | null = speech.listening
    ? { ok: true, message: 'Ouvindo… diga valor, odômetro, preço e data.' }
    : speech.error
      ? { ok: false, message: speech.error }
      : feedback;

  return (
    <View style={styles.container}>
      <Field
        label="Descrever abastecimento"
        hint={
          speech.available
            ? 'Digite ou toque no microfone.'
            : 'Digite ou use o microfone do teclado.'
        }
      >
        <Input
          testID="quick-entry"
          accessibilityLabel="Descrever abastecimento"
          multiline
          placeholder="Ex.: R$ 200 ontem, odômetro 85.500, litro a 6,65"
          style={styles.input}
          value={text}
          editable={!speech.listening}
          onChangeText={(value) => {
            setText(value);
            setFeedback(null);
          }}
        />
      </Field>
      <View style={styles.actions}>
        <View style={styles.applyButton}>
          <Button
            title="Preencher campos"
            variant="secondary"
            onPress={() => apply(text)}
            disabled={!text.trim() || speech.listening}
            testID="quick-entry-apply"
          />
        </View>
        {speech.available ? (
          <Pressable
            testID="quick-entry-mic"
            accessibilityRole="button"
            accessibilityLabel={speech.listening ? 'Parar de ouvir' : 'Falar o abastecimento'}
            onPress={toggleListening}
            style={({ pressed }) => [
              styles.mic,
              speech.listening && styles.micActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={speech.listening ? 'stop' : 'mic'}
              size={24}
              color={speech.listening ? colors.primaryText : colors.primary}
            />
          </Pressable>
        ) : null}
      </View>
      {status ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.feedback, !status.ok && styles.feedbackError]}
        >
          {status.message}
        </Text>
      ) : null}
    </View>
  );
}

const MIC_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  input: { minHeight: 64, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  applyButton: { flex: 1 },
  mic: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  micActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  pressed: { opacity: 0.7 },
  feedback: { color: colors.muted, fontSize: 14 },
  feedbackError: { color: colors.danger },
});
