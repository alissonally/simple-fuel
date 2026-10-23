export type FuelType = 'gasoline' | 'ethanol' | 'diesel' | 'cng';

export const FUEL_TYPES: readonly FuelType[] = ['gasoline', 'ethanol', 'diesel', 'cng'];

export interface FuelingRecord {
  id: string;
  vehicleId: string;
  segmentId: string;
  segmentSequence: number;
  date: string; // YYYY-MM-DD
  odometerKm: number;
  pricePerLiterMilli: number;
  totalCents: number;
  litersMl: number;
  fullTank: boolean;
  fuelType: FuelType;
  excludeFromAverage: boolean;
}

export interface Cycle {
  vehicleId: string;
  openingFuelingId: string;
  closingFuelingId: string;
  closedOn: string; // data do cheio que fecha
  km: number;
  litersMl: number;
  totalCents: number;
  kmPerLiter: number; // km / (litersMl/1000)
  costPerKmCents: number; // totalCents / km
  fuelTypes: FuelType[];
  mixed: boolean;
  excluded: boolean;
  outlier: boolean; // ver seção 7
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  vehicleId: string | 'all';
  spentCents: number;
  litersMl: number;
  fuelingCount: number;
  km: number;
  kmPerLiter: number | null; // null = sem ciclos válidos
  costPerKmCents: number | null;
  avgPricePerLiterMilli: number | null;
  cyclesCount: number;
}
