import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
} from 'react-native';

/**
 * ScrollView de formulário que mantém o campo focado acima do teclado.
 *
 * No Android (edge-to-edge) a janela não é redimensionada pelo teclado, então
 * `automaticallyAdjustKeyboardInsets` (só iOS) não basta: usamos
 * KeyboardAvoidingView com `padding`, descontando a altura do header.
 */
export function FormScrollView({ children, ...props }: ScrollViewProps) {
  // Lido via contexto (padrão 0) para funcionar também fora de um navigator, ex. em testes.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView keyboardShouldPersistTaps="handled" {...props}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
