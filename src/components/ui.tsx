import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '@/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.cardTitle}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  large,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  large?: boolean;
  testID?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive) }}
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        large && styles.buttonLarge,
        styles[variant],
        (pressed || inactive) && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.primaryText} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryText]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input({ invalid, style, ...props }: TextInputProps & { invalid?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.input, invalid && styles.inputInvalid, style]}
      {...props}
    />
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/** Grupo de opções exclusivas (combustível, veículo, "Todos / Veículo A"). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View
      style={styles.chips}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'warning' }) {
  return (
    <View style={[styles.badge, tone === 'warning' && styles.badgeWarning]}>
      <Text style={[styles.badgeText, tone === 'warning' && styles.badgeTextWarning]}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardTitle: { fontSize: 13, color: colors.muted, fontWeight: '600', textTransform: 'uppercase' },
  button: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: { minHeight: 56 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
  secondaryText: { color: colors.primary },
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.card,
  },
  inputInvalid: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextSelected: { color: colors.primaryText, fontWeight: '600' },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badgeWarning: { backgroundColor: '#FFF4E5', borderColor: colors.warning },
  badgeText: { fontSize: 11, color: colors.muted },
  badgeTextWarning: { color: colors.warning },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
});
