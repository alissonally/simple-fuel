import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { FormScrollView } from '@/components/FormScrollView';
import { Button, Chips, Field, Input } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { buildCycles } from '@/domain/cycles';
import {
  digitsOnly,
  FUEL_LABELS,
  formatKm,
  formatKmPerLiter,
  formatVolume,
  maskDateInput,
  maskDecimalInput,
  maskIntegerInput,
} from '@/domain/format';
import { litersFrom } from '@/domain/money';
import { parseFuelingText } from '@/domain/parseFuelingText';
import { FUEL_TYPES, type FuelType } from '@/domain/types';
import { postSaveNotice, warningsOf, type ValidationIssue } from '@/domain/validation';
import type { VehicleRow } from '@/db/schema';
import { invalidateFuelingData, useLastFueling, useRepo } from '@/hooks';
import {
  checkFueling,
  FuelingValidationError,
  lastPriceMilli,
  listFuelings,
  setExcludeFromAverage,
  type Fueling,
  type FuelingInput,
  type SaveOptions,
} from '@/repositories';
import { colors, spacing } from '@/theme';

import {
  fuelingFormSchema,
  parsedToFormValues,
  toFuelingInput,
  type FuelingFormValues,
} from './formSchema';
import { QuickEntry } from './QuickEntry';

const FUEL_OPTIONS = FUEL_TYPES.map((value) => ({ value, label: FUEL_LABELS[value] }));

/** Nomes dos campos na mensagem do preenchimento por texto, na ordem da tela. */
const QUICK_ENTRY_LABELS: [keyof FuelingFormValues, string][] = [
  ['odometer', 'odômetro'],
  ['price', 'preço'],
  ['total', 'valor'],
  ['fullTank', 'tanque'],
  ['fuelType', 'combustível'],
  ['date', 'data'],
  ['station', 'posto'],
];

export interface FuelingFormProps {
  initialValues: FuelingFormValues;
  /** Veículos que podem ser escolhidos. O seletor só aparece com 2 ou mais. */
  vehicles: VehicleRow[];
  editingId?: string;
  onSave: (input: FuelingInput, options: SaveOptions) => Promise<Fueling>;
  onDelete?: () => void;
  onDone: () => void;
}

