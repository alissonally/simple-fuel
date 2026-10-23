import { z } from 'zod';

import { formatDate, toISODate } from '@/domain/dates';
import { digitsOnly, maskDecimalInput, maskIntegerInput, parseDateInput } from '@/domain/format';
import { FUEL_TYPES, type FuelType } from '@/domain/types';
import type { FuelingField, ValidationIssue } from '@/domain/validation';
import type { Fueling, FuelingDraft, FuelingInput } from '@/repositories';

/** Valores do formulário como o usuário os vê (máscaras pt-BR). */
export interface FuelingFormValues {
  vehicleId: string;
  odometer: string; // "45.230"
  price: string; // "5,899"
  total: string; // "200,00"
  fullTank: boolean;
  fuelType: FuelType;
  date: string; // DD/MM/AAAA
  station: string;
  notes: string;
}

const FIELD_OF: Record<FuelingField, keyof FuelingFormValues> = {
  vehicleId: 'vehicleId',
  date: 'date',
  odometerKm: 'odometer',
  pricePerLiterMilli: 'price',
  totalCents: 'total',
  fuelType: 'fuelType',
};

const numberOrNull = (text: string) => {
  const digits = digitsOnly(text);
  return digits ? Number(digits) : null;
};

/**
 * Converte os valores mascarados. Os dígitos de "5,899" já são milésimos e os de
 * "200,00" já são centavos.
 */
export function toFuelingDraft(
  values: FuelingFormValues,
): FuelingDraft & { fullTank: boolean; station: string; notes: string } {
  return {
    vehicleId: values.vehicleId,
    date: parseDateInput(values.date) ?? '',
    odometerKm: numberOrNull(values.odometer),
    pricePerLiterMilli: numberOrNull(values.price),
    totalCents: numberOrNull(values.total),
    fullTank: values.fullTank,
    fuelType: values.fuelType,
    station: values.station,
    notes: values.notes,
  };
}

/** Entrada completa, para depois que o resolver aprovou o formulário. */
export function toFuelingInput(values: FuelingFormValues): FuelingInput {
  const { odometerKm, pricePerLiterMilli, totalCents, ...draft } = toFuelingDraft(values);
  if (odometerKm == null || pricePerLiterMilli == null || totalCents == null) {
    throw new Error('Fueling form submitted with empty numeric fields');
  }
  return {
    ...draft,
    date: draft.date ?? '',
    odometerKm,
    pricePerLiterMilli,
    totalCents,
    fuelType: values.fuelType,
  };
}

export function fromFueling(fueling: Fueling): FuelingFormValues {
  return {
    vehicleId: fueling.vehicleId,
    odometer: maskIntegerInput(String(fueling.odometerKm)),
    price: maskDecimalInput(String(fueling.pricePerLiterMilli), 3),
    total: maskDecimalInput(String(fueling.totalCents), 2),
    fullTank: fueling.fullTank,
    fuelType: fueling.fuelType,
    date: formatDate(fueling.date),
    station: fueling.station ?? '',
    notes: fueling.notes ?? '',
  };
}

export function emptyValues({
  vehicleId,
  fuelType,
  priceMilli,
  today = new Date(),
}: {
  vehicleId: string;
  fuelType: FuelType;
  priceMilli: number | null;
  today?: Date;
}): FuelingFormValues {
  return {
    vehicleId,
    odometer: '',
    price: priceMilli ? maskDecimalInput(String(priceMilli), 3) : '',
    total: '',
    fullTank: true,
    fuelType,
    date: formatDate(toISODate(today)),
    station: '',
    notes: '',
  };
}

/**
 * Schema do formulário. A estrutura é checada pelo zod e as regras de negócio vêm
 * de `validation.ts` (via `check`), para que formulário e repositório concordem.
 */
export function fuelingFormSchema(check: (input: FuelingDraft) => ValidationIssue[]) {
  return z
    .object({
      vehicleId: z.string().min(1, 'Campo obrigatório'),
      odometer: z.string(),
      price: z.string(),
      total: z.string(),
      fullTank: z.boolean(),
      fuelType: z.enum(FUEL_TYPES as [FuelType, ...FuelType[]]),
      date: z.string().refine((text) => parseDateInput(text) !== null, 'Use o formato DD/MM/AAAA'),
      station: z.string(),
      notes: z.string(),
    })
    .superRefine((values, zodCtx) => {
      if (!parseDateInput(values.date)) return;
      for (const issue of check(toFuelingDraft(values))) {
        if (issue.level !== 'error') continue;
        zodCtx.addIssue({ code: 'custom', path: [FIELD_OF[issue.field]], message: issue.message });
      }
    });
}
