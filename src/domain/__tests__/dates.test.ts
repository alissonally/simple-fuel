import {
  addMonths,
  formatDate,
  formatMonth,
  isValidISODate,
  lastMonths,
  monthName,
  monthOf,
  toISODate,
} from '../dates';

describe('dates', () => {
  it('formats a local Date as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it.each([
    ['2026-10-23', true],
    ['2024-02-29', true],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['23/10/2026', false],
  ])('validates %p as %p', (value, expected) => {
    expect(isValidISODate(value)).toBe(expected);
  });

  it('extracts the month', () => {
    expect(monthOf('2026-10-23')).toBe('2026-10');
  });

  it.each([
    ['2026-10', 1, '2026-11'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-03', -14, '2025-01'],
  ])('addMonths(%p, %p) = %p', (month, delta, expected) => {
    expect(addMonths(month, delta)).toBe(expected);
  });

  it('lists the last months in ascending order', () => {
    expect(lastMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('formats dates and months in pt-BR', () => {
    expect(formatDate('2026-10-03')).toBe('03/10/2026');
    expect(formatMonth('2026-10')).toBe('Outubro 2026');
    expect(monthName('2026-03')).toBe('Março');
  });
});
