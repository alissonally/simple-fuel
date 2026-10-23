import { createFueling, listVehicles, type FuelingInput } from '@/repositories';

import type { TestContext } from './db';

/** Registros do roteiro manual (seção 9): cheio, parcial, cheio. */
export function seedFuelings(ctx: TestContext, count = 3, vehicleId?: string) {
  const id = vehicleId ?? listVehicles(ctx)[0]?.id ?? '';
  const rows: Omit<FuelingInput, 'vehicleId' | 'pricePerLiterMilli' | 'fuelType'>[] = [
    { date: '2026-10-01', odometerKm: 10000, totalCents: 20000, fullTank: true },
    { date: '2026-10-05', odometerKm: 10200, totalCents: 10000, fullTank: false },
    { date: '2026-10-10', odometerKm: 10450, totalCents: 15000, fullTank: true },
    { date: '2026-10-15', odometerKm: 10850, totalCents: 20000, fullTank: true },
  ];
  return rows
    .slice(0, count)
    .map((row) =>
      createFueling(ctx, { ...row, vehicleId: id, pricePerLiterMilli: 5899, fuelType: 'gasoline' }),
    );
}
