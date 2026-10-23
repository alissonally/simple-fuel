import { and, desc, eq, getTableColumns, isNull } from 'drizzle-orm';

import { litersFrom } from '@/domain/money';
import type { FuelingRecord, FuelType } from '@/domain/types';
import {
  hasErrors,
  validateFueling,
  warningsOf,
  type FuelingInput as UncheckedFuelingInput,
  type ValidationIssue,
} from '@/domain/validation';
import { fuelings, odometerSegments, type SegmentRow } from '@/db/schema';
import type { RepoContext } from '@/db/types';

import { DomainError, FuelingValidationError } from './errors';
import { setMeta } from './meta';
import { currentSegment, getSegment } from './segments';
import { getVehicle } from './vehicles';

export interface Fueling extends FuelingRecord {
  station: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FuelingInput {
  vehicleId: string;
  date: string;
  odometerKm: number;
  pricePerLiterMilli: number;
  totalCents: number;
  fullTank: boolean;
  fuelType: FuelType;
  station?: string | null;
  notes?: string | null;
}

export interface SaveOptions {
  /** Sem isso, avisos (seção 7) também recusam o salvamento. */
  confirmWarnings?: boolean;
}

const columns = (() => {
  const { deletedAt: _deletedAt, ...rest } = getTableColumns(fuelings);
  return { ...rest, segmentSequence: odometerSegments.sequence };
})();

function selectFuelings(ctx: RepoContext) {
  return ctx.db
    .select(columns)
    .from(fuelings)
    .innerJoin(odometerSegments, eq(fuelings.segmentId, odometerSegments.id));
}

/** Abastecimentos ativos, do mais recente para o mais antigo. */
export function listFuelings(ctx: RepoContext, vehicleId?: string): Fueling[] {
  const notDeleted = isNull(fuelings.deletedAt);
  return selectFuelings(ctx)
    .where(vehicleId ? and(notDeleted, eq(fuelings.vehicleId, vehicleId)) : notDeleted)
    .orderBy(desc(fuelings.date), desc(odometerSegments.sequence), desc(fuelings.odometerKm))
    .all();
}

export function getFueling(ctx: RepoContext, id: string): Fueling | undefined {
  return selectFuelings(ctx)
    .where(and(eq(fuelings.id, id), isNull(fuelings.deletedAt)))
    .get();
}

/** Registro de maior odômetro no segmento atual (dica "Último registro"). */
export function lastFueling(ctx: RepoContext, vehicleId: string): Fueling | undefined {
  const segment = currentSegment(ctx, vehicleId);
  return selectFuelings(ctx)
    .where(and(eq(fuelings.segmentId, segment.id), isNull(fuelings.deletedAt)))
    .orderBy(desc(fuelings.odometerKm))
    .limit(1)
    .get();
}

/** Último preço pago pelo combustível, em qualquer veículo. */
export function lastPriceMilli(ctx: RepoContext, fuelType: FuelType): number | null {
  const row = ctx.db
    .select({ price: fuelings.pricePerLiterMilli })
    .from(fuelings)
    .where(and(eq(fuelings.fuelType, fuelType), isNull(fuelings.deletedAt)))
    .orderBy(desc(fuelings.date), desc(fuelings.createdAt))
    .limit(1)
    .get();
  return row?.price ?? null;
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/** Entrada ainda não validada, como vem do formulário. */
export type FuelingDraft = UncheckedFuelingInput & { vehicleId: string };

function issuesFor(
  ctx: RepoContext,
  input: FuelingDraft,
  segment: SegmentRow,
  editingId?: string,
): ValidationIssue[] {
  const segmentFuelings = ctx.db
    .select({ id: fuelings.id, date: fuelings.date, odometerKm: fuelings.odometerKm })
    .from(fuelings)
    .where(and(eq(fuelings.segmentId, segment.id), isNull(fuelings.deletedAt)))
    .all();
  return validateFueling(input, {
    today: ctx.today(),
    segmentStartedOn: segment.startedOn,
    segmentFuelings,
    editingId,
  });
}

/** Segmento em que o abastecimento será gravado (o atual, ou o do registro em edição). */
function targetSegment(ctx: RepoContext, input: FuelingDraft, editing?: Fueling): SegmentRow {
  // Trocar de veículo leva o registro para o segmento atual do novo veículo.
  const segment =
    editing && input.vehicleId === editing.vehicleId
      ? getSegment(ctx, editing.segmentId)
      : currentSegment(ctx, input.vehicleId);
  if (!segment) throw new DomainError('not_found', 'Segmento de odômetro não encontrado');
  return segment;
}

/**
 * Problemas de validação (seção 7) sem gravar nada. Usado pelo formulário para
 * mostrar erros nos campos e pedir confirmação dos avisos.
 */
export function checkFueling(
  ctx: RepoContext,
  input: FuelingDraft,
  editingId?: string,
): ValidationIssue[] {
  const editing = editingId ? getFueling(ctx, editingId) : undefined;
  return issuesFor(ctx, input, targetSegment(ctx, input, editing), editingId);
}

/** Valida contra o segmento e lança se houver erro, ou aviso não confirmado. */
function validate(
  ctx: RepoContext,
  input: FuelingInput,
  segment: SegmentRow,
  options: SaveOptions,
  editingId?: string,
): void {
  const issues = issuesFor(ctx, input, segment, editingId);
  if (hasErrors(issues) || (warningsOf(issues).length > 0 && !options.confirmWarnings)) {
    throw new FuelingValidationError(issues);
  }
}

function activeVehicleOrThrow(ctx: RepoContext, vehicleId: string) {
  const vehicle = getVehicle(ctx, vehicleId);
  if (!vehicle) throw new DomainError('not_found', 'Veículo não encontrado');
  return vehicle;
}

function persistedFields(input: FuelingInput) {
  return {
    vehicleId: input.vehicleId,
    date: input.date,
    odometerKm: input.odometerKm,
    pricePerLiterMilli: input.pricePerLiterMilli,
    totalCents: input.totalCents,
    litersMl: litersFrom(input.totalCents, input.pricePerLiterMilli),
    fullTank: input.fullTank,
    fuelType: input.fuelType,
    station: cleanText(input.station),
    notes: cleanText(input.notes),
  };
}

export function createFueling(
  ctx: RepoContext,
  input: FuelingInput,
  options: SaveOptions = {},
): Fueling {
  const vehicle = activeVehicleOrThrow(ctx, input.vehicleId);
  if (vehicle.archivedAt !== null) {
    throw new DomainError('archived_vehicle', 'Esse veículo está arquivado');
  }
  const segment = currentSegment(ctx, vehicle.id);
  validate(ctx, input, segment, options);

  const now = ctx.now();
  const row = {
    id: ctx.newId(),
    segmentId: segment.id,
    ...persistedFields(input),
    excludeFromAverage: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  ctx.db.insert(fuelings).values(row).run();
  setMeta(ctx, 'last_vehicle_id', vehicle.id);
  const { deletedAt: _deletedAt, ...fueling } = row;
  return { ...fueling, segmentSequence: segment.sequence };
}

export function updateFueling(
  ctx: RepoContext,
  id: string,
  input: FuelingInput,
  options: SaveOptions = {},
): Fueling {
  const current = getFueling(ctx, id);
  if (!current) throw new DomainError('not_found', 'Abastecimento não encontrado');
  activeVehicleOrThrow(ctx, input.vehicleId);

  const segment = targetSegment(ctx, input, current);
  validate(ctx, input, segment, options, id);

  const changes = { segmentId: segment.id, ...persistedFields(input), updatedAt: ctx.now() };
  ctx.db.update(fuelings).set(changes).where(eq(fuelings.id, id)).run();
  return { ...current, ...changes, segmentSequence: segment.sequence };
}

export function deleteFueling(ctx: RepoContext, id: string): void {
  const now = ctx.now();
  ctx.db
    .update(fuelings)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(fuelings.id, id), isNull(fuelings.deletedAt)))
    .run();
}

/** "Ignorar ciclo": a marcação fica no tanque cheio que fecha o ciclo. */
export function setExcludeFromAverage(ctx: RepoContext, id: string, exclude: boolean): void {
  ctx.db
    .update(fuelings)
    .set({ excludeFromAverage: exclude, updatedAt: ctx.now() })
    .where(eq(fuelings.id, id))
    .run();
}
