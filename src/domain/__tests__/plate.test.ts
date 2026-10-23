import { formatPlate, normalizePlate } from '../plate';

describe('normalizePlate', () => {
  it.each([
    ['ABC1234', 'ABC1234'],
    ['abc-1234', 'ABC1234'],
    ['ABC1D23', 'ABC1D23'],
    ['abc1d23', 'ABC1D23'],
    ['abc-1d23', 'ABC1D23'],
    [' abc 1d23 ', 'ABC1D23'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizePlate(input)).toBe(expected);
  });

  it.each(['', 'AB1234', 'ABCD123', 'ABC12345', '1BC1234', 'ABC1DD3', 'ABÇ1234'])(
    'rejects %p',
    (input) => {
      expect(normalizePlate(input)).toBeNull();
    },
  );
});

describe('formatPlate', () => {
  it('adds a hyphen to the old format', () => {
    expect(formatPlate('ABC1234')).toBe('ABC-1234');
  });

  it('keeps Mercosul plates as is', () => {
    expect(formatPlate('ABC1D23')).toBe('ABC1D23');
  });
});
