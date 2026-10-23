import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Badge, Button, Card } from '@/components/ui';
import { FUEL_LABELS } from '@/domain/format';
import { formatPlate } from '@/domain/plate';
import { useBackupActions } from '@/features/backup/useBackupActions';
import { notificationsSupported } from '@/features/notifications/scheduler';
import { useNotificationSetting } from '@/features/notifications/useNotificationSetting';
import { useVehicles } from '@/hooks';
import { colors, spacing } from '@/theme';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  const vehicles = useVehicles({ includeArchived: true }).data ?? [];
  const backup = useBackupActions();
  const notification = useNotificationSetting();
  const denied = notification.preference !== null && notification.granted === false;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Veículos">
        {vehicles.map((vehicle) => (
          <Pressable
            key={vehicle.id}
            accessibilityRole="button"
            onPress={() => router.push(`/vehicle/${vehicle.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{vehicle.nickname}</Text>
              <Text style={styles.muted}>
                {[
                  vehicle.plate ? formatPlate(vehicle.plate) : null,
                  [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || null,
                  FUEL_LABELS[vehicle.defaultFuel],
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            {vehicle.archivedAt !== null ? <Badge label="arquivado" /> : null}
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
        <View style={styles.action}>
          <Button
            title="Adicionar veículo"
            variant="secondary"
            onPress={() => router.push('/vehicle/new')}
          />
        </View>
      </Section>

      {notificationsSupported ? (
        <Section title="Notificações">
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Fechamento do mês</Text>
              <Text style={styles.muted}>
                {denied
                  ? 'Permissão de notificações negada. Ative-a nas configurações do sistema.'
                  : 'No dia 1, às 9h, um resumo do gasto do mês anterior.'}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Notificação de fechamento do mês"
              value={notification.enabled ?? false}
              disabled={notification.loading}
              trackColor={{ true: colors.primary, false: colors.border }}
              onValueChange={(value) => {
                void notification.setEnabled(value).then((enabled) => {
                  if (value && !enabled) {
                    Alert.alert(
                      'Permissão negada',
                      'Para receber o resumo do mês, permita as notificações do app nas ' +
                        'configurações do sistema.',
                    );
                  }
                });
              }}
            />
          </View>
        </Section>
      ) : null}

      <Section title="Backup">
        <View style={styles.actions}>
          <Button
            title="Exportar dados (JSON)"
            variant="secondary"
            disabled={backup.busy}
            onPress={() => void backup.exportJson()}
          />
          <Button
            title="Importar dados (JSON)"
            variant="secondary"
            disabled={backup.busy}
            onPress={() => void backup.importJson()}
          />
          <Button
            title="Exportar planilha (CSV)"
            variant="secondary"
            disabled={backup.busy}
            onPress={() => void backup.exportCsv()}
          />
        </View>
      </Section>

      <Section title="Sobre">
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Versão</Text>
          <Text style={styles.muted}>{Constants.expoConfig?.version ?? '—'}</Text>
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  card: { padding: 0, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, color: colors.text, flex: 1 },
  muted: { fontSize: 13, color: colors.muted },
  action: { padding: spacing.md },
  actions: { padding: spacing.md, gap: spacing.sm },
});
