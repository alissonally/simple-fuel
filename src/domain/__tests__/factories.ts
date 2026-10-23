import { litersFrom } from '../money';
import type { FuelingRecord } from '../types';

let sequence = 0;

/** Abastecimento de teste. Litros são derivados de valor e preço, como no repositório. */
export function fueling(overrides: Partial<FuelingRecord> = {}): FuelingRecord {
  sequence += 1;
  const pricePerLiterMilli = overrides.pricePerLiterMilli ?? 5899;
  const totalCents = overrides.totalCents ?? 20000;
  return {
    id: `f${String(sequence).padStart(4, '0')}`,
    vehicleId: 'v1',
    segmentId: 's1',
    segmentSequence: 1,
    date: '2026-10-01',
    odometerKm: 10000,
    fullTank: true,
    fuelType: 'gasoline',
    excludeFromAverage: false,
    ...overrides,
    pricePerLiterMilli,
    totalCents,
    litersMl: overrides.litersMl ?? litersFrom(totalCents, pricePerLiterMilli),
  };
}
