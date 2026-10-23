import type { Cycle, FuelingRecord, FuelType } from './types';

const OUTLIER_MIN_REFERENCES = 3;
const OUTLIER_MAX_DEVIATION = 0.4;

function compareRecords(a: FuelingRecord, b: FuelingRecord): number {
  return (
    a.segmentSequence - b.segmentSequence ||
    a.odometerKm - b.odometerKm ||
    a.date.localeCompare(b.date) ||
    a.id.localeCompare(b.id)
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + upper) / 2 : upper;
}

function singleFuel(cycle: Cycle): FuelType | null {
  return cycle.mixed ? null : (cycle.fuelTypes[0] ?? null);
}

/** Ciclos fechados de um veículo, sem a marcação de outlier. */
function closeCycles(records: FuelingRecord[]): Cycle[] {
  const cycles: Cycle[] = [];
  let opening: FuelingRecord | null = null;
  let segmentId: string | null = null;
  let litersMl = 0;
  let totalCents = 0;
  let fuelTypes: FuelType[] = [];

  for (const record of [...records].sort(compareRecords)) {
    if (record.segmentId !== segmentId) {
      // Nenhum ciclo cruza um reinício de odômetro.
      segmentId = record.segmentId;
      opening = null;
    }

    if (opening) {
      litersMl += record.litersMl;
      totalCents += record.totalCents;
      if (!fuelTypes.includes(record.fuelType)) fuelTypes.push(record.fuelType);
    }

    if (!record.fullTank) continue;

    if (opening) {
      const km = record.odometerKm - opening.odometerKm;
      if (km > 0 && litersMl > 0) {
        cycles.push({
          vehicleId: record.vehicleId,
          openingFuelingId: opening.id,
          closingFuelingId: record.id,
          closedOn: record.date,
          km,
          litersMl,
          totalCents,
          kmPerLiter: km / (litersMl / 1000),
          costPerKmCents: totalCents / km,
          fuelTypes,
          mixed: fuelTypes.length > 1,
          excluded: record.excludeFromAverage,
          outlier: false,
        });
      }
    }

    opening = record;
    litersMl = 0;
    totalCents = 0;
    fuelTypes = [];
  }

  return cycles;
}

/**
 * Marca como outlier o ciclo cujo consumo desvia mais de 40% da mediana dos
 * demais ciclos válidos (mesmo combustível único, não excluídos).
 */
function markOutliers(cycles: Cycle[]): Cycle[] {
  return cycles.map((cycle) => {
    const fuel = singleFuel(cycle);
    if (!fuel) return cycle;
    const references = cycles
      .filter((other) => other !== cycle && !other.excluded && singleFuel(other) === fuel)
      .map((other) => other.kmPerLiter);
    if (references.length < OUTLIER_MIN_REFERENCES) return cycle;
    const reference = median(references);
    const deviation = Math.abs(cycle.kmPerLiter - reference) / reference;
    return { ...cycle, outlier: deviation > OUTLIER_MAX_DEVIATION };
  });
}

/**
 * Ciclos de consumo pelo método do tanque cheio (seções 2.2 e 5).
 * Aceita registros de vários veículos; cada veículo é processado à parte.
 */
export function buildCycles(records: FuelingRecord[]): Cycle[] {
  const byVehicle = new Map<string, FuelingRecord[]>();
  for (const record of records) {
    const list = byVehicle.get(record.vehicleId) ?? [];
    list.push(record);
    byVehicle.set(record.vehicleId, list);
  }
  return [...byVehicle.values()].flatMap((list) => markOutliers(closeCycles(list)));
}

export interface ConsumptionAverages {
  /** km/l de todos os ciclos não ignorados (inclui mistos). */
  overall: number | null;
  /** km/l por combustível, só com ciclos de combustível único. */
  byFuel: { fuelType: FuelType; kmPerLiter: number; cycles: number }[];
  validCycles: number;
}

/** Média ponderada (soma de km ÷ soma de litros) dos ciclos válidos. */
export function averageConsumption(cycles: Cycle[]): ConsumptionAverages {
  const valid = cycles.filter((c) => !c.excluded);
  const ratio = (list: Cycle[]) => {
    const km = list.reduce((sum, c) => sum + c.km, 0);
    const ml = list.reduce((sum, c) => sum + c.litersMl, 0);
    return ml > 0 ? km / (ml / 1000) : null;
  };

  const groups = new Map<FuelType, Cycle[]>();
  for (const cycle of valid) {
    const fuel = singleFuel(cycle);
    if (fuel) groups.set(fuel, [...(groups.get(fuel) ?? []), cycle]);
  }

  return {
    overall: ratio(valid),
    byFuel: [...groups.entries()].map(([fuelType, list]) => ({
      fuelType,
      kmPerLiter: ratio(list) ?? 0,
      cycles: list.length,
    })),
    validCycles: valid.length,
  };
}
