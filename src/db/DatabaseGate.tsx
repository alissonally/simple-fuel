import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { bootstrapDatabase } from './bootstrap';
import { db, repoContext } from './client';
import migrations from './migrations/migrations';

function runBootstrap(): { error: Error | null } {
  try {
    bootstrapDatabase(repoContext);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** Roda as migrations e o seed do veículo implícito antes de renderizar o app. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const { success, error: migrationError } = useMigrations(db, migrations);
  // bootstrapDatabase é idempotente, então pode rodar durante a renderização.
  const bootstrap = useMemo(() => (success ? runBootstrap() : null), [success]);

  const error = migrationError ?? bootstrap?.error ?? null;
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Não foi possível abrir o banco de dados</Text>
        <Text style={styles.detail}>{error.message}</Text>
      </View>
    );
  }

  if (!bootstrap) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  detail: { marginTop: spacing.sm, color: colors.muted, textAlign: 'center' },
});
