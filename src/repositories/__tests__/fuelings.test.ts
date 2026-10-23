import { buildCycles } from '@/domain/cycles';
import { createTestContext, type TestContext } from '@/test/db';

import { FuelingValidationError } from '../errors';
import {
  createFueling,
  deleteFueling,
  getFueling,
  lastFueling,
  lastPriceMilli,
  listFuelings,
  setExcludeFromAverage,
  updateFueling,
  type FuelingInput,
} from '../fuelings';
import { getMeta } from '../meta';
import { restartOdometer } from '../segments';
import { createVehicle, listVehicles } from '../vehicles';

function setup(): {
  ctx: TestContext;
  vehicleId: string;
  input: (o?: Partial<FuelingInput>) => FuelingInput;
} {
  const ctx = createTestContext();
  const vehicleId = listVehicles(ctx)[0]?.id ?? '';
  const input = (overrides: Partial<FuelingInput> = {}): FuelingInput => ({
    vehicleId,
    date: '2026-10-01',
    odometerKm: 10000,
    pricePerLiterMilli: 5899,
    totalCents: 20000,
    fullTank: true,
    fuelType: 'gasoline',
    ...overrides,
  });
  return { ctx, vehicleId, input };
}

describe('fuelings repository', () => {
  it('creates a fueling with derived liters, ids and timestamps', () => {
    const { ctx, vehicleId, input } = setup();
    const created = createFueling(ctx, input({ station: ' Posto X ', notes: '' }));
    expect(created).toMatchObject({
      id: expect.stringMatching(/^id-/),
      litersMl: 33904,
      segmentSequence: 1,
      excludeFromAverage: false,
      station: 'Posto X',
      notes: null,
      createdAt: ctx.now(),
      updatedAt: ctx.now(),
    });
    expect(getFueling(ctx, created.id)).toEqual(created);
    expect(getMeta(ctx, 'last_vehicle_id')).toBe(vehicleId);
  });

  it('refuses validation errors', () => {
    const { ctx, input } = setup();
    expect(() => createFueling(ctx, input({ date: '2026-10-24' }))).toThrow(FuelingValidationError);
    expect(listFuelings(ctx)).toHaveLength(0);
  });

  it('enforces a unique odometer per segment among active records', () => {
    const { ctx, input } = setup();
    const first = createFueling(ctx, input());
    expect(() => createFueling(ctx, input({ date: '2026-10-02' }))).toThrow(
      expect.objectContaining({
        issues: [expect.objectContaining({ code: 'duplicate_odometer' })],
      }),
    );
    // Depois do soft delete, o odômetro fica livre.
    deleteFueling(ctx, first.id);
    expect(() => createFueling(ctx, input({ date: '2026-10-02' }))).not.toThrow();
  });

  it('allows the same odometer in another segment', () => {
    const { ctx, vehicleId, input } = setup();
    createFueling(ctx, input({ odometerKm: 500 }));
    restartOdometer(ctx, vehicleId);
    const created = createFueling(ctx, input({ odometerKm: 500, date: '2026-10-23' }));
    expect(created.segmentSequence).toBe(2);
  });

  it('refuses dates before the current segment start after a restart', () => {
    const { ctx, vehicleId, input } = setup();
    restartOdometer(ctx, vehicleId);
    expect(() => createFueling(ctx, input({ date: '2026-10-22' }))).toThrow(
      expect.objectContaining({
        issues: [expect.objectContaining({ code: 'before_segment_start' })],
      }),
    );
  });

  it('accepts warnings only with confirmWarnings: true', () => {
    const { ctx, input } = setup();
    const risky = input({ pricePerLiterMilli: 25000 });
    let error: unknown;
    try {
      createFueling(ctx, risky);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(FuelingValidationError);
    expect((error as FuelingValidationError).onlyWarnings).toBe(true);
    expect(listFuelings(ctx)).toHaveLength(0);

    createFueling(ctx, risky, { confirmWarnings: true });
    expect(listFuelings(ctx)).toHaveLength(1);
  });

  it('never returns soft-deleted records', () => {
    const { ctx, input } = setup();
    const a = createFueling(ctx, input());
    createFueling(ctx, input({ odometerKm: 10400, date: '2026-10-10' }));
    deleteFueling(ctx, a.id);
    expect(listFuelings(ctx).map((f) => f.odometerKm)).toEqual([10400]);
    expect(getFueling(ctx, a.id)).toBeUndefined();
  });

  it('lists newest first and filters by vehicle', () => {
    const { ctx, input } = setup();
    const other = createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    createFueling(ctx, input());
    createFueling(ctx, input({ odometerKm: 10400, date: '2026-10-10' }));
    createFueling(ctx, input({ vehicleId: other.id, odometerKm: 100, date: '2026-10-05' }));
    expect(listFuelings(ctx).map((f) => f.date)).toEqual([
      '2026-10-10',
      '2026-10-05',
      '2026-10-01',
    ]);
    expect(listFuelings(ctx, other.id)).toHaveLength(1);
  });

  it('updates a record, recomputing liters and keeping its own odometer valid', () => {
    const { ctx, input } = setup();
    const created = createFueling(ctx, input());
    ctx.tick();
    const updated = updateFueling(ctx, created.id, input({ totalCents: 10000, fullTank: false }));
    expect(updated).toMatchObject({ litersMl: 16952, fullTank: false });
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(getFueling(ctx, created.id)).toEqual(updated);
  });

  it('moves a record to the current segment of another vehicle', () => {
    const { ctx, input } = setup();
    const other = createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    const created = createFueling(ctx, input());
    const moved = updateFueling(ctx, created.id, input({ vehicleId: other.id }));
    expect(moved.vehicleId).toBe(other.id);
    expect(moved.segmentId).not.toBe(created.segmentId);
  });

  it('refuses to update a missing record', () => {
    const { ctx, input } = setup();
    expect(() => updateFueling(ctx, 'missing', input())).toThrow('Abastecimento não encontrado');
  });

  it('toggles excludeFromAverage and cycles follow on read', () => {
    const { ctx, input } = setup();
    createFueling(ctx, input());
    const closing = createFueling(ctx, input({ odometerKm: 10400, date: '2026-10-10' }));
    setExcludeFromAverage(ctx, closing.id, true);
    expect(buildCycles(listFuelings(ctx))[0]?.excluded).toBe(true);
    setExcludeFromAverage(ctx, closing.id, false);
    expect(buildCycles(listFuelings(ctx))[0]?.excluded).toBe(false);
  });

  it('returns the last record of the current segment and the last price per fuel', () => {
    const { ctx, vehicleId, input } = setup();
    expect(lastFueling(ctx, vehicleId)).toBeUndefined();
    expect(lastPriceMilli(ctx, 'gasoline')).toBeNull();
    createFueling(ctx, input({ odometerKm: 10400, date: '2026-10-10', pricePerLiterMilli: 6100 }));
    createFueling(ctx, input({ pricePerLiterMilli: 5899 }));
    createFueling(
      ctx,
      input({
        odometerKm: 10800,
        date: '2026-10-12',
        fuelType: 'ethanol',
        pricePerLiterMilli: 4100,
      }),
    );
    expect(lastFueling(ctx, vehicleId)?.odometerKm).toBe(10800);
    expect(lastPriceMilli(ctx, 'gasoline')).toBe(6100);
    expect(lastPriceMilli(ctx, 'ethanol')).toBe(4100);
  });

  it('refuses new records for an archived vehicle', () => {
    const { ctx, input } = setup();
    const other = createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    ctx.sqlite.prepare('update vehicles set archived_at = 1 where id = ?').run(other.id);
    expect(() => createFueling(ctx, input({ vehicleId: other.id }))).toThrow('arquivado');
  });
});