function confirmWarnings(warnings: ValidationIssue[]): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Confira antes de salvar',
      warnings.map((w) => `• ${w.message}`).join('\n'),
      [
        { text: 'Revisar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Salvar mesmo assim', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function FuelingForm({
  initialValues,
  vehicles,
  editingId,
  onSave,
  onDelete,
  onDone,
}: FuelingFormProps) {
  const ctx = useRepo();
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [showDetails, setShowDetails] = useState(
    Boolean(initialValues.station || initialValues.notes),
  );

  const resolver = useMemo(
    () => zodResolver(fuelingFormSchema((draft) => checkFueling(ctx, draft, editingId))),
    [ctx, editingId],
  );
  const {
    control,
    handleSubmit,
    setValue,
    clearErrors,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<FuelingFormValues>({ defaultValues: initialValues, resolver });

  const [vehicleId, fuelType, price, total] = useWatch({
    control,
    name: ['vehicleId', 'fuelType', 'price', 'total'],
  });
  const lastFueling = useLastFueling(vehicleId).data;

  // Preço padrão: último preço do mesmo combustível, enquanto o usuário não editar.
  useEffect(() => {
    if (editingId || getFieldState('price').isDirty) return;
    const milli = lastPriceMilli(ctx, fuelType);
    setValue('price', milli ? maskDecimalInput(String(milli), 3) : '');
  }, [ctx, editingId, fuelType, getFieldState, setValue]);

  const estimatedMl = useMemo(() => {
    const priceMilli = Number(digitsOnly(price));
    const totalCents = Number(digitsOnly(total));
    return priceMilli > 0 && totalCents > 0 ? litersFrom(totalCents, priceMilli) : null;
  }, [price, total]);

  const applyText = (text: string): string[] => {
    const values = parsedToFormValues(parseFuelingText(text, ctx.today()));
    const filled = QUICK_ENTRY_LABELS.filter(([name]) => values[name] !== undefined);
    // Campos preenchidos contam como editados (o preço sugerido não os sobrescreve).
    const dirty = { shouldDirty: true };
    if (values.odometer !== undefined) setValue('odometer', values.odometer, dirty);
    if (values.price !== undefined) setValue('price', values.price, dirty);
    if (values.total !== undefined) setValue('total', values.total, dirty);
    if (values.fullTank !== undefined) setValue('fullTank', values.fullTank, dirty);
    if (values.fuelType !== undefined) setValue('fuelType', values.fuelType, dirty);
    if (values.date !== undefined) setValue('date', values.date, dirty);
    if (values.station !== undefined) setValue('station', values.station, dirty);
    clearErrors(filled.map(([name]) => name));
    if (values.station) setShowDetails(true);
    return filled.map(([, label]) => label);
  };

  const announceCycle = (saved: Fueling) => {
    const notice = postSaveNotice(saved.id, buildCycles(listFuelings(ctx, saved.vehicleId)));
    if (!notice) return;
    const consumption = `Consumo: ${formatKmPerLiter(notice.cycle.kmPerLiter, saved.fuelType)}`;
    showToast({
      message: notice.outlier ? `${consumption} (fora do padrão)` : consumption,
      action: notice.outlier
        ? {
            label: 'Ignorar este ciclo na média',
            onPress: () => {
              setExcludeFromAverage(ctx, saved.id, true);
              void invalidateFuelingData(queryClient);
            },
          }
        : undefined,
    });
  };

  const submit = handleSubmit(async (values) => {
    const input = toFuelingInput(values);
    const warnings = warningsOf(checkFueling(ctx, input, editingId));
    if (warnings.length > 0 && !(await confirmWarnings(warnings))) return;
    try {
      const saved = await onSave(input, { confirmWarnings: warnings.length > 0 });
      announceCycle(saved);
      onDone();
    } catch (error) {
      const message =
        error instanceof FuelingValidationError || error instanceof Error
          ? error.message
          : 'Não foi possível salvar';
      Alert.alert('Não foi possível salvar', message);
    }
  });

  const confirmDelete = () => {
    Alert.alert('Excluir abastecimento?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: onDelete },
    ]);
  };

  const vehicleOptions = vehicles.map((v) => ({ value: v.id, label: v.nickname }));

  return (
    <FormScrollView contentContainerStyle={styles.container}>
      {editingId ? null : <QuickEntry onApply={applyText} />}

      {vehicles.length > 1 ? (
        <Field label="Veículo" error={errors.vehicleId?.message}>
          <Controller
            control={control}
            name="vehicleId"
            render={({ field }) => (
              <Chips
                accessibilityLabel="Veículo"
                options={vehicleOptions}
                value={field.value}
                onChange={(id) => {
                  field.onChange(id);
                  const vehicle = vehicles.find((v) => v.id === id);
                  if (vehicle && !getFieldState('fuelType').isDirty) {
                    setValue('fuelType', vehicle.defaultFuel);
                  }
                }}
              />
            )}
          />
        </Field>
      ) : null}

      <Field
        label="Odômetro (km)"
        error={errors.odometer?.message}
        hint={lastFueling ? `Último registro: ${formatKm(lastFueling.odometerKm)}` : null}
      >
        <Controller
          control={control}
          name="odometer"
          render={({ field }) => (
            <Input
              testID="odometer"
              accessibilityLabel="Odômetro"
              keyboardType="number-pad"
              placeholder="0"
              value={field.value}
              onChangeText={(text) => field.onChange(maskIntegerInput(text))}
              onBlur={field.onBlur}
              invalid={Boolean(errors.odometer)}
            />
          )}
        />
      </Field>

      <Field label="Preço por litro (R$)" error={errors.price?.message}>
        <Controller
          control={control}
          name="price"
          render={({ field }) => (
            <Input
              testID="price"
              accessibilityLabel="Preço por litro"
              keyboardType="number-pad"
              placeholder="0,000"
              value={field.value}
              onChangeText={(text) => field.onChange(maskDecimalInput(text, 3))}
              onBlur={field.onBlur}
              invalid={Boolean(errors.price)}
            />
          )}
        />
      </Field>

      <Field
        label="Valor total (R$)"
        error={errors.total?.message}
        hint={estimatedMl !== null ? `≈ ${formatVolume(estimatedMl, fuelType)}` : null}
      >
        <Controller
          control={control}
          name="total"
          render={({ field }) => (
            <Input
              testID="total"
              accessibilityLabel="Valor total"
              keyboardType="number-pad"
              placeholder="0,00"
              value={field.value}
              onChangeText={(text) => field.onChange(maskDecimalInput(text, 2))}
              onBlur={field.onBlur}
              invalid={Boolean(errors.total)}
            />
          )}
        />
      </Field>

      <Controller
        control={control}
        name="fullTank"
        render={({ field }) => (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Tanque cheio</Text>
            <Switch
              accessibilityLabel="Tanque cheio"
              value={field.value}
              onValueChange={field.onChange}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        )}
      />

      <Field label="Combustível" error={errors.fuelType?.message}>
        <Controller
          control={control}
          name="fuelType"
          render={({ field }) => (
            <Chips<FuelType>
              accessibilityLabel="Combustível"
              options={FUEL_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Field>

      <Field label="Data" error={errors.date?.message}>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <Input
              testID="date"
              accessibilityLabel="Data"
              keyboardType="number-pad"
              placeholder="DD/MM/AAAA"
              value={field.value}
              onChangeText={(text) => field.onChange(maskDateInput(text))}
              onBlur={field.onBlur}
              invalid={Boolean(errors.date)}
            />
          )}
        />
      </Field>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showDetails }}
        onPress={() => setShowDetails((open) => !open)}
      >
        <Text style={styles.toggle}>{showDetails ? '▾ Mais detalhes' : '▸ Mais detalhes'}</Text>
      </Pressable>
      {showDetails ? (
        <>
          <Field label="Posto">
            <Controller
              control={control}
              name="station"
              render={({ field }) => (
                <Input
                  accessibilityLabel="Posto"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field label="Observações">
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <Input
                  accessibilityLabel="Observações"
                  multiline
                  style={styles.notes}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        </>
      ) : null}

      <Button title="Salvar" large onPress={submit} loading={isSubmitting} testID="save" />
      {onDelete ? <Button title="Excluir" variant="danger" onPress={confirmDelete} /> : null}
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  toggle: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  notes: { minHeight: 80, textAlignVertical: 'top' },
});
