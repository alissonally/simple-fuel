import { buildCycles } from '../cycles';
import {
  hasErrors,
  postSaveNotice,
  validateFueling,
  warningsOf,
  type FuelingInput,
  type ValidationContext,
} from '../validation';
import { fueling } from './factories';

const valid: FuelingInput = {
  vehicleId: 'v1',
  date: '2026-10-20',
  odometerKm: 10450,
  pricePerLiterMilli: 5899,
  totalCents: 15000,
  fuelType: 'gasoline',
};

const ctx: ValidationContext = {
  today: '2026-10-23',
  segmentStartedOn: '2026-01-01',
  segmentFuelings: [
    { id: 'a', date: '2026-10-01', odometerKm: 10000 },
    { id: 'b', date: '2026-10-10', odometerKm: 10200 },
  ],
};

const codes = (input: FuelingInput, context: ValidationContext = ctx) =>
  validateFueling(input, context).map((i) => `${i.level}:${i.code}:${i.field}`);

describe('validateFueling', () => {
  it('accepts a valid record', () => {
    expect(validateFueling(valid, ctx)).toEqual([]);
  });

  describe('required field empty or value ≤ 0 → error', () => {
    it.each([
      ['vehicleId', null, 'error:required:vehicleId'],
      ['fuelType', null, 'error:required:fuelType'],
      ['date', '', 'error:required:date'],
      ['odometerKm', null, 'error:required:odometerKm'],
      ['odometerKm', Number.NaN, 'error:required:odometerKm'],
      ['odometerKm', 0, 'error:not_positive:odometerKm'],
      ['pricePerLiterMilli', undefined, 'error:required:pricePerLiterMilli'],
      ['pricePerLiterMilli', -1, 'error:not_positive:pricePerLiterMilli'],
      ['totalCents', 0, 'error:not_positive:totalCents'],
    ])('%s = %p', (field, value, expected) => {
      expect(codes({ ...valid, [field]: value })).toEqual([expected]);
    });

    it('rejects a fractional odometer', () => {
      expect(codes({ ...valid, odometerKm: 10450.5 })).toEqual(['error:not_integer:odometerKm']);
    });

    it('rejects an invalid date', () => {
      expect(codes({ ...valid, date: '2026-02-30' })).toEqual(['error:invalid_date:date']);
    });
  });

  it('future date → error', () => {
    const issues = validateFueling({ ...valid, date: '2026-10-24' }, ctx);
    expect(issues).toEqual([expect.objectContaining({ level: 'error', code: 'future_date' })]);
    expect(issues[0]?.message).toBe('A data não pode ser futura');
  });

  it('accepts today', () => {
    expect(validateFueling({ ...valid, date: '2026-10-23' }, ctx)).toEqual([]);
  });

  it('odometer equal to another active record in the segment → error', () => {
    const issues = validateFueling({ ...valid, odometerKm: 10200 }, ctx);
    expect(issues).toEqual([
      expect.objectContaining({ level: 'error', code: 'duplicate_odometer' }),
    ]);
    expect(issues[0]?.message).toBe('Já existe um abastecimento com esse odômetro');
  });

  it('editing a record keeps its own odometer valid', () => {
    expect(
      validateFueling(
        { ...valid, odometerKm: 10200, date: '2026-10-10' },
        { ...ctx, editingId: 'b' },
      ),
    ).toEqual([]);
  });

  describe('odometer incoherent with the date → error with neighbors', () => {
    it('previous neighbor by odometer has a later date', () => {
      const issues = validateFueling({ ...valid, odometerKm: 10300, date: '2026-10-05' }, ctx);
      expect(issues).toEqual([
        expect.objectContaining({
          level: 'error',
          code: 'odometer_date_mismatch',
          neighbors: [{ id: 'b', date: '2026-10-10', odometerKm: 10200 }],
        }),
      ]);
    });

    it('next neighbor by odometer has an earlier date', () => {
      const issues = validateFueling({ ...valid, odometerKm: 10100, date: '2026-10-15' }, ctx);
      expect(issues[0]).toMatchObject({
        code: 'odometer_date_mismatch',
        neighbors: [
          { id: 'a', odometerKm: 10000 },
          { id: 'b', odometerKm: 10200 },
        ],
      });
    });
  });

  it('lower odometer with a coherent date (retroactive record) → allowed', () => {
    expect(validateFueling({ ...valid, odometerKm: 10100, date: '2026-10-05' }, ctx)).toEqual([]);
  });

  it('date before the current segment start → error', () => {
    const issues = validateFueling(valid, { ...ctx, segmentStartedOn: '2026-10-21' });
    expect(issues).toEqual([
      expect.objectContaining({
        level: 'error',
        code: 'before_segment_start',
        message: 'Essa data pertence a um odômetro anterior ao reinício',
      }),
    ]);
  });

  it.each([
    [1999, true],
    [2000, false],
    [15000, false],
    [15001, true],
  ])('price per liter %p milli outside R$ 2,000–15,000 → warning: %p', (price, warns) => {
    const issues = validateFueling({ ...valid, pricePerLiterMilli: price, totalCents: 10000 }, ctx);
    expect(issues.some((i) => i.level === 'warning' && i.code === 'price_out_of_range')).toBe(
      warns,
    );
  });

  it('liters above 120 L → warning', () => {
    const issues = validateFueling({ ...valid, totalCents: 71000 }, ctx); // ≈ 120,36 L
    expect(issues).toEqual([
      expect.objectContaining({
        level: 'warning',
        code: 'liters_too_high',
        message: 'Volume acima do comum para um tanque',
      }),
    ]);
    expect(codes({ ...valid, totalCents: 70700 })).toEqual([]); // ≈ 119,85 L
  });

  it('odometer jump above 2.000 km → warning', () => {
    expect(codes({ ...valid, odometerKm: 12201 })).toEqual(['warning:odometer_jump:odometerKm']);
    expect(codes({ ...valid, odometerKm: 12200 })).toEqual([]);
  });

  it('separates errors from warnings', () => {
    const issues = validateFueling({ ...valid, odometerKm: 12201, totalCents: 0 }, ctx);
    expect(hasErrors(issues)).toBe(true);
    expect(warningsOf(issues).map((i) => i.code)).toEqual(['odometer_jump']);
    expect(hasErrors(warningsOf(issues))).toBe(false);
  });
});

describe('postSaveNotice (closed cycle with outlier consumption → post-save warning)', () => {
  const regular = Array.from({ length: 4 }, (_, i) =>
    fueling({ odometerKm: 10000 + i * 400, totalCents: 20000 }),
  );

  it('returns null when the record does not close a cycle', () => {
    const partial = fueling({ odometerKm: 11300, fullTank: false });
    expect(postSaveNotice(partial.id, buildCycles([...regular, partial]))).toBeNull();
  });

  it('returns the closed cycle without outlier flag for a regular consumption', () => {
    const last = regular[3];
    const notice = postSaveNotice(last?.id ?? '', buildCycles(regular));
    expect(notice).toMatchObject({ outlier: false, cycle: { km: 400 } });
  });

  it('flags an outlier so the UI can offer "Ignorar este ciclo na média"', () => {
    const odd = fueling({ odometerKm: 12800, totalCents: 20000 });
    expect(postSaveNotice(odd.id, buildCycles([...regular, odd]))?.outlier).toBe(true);
  });

  it('does not flag an already ignored cycle', () => {
    const odd = fueling({ odometerKm: 12800, totalCents: 20000, excludeFromAverage: true });
    expect(postSaveNotice(odd.id, buildCycles([...regular, odd]))?.outlier).toBe(false);
  });
});
