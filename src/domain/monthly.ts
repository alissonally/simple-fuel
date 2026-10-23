import { monthOf } from './dates';
import type { Cycle, FuelingRecord, MonthlySummary } from './types';

/** Fechamento do mês (seção 2.3). Gasto pela data do abastecimento; consumo pelos ciclos. */
export function summarizeMonth(
  month: string,
  records: FuelingRecord[],
  cycles: Cycle[],
  vehicleId: string | 'all',
): MonthlySummary {
  const ofVehicle = <T extends { vehicleId: string }>(item: T) =>
    vehicleId === 'all' || item.vehicleId === vehicleId;

  const monthRecords = records.filter((r) => ofVehicle(r) && monthOf(r.date) === month);
  const monthCycles = cycles.filter(
    (c) => ofVehicle(c) && !c.excluded && monthOf(c.closedOn) === month,
  );

  const spentCents = monthRecords.reduce((sum, r) => sum + r.totalCents, 0);
  const litersMl = monthRecords.reduce((sum, r) => sum + r.litersMl, 0);
  const km = monthCycles.reduce((sum, c) => sum + c.km, 0);
  const cycleLitersMl = monthCycles.reduce((sum, c) => sum + c.litersMl, 0);
  const cycleCents = monthCycles.reduce((sum, c) => sum + c.totalCents, 0);

  // Consumo não é somado entre veículos.
  const perVehicle = vehicleId !== 'all' && km > 0 && cycleLitersMl > 0;

  return {
    month,
    vehicleId,
    spentCents,
    litersMl,
    fuelingCount: monthRecords.length,
    km,
    kmPerLiter: perVehicle ? km / (cycleLitersMl / 1000) : null,
    costPerKmCents: perVehicle ? cycleCents / km : null,
    avgPricePerLiterMilli: litersMl > 0 ? Math.round((spentCents * 10_000) / litersMl) : null,
    cyclesCount: monthCycles.length,
  };
}

export function summarizeRange(
  months: string[],
  records: FuelingRecord[],
  cycles: Cycle[],
  vehicleId: string | 'all',
): MonthlySummary[] {
  return months.map((month) => summarizeMonth(month, records, cycles, vehicleId));
}
