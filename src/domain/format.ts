import type { FuelType } from './types';

export const FUEL_LABELS: Record<FuelType, string> = {
  gasoline: 'Gasolina',
  ethanol: 'Etanol',
  diesel: 'Diesel',
  cng: 'GNV',
};

/** GNV é medido em m³; os demais, em litros. */
export function volumeUnit(fuelType: FuelType): string {
  return fuelType === 'cng' ? 'm³' : 'L';
}

function formatDecimal(value: number, decimals: number): string {
  const [integer = '0', fraction] = Math.abs(value).toFixed(decimals).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 && Number(value.toFixed(decimals)) !== 0 ? '-' : '';
  return fraction ? `${sign}${grouped},${fraction}` : `${sign}${grouped}`;
}

/** 45230 -> "45.230 km" */
export function formatKm(km: number): string {
  return `${formatDecimal(km, 0)} km`;
}

/** 34580 -> "34,58 L" */
export function formatVolume(ml: number, fuelType: FuelType = 'gasoline'): string {
  return `${formatDecimal(ml / 1000, 2)} ${volumeUnit(fuelType)}`;
}

/** 11.43 -> "11,4 km/l" */
export function formatKmPerLiter(value: number, fuelType: FuelType = 'gasoline'): string {
  return `${formatDecimal(value, 1)} km/${fuelType === 'cng' ? 'm³' : 'l'}`;
}

/** Custo por km em centavos (fracionário) -> "R$ 0,47/km" */
export function formatCostPerKm(cents: number): string {
  return `R$ ${formatDecimal(cents / 100, 2)}/km`;
}

/** Mantém só os dígitos. */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

/**
 * Máscara que digita da direita para a esquerda: "5899" -> "5,899" (3 casas),
 * "20000" -> "200,00" (2 casas). Texto sem dígitos vira "".
 */
export function maskDecimalInput(text: string, decimals: number): string {
  const digits = digitsOnly(text)
    .replace(/^0+(?=\d)/, '')
    .slice(0, 12);
  if (!digits) return '';
  const value = Number(digits);
  return formatDecimal(value / 10 ** decimals, decimals);
}

/** "45230" -> "45.230" */
export function maskIntegerInput(text: string): string {
  const digits = digitsOnly(text)
    .replace(/^0+(?=\d)/, '')
    .slice(0, 9);
  return digits ? formatDecimal(Number(digits), 0) : '';
}

/** "23102026" -> "23/10/2026" */
export function maskDateInput(text: string): string {
  const digits = digitsOnly(text).slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

/** "23/10/2026" -> "2026-10-23"; null se incompleta. */
export function parseDateInput(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}
