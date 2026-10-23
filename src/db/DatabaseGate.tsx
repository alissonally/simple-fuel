import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { RepoProvider } from '@/hooks/RepoProvider';
import { colors, spacing } from '@/theme';

import { initDatabase } from './client';
import type { RepoContext } from './types';

type State = { ctx: RepoContext; error: null } | { ctx: null; error: Error } | null;

/**
 * Abre o banco, roda as migrations e o seed do veículo implícito antes de renderizar
 * o app, e disponibiliza o contexto dos repositórios.
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    let active = true;
    initDatabase().then(
      (ctx) => active && setState({ ctx, error: null }),
      (e: unknown) =>
        active && setState({ ctx: null, error: e instanceof Error ? e : new Error(String(e)) }),
    );
    return () => {
      active = false;
    };
  }, []);

  if (state?.error) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Não foi possível abrir o banco de dados</Text>
        <Text style={styles.detail}>{state.error.message}</Text>
      </View>
    );
  }

  if (!state) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <RepoProvider value={state.ctx}>{children}</RepoProvider>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  detail: { marginTop: spacing.sm, color: colors.muted, textAlign: 'center' },
});
