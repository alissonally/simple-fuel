import { buildCycles } from '../cycles';
import type { FuelingRecord } from '../types';
import { fueling } from './factories';

describe('buildCycles', () => {
  it('returns no cycles for an empty list or a single record', () => {
    expect(buildCycles([])).toEqual([]);
    expect(buildCycles([fueling()])).toEqual([]);
  });

  it('full, full, full produces 2 cycles with correct values', () => {
    const a = fueling({ odometerKm: 10000, date: '2026-10-01' });
    const b = fueling({ odometerKm: 10400, date: '2026-10-10', totalCents: 20000 });
    const c = fueling({ odometerKm: 10750, date: '2026-10-20', totalCents: 18000 });
    const cycles = buildCycles([a, b, c]);

    expect(cycles).toHaveLength(2);
    expect(cycles[0]).toMatchObject({
      openingFuelingId: a.id,
      closingFuelingId: b.id,
      closedOn: '2026-10-10',
      km: 400,
      litersMl: 33904,
      totalCents: 20000,
      fuelTypes: ['gasoline'],
      mixed: false,
      excluded: false,
      outlier: false,
    });
    expect(cycles[0]?.kmPerLiter).toBeCloseTo(400 / 33.904, 6);
    expect(cycles[0]?.costPerKmCents).toBeCloseTo(50, 6);
    expect(cycles[1]).toMatchObject({ openingFuelingId: b.id, closingFuelingId: c.id, km: 350 });
  });

  it('full, partial, partial, full sums the last 3 records into 1 cycle', () => {
    const records = [
      fueling({ odometerKm: 10000, totalCents: 20000 }),
      fueling({ odometerKm: 10200, totalCents: 10000, fullTank: false }),
      fueling({ odometerKm: 10300, totalCents: 5000, fullTank: false }),
      fueling({ odometerKm: 10450, totalCents: 15000 }),
    ];
    const [cycle, ...rest] = buildCycles(records);

    expect(rest).toHaveLength(0);
    expect(cycle).toMatchObject({ km: 450, totalCents: 30000 });
    expect(cycle?.litersMl).toBe(
      (records[1]?.litersMl ?? 0) + (records[2]?.litersMl ?? 0) + (records[3]?.litersMl ?? 0),
    );
  });

  it('matches the manual acceptance script (≈ 10,6 km/l)', () => {
    const [cycle] = buildCycles([
      fueling({ odometerKm: 10000, totalCents: 20000 }),
      fueling({ odometerKm: 10200, totalCents: 10000, fullTank: false }),
      fueling({ odometerKm: 10450, totalCents: 15000 }),
    ]);
    expect(cycle?.litersMl).toBe(42380);
    expect(cycle?.kmPerLiter).toBeCloseTo(10.618, 3);
  });

  it('ignores partial records before the first full tank', () => {
    const first = fueling({ odometerKm: 9000, fullTank: false });
    const second = fueling({ odometerKm: 9500, fullTank: false });
    const open = fueling({ odometerKm: 10000 });
    const close = fueling({ odometerKm: 10400, totalCents: 20000 });
    const cycles = buildCycles([first, second, open, close]);

    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toMatchObject({ openingFuelingId: open.id, km: 400, litersMl: 33904 });
  });

  it('does not count the liters of the opening record', () => {
    const [cycle] = buildCycles([
      fueling({ odometerKm: 10000, totalCents: 99999 }),
      fueling({ odometerKm: 10400, totalCents: 20000 }),
    ]);
    expect(cycle?.totalCents).toBe(20000);
  });

  it('produces the same result regardless of insertion order', () => {
    const records = [
      fueling({ odometerKm: 10000, date: '2026-09-01' }),
      fueling({ odometerKm: 10200, date: '2026-09-08', fullTank: false, totalCents: 10000 }),
      fueling({ odometerKm: 10450, date: '2026-09-15', totalCents: 15000 }),
      fueling({ odometerKm: 10800, date: '2026-09-25', totalCents: 17000 }),
    ];
    const reversed = [...records].reverse();
    const scrambled = [records[2], records[0], records[3], records[1]] as FuelingRecord[];

    expect(buildCycles(reversed)).toEqual(buildCycles(records));
    expect(buildCycles(scrambled)).toEqual(buildCycles(records));
  });

  it('a retroactive record inserted in the middle splits the cycle', () => {
    const a = fueling({ odometerKm: 10000, date: '2026-10-01' });
    const c = fueling({ odometerKm: 10800, date: '2026-10-20', totalCents: 30000 });
    expect(buildCycles([a, c])).toHaveLength(1);

    const b = fueling({ odometerKm: 10400, date: '2026-10-10', totalCents: 15000 });
    const cycles = buildCycles([a, c, b]);
    expect(cycles.map((cycle) => cycle.km)).toEqual([400, 400]);
  });

  describe('section 7 edge cases', () => {
    const a = fueling({ odometerKm: 10000, date: '2026-10-01' });
    const b = fueling({ odometerKm: 10400, date: '2026-10-10', totalCents: 15000 });
    const c = fueling({ odometerKm: 10800, date: '2026-10-20', totalCents: 16000 });
    const d = fueling({ odometerKm: 11200, date: '2026-10-28', totalCents: 17000 });

    it('deleting the opening record makes the previous full tank the opening', () => {
      const cycles = buildCycles([a, c, d]); // b excluído
      expect(cycles).toHaveLength(2);
      expect(cycles[0]).toMatchObject({
        openingFuelingId: a.id,
        closingFuelingId: c.id,
        km: 800,
        totalCents: 16000,
      });
    });

    it('turning a full tank into a partial merges two cycles', () => {
      const partialB = { ...b, fullTank: false };
      const cycles = buildCycles([a, partialB, c]);
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toMatchObject({
        openingFuelingId: a.id,
        closingFuelingId: c.id,
        km: 800,
        totalCents: 31000,
        litersMl: b.litersMl + c.litersMl,
      });
    });
  });

  it('never crosses an odometer segment boundary', () => {
    const records = [
      fueling({ odometerKm: 50000, segmentId: 's1', segmentSequence: 1 }),
      fueling({ odometerKm: 50400, segmentId: 's1', segmentSequence: 1, fullTank: false }),
      // Odômetro reiniciado: segmento 2 começa do zero.
      fueling({ odometerKm: 100, segmentId: 's2', segmentSequence: 2 }),
      fueling({ odometerKm: 500, segmentId: 's2', segmentSequence: 2 }),
    ];
    const cycles = buildCycles(records);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toMatchObject({ km: 400, openingFuelingId: records[2]?.id });
  });

  it('discards cycles with zero km or zero liters', () => {
    expect(
      buildCycles([fueling({ odometerKm: 10000 }), fueling({ odometerKm: 10400, litersMl: 0 })]),
    ).toEqual([]);
  });

  it('separates records of different vehicles', () => {
    const cycles = buildCycles([
      fueling({ vehicleId: 'v1', odometerKm: 10000 }),
      fueling({ vehicleId: 'v2', odometerKm: 10200 }),
      fueling({ vehicleId: 'v1', odometerKm: 10400 }),
    ]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toMatchObject({ vehicleId: 'v1', km: 400 });
  });

  describe('flags', () => {
    it('marks a cycle with more than one fuel as mixed', () => {
      const cycles = buildCycles([
        fueling({ odometerKm: 10000, fuelType: 'gasoline' }),
        fueling({ odometerKm: 10200, fuelType: 'ethanol', fullTank: false }),
        fueling({ odometerKm: 10400, fuelType: 'gasoline' }),
        fueling({ odometerKm: 10800, fuelType: 'ethanol' }),
      ]);
      expect(cycles[0]).toMatchObject({ mixed: true, fuelTypes: ['ethanol', 'gasoline'] });
      expect(cycles[1]).toMatchObject({ mixed: false, fuelTypes: ['ethanol'] });
    });

    it('uses excludeFromAverage of the closing record', () => {
      const cycles = buildCycles([
        fueling({ odometerKm: 10000, excludeFromAverage: true }),
        fueling({ odometerKm: 10400, excludeFromAverage: true }),
        fueling({ odometerKm: 10800 }),
      ]);
      expect(cycles.map((cycle) => cycle.excluded)).toEqual([true, false]);
    });

    // Cada ciclo de 400 km com R$ 200,00 a R$ 5,899 → ≈ 11,8 km/l.
    function regular(count: number, start = 10000) {
      return Array.from({ length: count + 1 }, (_, i) =>
        fueling({ odometerKm: start + i * 400, totalCents: 20000 }),
      );
    }

    it.each([
      ['far below the median', 200, true],
      ['far above the median', 800, true],
      ['within 40% of the median', 500, false],
    ])('flags a cycle %s as outlier', (_label, km, expected) => {
      const base = regular(3);
      const last = base[base.length - 1] as FuelingRecord;
      const cycles = buildCycles([
        ...base,
        fueling({ odometerKm: last.odometerKm + km, totalCents: 20000 }),
      ]);
      expect(cycles).toHaveLength(4);
      expect(cycles[3]?.outlier).toBe(expected);
      expect(cycles.slice(0, 3).every((cycle) => !cycle.outlier)).toBe(true);
    });

    it('requires at least 3 reference cycles', () => {
      const base = regular(2);
      const last = base[base.length - 1] as FuelingRecord;
      const cycles = buildCycles([
        ...base,
        fueling({ odometerKm: last.odometerKm + 1500, totalCents: 20000 }),
      ]);
      expect(cycles.map((cycle) => cycle.outlier)).toEqual([false, false, false]);
    });

    it('ignores excluded, mixed and other-fuel cycles as references', () => {
      const records = [
        fueling({ odometerKm: 10000 }),
        fueling({ odometerKm: 10400 }),
        fueling({ odometerKm: 10800, excludeFromAverage: true }),
        fueling({ odometerKm: 11000, fullTank: false, fuelType: 'ethanol' }),
        fueling({ odometerKm: 11200 }),
        fueling({ odometerKm: 11600, fuelType: 'ethanol' }),
        fueling({ odometerKm: 12000, fuelType: 'ethanol' }),
        fueling({ odometerKm: 13500 }),
      ];
      const cycles = buildCycles(records);
      // Referências de gasolina válidas: só o 1º ciclo → menos de 3, sem outlier.
      expect(cycles.every((cycle) => !cycle.outlier)).toBe(true);
    });

    it('never flags mixed cycles', () => {
      const base = regular(3);
      const last = base[base.length - 1] as FuelingRecord;
      const cycles = buildCycles([
        ...base,
        fueling({ odometerKm: last.odometerKm + 100, fullTank: false, fuelType: 'ethanol' }),
        fueling({ odometerKm: last.odometerKm + 1500 }),
      ]);
      expect(cycles[3]).toMatchObject({ mixed: true, outlier: false });
    });

    it('uses the median of an even number of references', () => {
      // Referências 300, 400, 500, 600 km → mediana 450 km por ciclo.
      const kms = [300, 400, 500, 600];
      let odometerKm = 10000;
      const records = [fueling({ odometerKm })];
      for (const km of kms) {
        odometerKm += km;
        records.push(fueling({ odometerKm }));
      }
      records.push(fueling({ odometerKm: odometerKm + 640 }));
      const cycles = buildCycles(records);
      // 640 / 450 = +42% → outlier
      expect(cycles[4]?.outlier).toBe(true);
    });
  });
});
