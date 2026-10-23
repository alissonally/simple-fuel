import { buildCycles } from '../cycles';
import { summarizeMonth, summarizeRange } from '../monthly';
import { fueling } from './factories';

describe('summarizeMonth', () => {
  const records = [
    fueling({ odometerKm: 10000, date: '2026-09-20', totalCents: 20000 }),
    fueling({ odometerKm: 10200, date: '2026-09-28', totalCents: 10000, fullTank: false }),
    fueling({ odometerKm: 10450, date: '2026-10-05', totalCents: 15000 }),
  ];
  const cycles = buildCycles(records);

  it('counts a cycle opened in September and closed in October in October', () => {
    const october = summarizeMonth('2026-10', records, cycles, 'v1');
    expect(october).toMatchObject({
      month: '2026-10',
      vehicleId: 'v1',
      spentCents: 15000,
      litersMl: 25428,
      fuelingCount: 1,
      km: 450,
      cyclesCount: 1,
    });
    expect(october.kmPerLiter).toBeCloseTo(450 / 42.38, 6);
    expect(october.costPerKmCents).toBeCloseTo(25000 / 450, 6);
    expect(october.avgPricePerLiterMilli).toBe(5899);
  });

  it('returns null consumption for a month without closed cycles, with spending filled', () => {
    const september = summarizeMonth('2026-09', records, cycles, 'v1');
    expect(september).toMatchObject({
      spentCents: 30000,
      fuelingCount: 2,
      km: 0,
      kmPerLiter: null,
      costPerKmCents: null,
      cyclesCount: 0,
    });
  });

  it('returns an empty summary for a month without records', () => {
    expect(summarizeMonth('2026-08', records, cycles, 'v1')).toEqual({
      month: '2026-08',
      vehicleId: 'v1',
      spentCents: 0,
      litersMl: 0,
      fuelingCount: 0,
      km: 0,
      kmPerLiter: null,
      costPerKmCents: null,
      avgPricePerLiterMilli: null,
      cyclesCount: 0,
    });
  });

  it('leaves ignored cycles out of km and consumption', () => {
    const ignored = records.map((r, i) => (i === 2 ? { ...r, excludeFromAverage: true } : r));
    const october = summarizeMonth('2026-10', ignored, buildCycles(ignored), 'v1');
    expect(october).toMatchObject({ spentCents: 15000, km: 0, kmPerLiter: null });
  });

  it("with 'all' sums spending, liters and km and returns null consumption", () => {
    const other = [
      fueling({ vehicleId: 'v2', odometerKm: 500, date: '2026-10-01', totalCents: 10000 }),
      fueling({ vehicleId: 'v2', odometerKm: 800, date: '2026-10-15', totalCents: 12000 }),
    ];
    const all = [...records, ...other];
    const total = summarizeMonth('2026-10', all, buildCycles(all), 'all');
    expect(total).toMatchObject({
      vehicleId: 'all',
      spentCents: 37000,
      fuelingCount: 3,
      km: 750,
      cyclesCount: 2,
      kmPerLiter: null,
      costPerKmCents: null,
    });
    expect(total.litersMl).toBe(25428 + (other[0]?.litersMl ?? 0) + (other[1]?.litersMl ?? 0));
  });

  it('filters by vehicle when given a vehicle id', () => {
    const all = [...records, fueling({ vehicleId: 'v2', date: '2026-10-02', totalCents: 9900 })];
    expect(summarizeMonth('2026-10', all, buildCycles(all), 'v1').spentCents).toBe(15000);
  });
});

describe('summarizeRange', () => {
  it('summarizes each month in order', () => {
    const records = [fueling({ date: '2026-09-01' }), fueling({ date: '2026-10-01' })];
    const range = summarizeRange(['2026-08', '2026-09', '2026-10'], records, [], 'v1');
    expect(range.map((s) => [s.month, s.spentCents])).toEqual([
      ['2026-08', 0],
      ['2026-09', 20000],
      ['2026-10', 20000],
    ]);
  });
});
