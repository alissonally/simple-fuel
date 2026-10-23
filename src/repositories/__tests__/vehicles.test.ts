import { bootstrapDatabase } from '@/db/bootstrap';
import { createTestContext } from '@/test/db';

import { DomainError } from '../errors';
import { createFueling, listFuelings } from '../fuelings';
import { getMeta } from '../meta';
import { currentSegment, listSegments, restartOdometer } from '../segments';
import {
  archiveVehicle,
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  needsFirstVehicleCompletion,
  unarchiveVehicle,
  updateVehicle,
} from '../vehicles';

describe('implicit vehicle', () => {
  it('a clean install creates exactly 1 vehicle and 1 segment', () => {
    const ctx = createTestContext();
    bootstrapDatabase(ctx); // idempotente
    const vehicles = listVehicles(ctx, { includeArchived: true });
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]).toMatchObject({ nickname: 'Meu veículo', defaultFuel: 'gasoline' });
    expect(listSegments(ctx)).toEqual([
      expect.objectContaining({ vehicleId: vehicles[0]?.id, sequence: 1 }),
    ]);
    expect(getMeta(ctx, 'schema_version')).toBe('1');
  });
});

describe('vehicles repository', () => {
  it('normalizes the plate and optional fields', () => {
    const ctx = createTestContext();
    const vehicle = createVehicle(ctx, {
      nickname: '  Moto ',
      plate: 'abc-1d23',
      brand: ' ',
      year: 2020,
      defaultFuel: 'ethanol',
    });
    expect(vehicle).toMatchObject({ nickname: 'Moto', plate: 'ABC1D23', brand: null, year: 2020 });
    expect(currentSegment(ctx, vehicle.id).sequence).toBe(1);
  });

  it.each([
    [{ nickname: ' ' }, 'nickname_required'],
    [{ nickname: 'meu VEÍCULO' }, 'nickname_taken'],
    [{ nickname: 'Moto', plate: 'XX-12' }, 'invalid_plate'],
    [{ nickname: 'Moto', year: 1800 }, 'invalid_year'],
  ])('rejects %p', (input, code) => {
    const ctx = createTestContext();
    expect(() => createVehicle(ctx, { defaultFuel: 'gasoline', ...input })).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it('updates a vehicle keeping its own nickname valid', () => {
    const ctx = createTestContext();
    const [first] = listVehicles(ctx);
    ctx.tick();
    const updated = updateVehicle(ctx, first?.id ?? '', {
      nickname: 'Meu veículo',
      model: 'Onix',
      defaultFuel: 'ethanol',
    });
    expect(updated).toMatchObject({ model: 'Onix', defaultFuel: 'ethanol' });
    expect(updated.updatedAt).toBeGreaterThan(updated.createdAt);
    expect(() => updateVehicle(ctx, 'missing', { nickname: 'X', defaultFuel: 'gasoline' })).toThrow(
      DomainError,
    );
  });

  it('does not delete or archive the last active vehicle', () => {
    const ctx = createTestContext();
    const [only] = listVehicles(ctx);
    expect(() => archiveVehicle(ctx, only?.id ?? '')).toThrow(
      expect.objectContaining({ code: 'last_active_vehicle' }),
    );
    expect(() => deleteVehicle(ctx, only?.id ?? '')).toThrow(
      expect.objectContaining({ code: 'last_active_vehicle' }),
    );
  });

  it('archives and unarchives keeping history', () => {
    const ctx = createTestContext();
    const second = createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    createFueling(ctx, {
      vehicleId: second.id,
      date: '2026-10-01',
      odometerKm: 1000,
      pricePerLiterMilli: 5899,
      totalCents: 5000,
      fullTank: true,
      fuelType: 'gasoline',
    });
    archiveVehicle(ctx, second.id);
    expect(listVehicles(ctx).map((v) => v.nickname)).toEqual(['Meu veículo']);
    expect(listVehicles(ctx, { includeArchived: true })).toHaveLength(2);
    expect(listFuelings(ctx, second.id)).toHaveLength(1);
    unarchiveVehicle(ctx, second.id);
    expect(listVehicles(ctx)).toHaveLength(2);
  });

  it('soft-deletes a vehicle with its segments and fuelings', () => {
    const ctx = createTestContext();
    const second = createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    createFueling(ctx, {
      vehicleId: second.id,
      date: '2026-10-01',
      odometerKm: 1000,
      pricePerLiterMilli: 5899,
      totalCents: 5000,
      fullTank: true,
      fuelType: 'gasoline',
    });
    deleteVehicle(ctx, second.id);

    expect(getVehicle(ctx, second.id)).toBeUndefined();
    expect(listVehicles(ctx, { includeArchived: true })).toHaveLength(1);
    expect(listFuelings(ctx)).toHaveLength(0);
    expect(listSegments(ctx, second.id)).toHaveLength(0);
    const raw = ctx.sqlite
      .prepare('select count(*) as n from fuelings where deleted_at is not null')
      .get() as { n: number };
    expect(raw.n).toBe(1);
  });

  it('detects when the first vehicle needs completion (flow 6.6)', () => {
    const ctx = createTestContext();
    expect(needsFirstVehicleCompletion(ctx)).toBeNull();
    createVehicle(ctx, { nickname: 'Moto', defaultFuel: 'gasoline' });
    expect(needsFirstVehicleCompletion(ctx)?.nickname).toBe('Meu veículo');

    const first = listVehicles(ctx)[0];
    updateVehicle(ctx, first?.id ?? '', {
      nickname: 'Meu veículo',
      plate: 'ABC1234',
      defaultFuel: 'gasoline',
    });
    expect(needsFirstVehicleCompletion(ctx)).toBeNull();
  });

  it('restarting the odometer creates a new segment starting today', () => {
    const ctx = createTestContext();
    const [vehicle] = listVehicles(ctx);
    const segment = restartOdometer(ctx, vehicle?.id ?? '');
    expect(segment).toMatchObject({ sequence: 2, startedOn: '2026-10-23' });
    expect(currentSegment(ctx, vehicle?.id ?? '').id).toBe(segment.id);
  });
});
