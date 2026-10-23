import { and, asc, eq, isNull } from 'drizzle-orm';

import { normalizePlate } from '@/domain/plate';
import type { FuelType } from '@/domain/types';
import { fuelings, odometerSegments, vehicles, type VehicleRow } from '@/db/schema';
import { inTransaction } from '@/db/transaction';
import type { RepoContext } from '@/db/types';

import { DomainError } from './errors';
import { createSegment, FIRST_SEGMENT_START } from './segments';

export const DEFAULT_VEHICLE_NICKNAME = 'Meu veículo';

export interface VehicleInput {
  nickname: string;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  defaultFuel: FuelType;
}

const notDeleted = isNull(vehicles.deletedAt);
const activeVehicles = and(notDeleted, isNull(vehicles.archivedAt));

/** Veículos não excluídos. Arquivados só entram com `includeArchived`. */
export function listVehicles(
  ctx: RepoContext,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): VehicleRow[] {
  return ctx.db
    .select()
    .from(vehicles)
    .where(includeArchived ? notDeleted : activeVehicles)
    .orderBy(asc(vehicles.createdAt))
    .all();
}

export function getVehicle(ctx: RepoContext, id: string): VehicleRow | undefined {
  return ctx.db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, id), notDeleted))
    .get();
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function normalizeInput(ctx: RepoContext, input: VehicleInput, editingId?: string) {
  const nickname = input.nickname.trim();
  if (!nickname) throw new DomainError('nickname_required', 'Informe um apelido');

  const duplicate = listVehicles(ctx).some(
    (v) => v.id !== editingId && v.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase(),
  );
  if (duplicate) throw new DomainError('nickname_taken', 'Já existe um veículo com esse apelido');

  let plate: string | null = null;
  const rawPlate = cleanText(input.plate);
  if (rawPlate) {
    plate = normalizePlate(rawPlate);
    if (!plate) throw new DomainError('invalid_plate', 'Placa inválida. Use ABC-1234 ou ABC1D23');
  }

  const year = input.year ?? null;
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
    throw new DomainError('invalid_year', 'Ano inválido');
  }

  return {
    nickname,
    plate,
    brand: cleanText(input.brand),
    model: cleanText(input.model),
    year,
    defaultFuel: input.defaultFuel,
  };
}

/** Cria o veículo com o seu segmento 1. */
export function createVehicle(ctx: RepoContext, input: VehicleInput): VehicleRow {
  return inTransaction(ctx.db, () => {
    const now = ctx.now();
    const row: VehicleRow = {
      id: ctx.newId(),
      ...normalizeInput(ctx, input),
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    ctx.db.insert(vehicles).values(row).run();
    createSegment(ctx, row.id, 1, FIRST_SEGMENT_START);
    return row;
  });
}

export function updateVehicle(ctx: RepoContext, id: string, input: VehicleInput): VehicleRow {
  const current = getVehicle(ctx, id);
  if (!current) throw new DomainError('not_found', 'Veículo não encontrado');
  const row = { ...current, ...normalizeInput(ctx, input, id), updatedAt: ctx.now() };
  ctx.db.update(vehicles).set(row).where(eq(vehicles.id, id)).run();
  return row;
}

function assertNotLastActive(ctx: RepoContext, id: string, action: string): void {
  const active = listVehicles(ctx);
  if (active.length <= 1 && active.some((v) => v.id === id)) {
    throw new DomainError('last_active_vehicle', `Não é possível ${action} o último veículo ativo`);
  }
}

export function archiveVehicle(ctx: RepoContext, id: string): void {
  assertNotLastActive(ctx, id, 'arquivar');
  const now = ctx.now();
  ctx.db.update(vehicles).set({ archivedAt: now, updatedAt: now }).where(eq(vehicles.id, id)).run();
}

export function unarchiveVehicle(ctx: RepoContext, id: string): void {
  ctx.db
    .update(vehicles)
    .set({ archivedAt: null, updatedAt: ctx.now() })
    .where(eq(vehicles.id, id))
    .run();
}

/** Soft delete do veículo, dos seus segmentos e abastecimentos. */
export function deleteVehicle(ctx: RepoContext, id: string): void {
  assertNotLastActive(ctx, id, 'excluir');
  inTransaction(ctx.db, () => {
    const now = ctx.now();
    const deleted = { deletedAt: now, updatedAt: now };
    ctx.db
      .update(fuelings)
      .set(deleted)
      .where(and(eq(fuelings.vehicleId, id), isNull(fuelings.deletedAt)))
      .run();
    ctx.db
      .update(odometerSegments)
      .set(deleted)
      .where(and(eq(odometerSegments.vehicleId, id), isNull(odometerSegments.deletedAt)))
      .run();
    ctx.db.update(vehicles).set(deleted).where(eq(vehicles.id, id)).run();
  });
}

/** Primeiro uso: cria silenciosamente "Meu veículo" (gasolina) se não houver nenhum ativo. */
export function ensureDefaultVehicle(ctx: RepoContext): VehicleRow {
  const [first] = listVehicles(ctx);
  if (first) return first;
  return createVehicle(ctx, { nickname: DEFAULT_VEHICLE_NICKNAME, defaultFuel: 'gasoline' });
}

/** Fluxo 6.6: o 1º veículo ainda está com o apelido padrão e sem dados opcionais. */
export function needsFirstVehicleCompletion(ctx: RepoContext): VehicleRow | null {
  const active = listVehicles(ctx);
  const [first] = active;
  if (active.length !== 2 || !first) return null;
  const untouched =
    first.nickname === DEFAULT_VEHICLE_NICKNAME &&
    !first.plate &&
    !first.brand &&
    !first.model &&
    first.year === null;
  return untouched ? first : null;
}
