import { formatBRL, formatPrice, litersFrom, parseBRL, parsePriceMilli } from '../money';

describe('parseBRL', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234', 123400],
    ['0,5', 50],
    ['R$ 200,00', 20000],
    ['  12,3 ', 1230],
    ['1.234.567,89', 123456789],
  ])('parses %p as %p', (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(['', 'abc', '12,345', '1,2,3', '12.34', '-5,00', '1.23,00', ',50'])(
    'rejects %p',
    (input) => {
      expect(parseBRL(input)).toBeNull();
    },
  );
});

describe('formatBRL', () => {
  it.each([
    [123456, 'R$ 1.234,56'],
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [48730, 'R$ 487,30'],
    [123456789, 'R$ 1.234.567,89'],
    [-150, '-R$ 1,50'],
  ])('formats %p as %p', (cents, expected) => {
    expect(formatBRL(cents)).toBe(expected);
  });
});

describe('parsePriceMilli', () => {
  it.each([
    ['5,899', 5899],
    ['5,9', 5900],
    ['5', 5000],
    ['R$ 6,19', 6190],
  ])('parses %p as %p', (input, expected) => {
    expect(parsePriceMilli(input)).toBe(expected);
  });

  it.each(['5,8999', 'x', ''])('rejects %p', (input) => {
    expect(parsePriceMilli(input)).toBeNull();
  });
});

describe('formatPrice', () => {
  it.each([
    [5899, 'R$ 5,899'],
    [5000, 'R$ 5,000'],
    [12, 'R$ 0,012'],
  ])('formats %p as %p', (milli, expected) => {
    expect(formatPrice(milli)).toBe(expected);
  });
});

describe('litersFrom', () => {
  it('computes ml from total and price', () => {
    expect(litersFrom(20000, 5899)).toBe(33904);
  });

  it('rounds to the nearest ml', () => {
    expect(litersFrom(10000, 5899)).toBe(16952);
    expect(litersFrom(15000, 5899)).toBe(25428);
  });

  it('returns 0 for a non-positive price', () => {
    expect(litersFrom(10000, 0)).toBe(0);
  });
});
