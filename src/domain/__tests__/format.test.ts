import {
  digitsOnly,
  FUEL_LABELS,
  formatCostPerKm,
  formatKm,
  formatKmPerLiter,
  formatVolume,
  maskDateInput,
  maskDecimalInput,
  maskIntegerInput,
  parseDateInput,
  volumeUnit,
} from '../format';
import { FUEL_TYPES } from '../types';

describe('format', () => {
  it('labels every fuel type in pt-BR', () => {
    expect(FUEL_TYPES.map((fuel) => FUEL_LABELS[fuel])).toEqual([
      'Gasolina',
      'Etanol',
      'Diesel',
      'GNV',
    ]);
    expect(volumeUnit('cng')).toBe('m³');
    expect(volumeUnit('diesel')).toBe('L');
  });

  it.each([
    [45230, '45.230 km'],
    [0, '0 km'],
    [1234567, '1.234.567 km'],
  ])('formatKm(%p) = %p', (km, expected) => {
    expect(formatKm(km)).toBe(expected);
  });

  it('formats volumes', () => {
    expect(formatVolume(34580)).toBe('34,58 L');
    expect(formatVolume(33904)).toBe('33,90 L');
    expect(formatVolume(12345, 'cng')).toBe('12,35 m³');
  });

  it('formats consumption and cost per km', () => {
    expect(formatKmPerLiter(11.43)).toBe('11,4 km/l');
    expect(formatKmPerLiter(10.618)).toBe('10,6 km/l');
    expect(formatKmPerLiter(13.2, 'cng')).toBe('13,2 km/m³');
    expect(formatCostPerKm(55.555)).toBe('R$ 0,56/km');
    expect(formatCostPerKm(-1)).toBe('R$ -0,01/km');
  });

  it('keeps only digits', () => {
    expect(digitsOnly('R$ 1.234,5a')).toBe('12345');
  });

  it.each([
    ['', 2, ''],
    ['abc', 2, ''],
    ['5', 2, '0,05'],
    ['20000', 2, '200,00'],
    ['200,005', 2, '2.000,05'],
    ['0005899', 3, '5,899'],
    ['5899', 3, '5,899'],
  ])('maskDecimalInput(%p, %p) = %p', (text, decimals, expected) => {
    expect(maskDecimalInput(text, decimals)).toBe(expected);
  });

  it('masks integers and dates', () => {
    expect(maskIntegerInput('045230')).toBe('45.230');
    expect(maskIntegerInput('x')).toBe('');
    expect(maskDateInput('2310')).toBe('23/10');
    expect(maskDateInput('23102026999')).toBe('23/10/2026');
  });

  it('parses DD/MM/AAAA', () => {
    expect(parseDateInput('23/10/2026')).toBe('2026-10-23');
    expect(parseDateInput('23/10/26')).toBeNull();
  });
});
