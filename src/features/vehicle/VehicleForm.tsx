import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { Button, Chips, Field, Input } from '@/components/ui';
import { FUEL_LABELS } from '@/domain/format';
import { formatPlate, normalizePlate } from '@/domain/plate';
import { FUEL_TYPES, type FuelType } from '@/domain/types';
import type { VehicleRow } from '@/db/schema';
import { DomainError, type VehicleInput } from '@/repositories';
import { colors, spacing } from '@/theme';

const FUEL_OPTIONS = FUEL_TYPES.map((value) => ({ value, label: FUEL_LABELS[value] }));

const schema = z.object({
  nickname: z.string().trim().min(1, 'Informe um apelido'),
  plate: z
    .string()
    .refine((text) => !text.trim() || normalizePlate(text) !== null, 'Use ABC-1234 ou ABC1D23'),
  brand: z.string(),
  model: z.string(),
  year: z.string().refine((text) => {
    if (!text.trim()) return true;
    const year = Number(text);
    return Number.isInteger(year) && year >= 1900 && year <= 2100;
  }, 'Ano inválido'),
  defaultFuel: z.enum(FUEL_TYPES as [FuelType, ...FuelType[]]),
});

type Values = z.infer<typeof schema>;

export function vehicleFormValues(vehicle?: Partial<VehicleRow>): Values {
  return {
    nickname: vehicle?.nickname ?? '',
    plate: vehicle?.plate ? formatPlate(vehicle.plate) : '',
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year ? String(vehicle.year) : '',
    defaultFuel: vehicle?.defaultFuel ?? 'gasoline',
  };
}

function toInput(values: Values): VehicleInput {
  return {
    nickname: values.nickname,
    plate: values.plate,
    brand: values.brand,
    model: values.model,
    year: values.year.trim() ? Number(values.year) : null,
    defaultFuel: values.defaultFuel,
  };
}

export function VehicleForm({
  initialValues,
  submitLabel = 'Salvar',
  intro,
  onSubmit,
  children,
}: {
  initialValues: Values;
  submitLabel?: string;
  intro?: string;
  onSubmit: (input: VehicleInput) => Promise<unknown>;
  /** Ações extras abaixo do botão de salvar (arquivar, excluir...). */
  children?: ReactNode;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: initialValues, resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(toInput(values));
    } catch (error) {
      if (error instanceof DomainError && error.code === 'nickname_taken') {
        setError('nickname', { message: error.message });
      } else if (error instanceof DomainError && error.code === 'invalid_plate') {
        setError('plate', { message: error.message });
      } else {
        setFormError(error instanceof Error ? error.message : 'Não foi possível salvar');
      }
    }
  });

  const text = (
    name: 'nickname' | 'plate' | 'brand' | 'model' | 'year',
    label: string,
    props: Partial<React.ComponentProps<typeof Input>> = {},
  ) => (
    <Field label={label} error={errors[name]?.message}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            testID={`vehicle-${name}`}
            accessibilityLabel={label}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            invalid={Boolean(errors[name])}
            {...props}
          />
        )}
      />
    </Field>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      {text('nickname', 'Apelido', { placeholder: 'Ex.: Carro da família' })}
      {text('plate', 'Placa', { autoCapitalize: 'characters', placeholder: 'ABC-1234' })}
      {text('brand', 'Marca')}
      {text('model', 'Modelo')}
      {text('year', 'Ano', { keyboardType: 'number-pad', maxLength: 4 })}
      <Field label="Combustível padrão">
        <Controller
          control={control}
          name="defaultFuel"
          render={({ field }) => (
            <Chips<FuelType>
              accessibilityLabel="Combustível padrão"
              options={FUEL_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Field>
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <Button title={submitLabel} large onPress={submit} loading={isSubmitting} testID="save" />
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  intro: { fontSize: 15, color: colors.text },
  error: { color: colors.danger },
});
