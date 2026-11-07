import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Field, Input } from '@/components/ui';
import { colors, spacing } from '@/theme';

export interface QuickEntryProps {
  /** Preenche o formulário e devolve os nomes dos campos reconhecidos. */
  onApply: (text: string) => string[];
}

/**
 * Campo para descrever o abastecimento em uma frase. O microfone do teclado
 * permite ditar o texto.
 */
export function QuickEntry({ onApply }: QuickEntryProps) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);

  const apply = () => {
    const filled = onApply(text);
    setFeedback(
      filled.length > 0
        ? { ok: true, message: `Preenchido: ${filled.join(', ')}. Confira antes de salvar.` }
        : { ok: false, message: 'Não reconheci nenhum dado. Inclua valor, odômetro ou preço.' },
    );
  };

  return (
    <View style={styles.container}>
      <Field label="Descrever abastecimento" hint="Digite ou use o microfone do teclado.">
        <Input
          testID="quick-entry"
          accessibilityLabel="Descrever abastecimento"
          multiline
          placeholder="Ex.: R$ 200 ontem, odômetro 85.500, litro a 6,65"
          style={styles.input}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setFeedback(null);
          }}
        />
      </Field>
      <Button
        title="Preencher campos"
        variant="secondary"
        onPress={apply}
        disabled={!text.trim()}
        testID="quick-entry-apply"
      />
      {feedback ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.feedback, !feedback.ok && styles.feedbackError]}
        >
          {feedback.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  input: { minHeight: 64, textAlignVertical: 'top' },
  feedback: { color: colors.muted, fontSize: 14 },
  feedbackError: { color: colors.danger },
});
