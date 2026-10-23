import { asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { bootstrapDatabase } from '@/db/bootstrap';
import { fuelings, odometerSegments, vehicles } from '@/db/schema';
import { inTransaction } from '@/db/transaction';
import type { RepoContext } from '@/db/types';
import { formatDate } from '@/domain/dates';
import { FUEL_LABELS } from '@/domain/format';
import { FUEL_TYPES, type FuelType } from '@/domain/types';

export const BACKUP_SCHEMA_VERSION = 1;

const fuelType = z.enum(FUEL_TYPES as [FuelType, ...FuelType[]]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const epoch = z.number().int();
const timestamps = { createdAt: epoch, updatedAt: epoch, deletedAt: epoch.nullable() };

const vehicleSchema = z.object({
  id: z.string().min(1),
  nickname: z.string().min(1),
  plate: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  year: z.number().int().nullable(),
  defaultFuel: fuelType,
  archivedAt: epoch.nullable(),
  ...timestamps,
});

const segmentSchema = z.object({
  id: z.string().min(1),
  vehicleId: z.string().min(1),
  sequence: z.number().int().positive(),
  startedOn: isoDate,
  ...timestamps,
});

const fuelingSchema = z.object({
  id: z.string().min(1),
  vehicleId: z.string().min(1),
  segmentId: z.string().min(1),
  date: isoDate,
  odometerKm: z.number().int().nonnegative(),
  pricePerLiterMilli: z.number().int().positive(),
  totalCents: z.number().int().positive(),
  litersMl: z.number().int().nonnegative(),
  fullTank: z.boolean(),
  fuelType,
  excludeFromAverage: z.boolean(),
  station: z.string().nullable(),
  notes: z.string().nullable(),
  ...timestamps,
});

export const backupSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string(),
  vehicles: z.array(vehicleSchema),
  odometerSegments: z.array(segmentSchema),
  fuelings: z.array(fuelingSchema),
});

export type Backup = z.infer<typeof backupSchema>;
export type ImportMode = 'replace' | 'merge';

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Todas as linhas, inclusive as excluídas (soft delete), para o backup ser fiel. */
export function exportBackup(ctx: RepoContext): Backup {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(ctx.now()).toISOString(),
    vehicles: ctx.db.select().from(vehicles).orderBy(asc(vehicles.id)).all(),
    odometerSegments: ctx.db
      .select()
      .from(odometerSegments)
      .orderBy(asc(odometerSegments.id))
      .all(),
    fuelings: ctx.db.select().from(fuelings).orderBy(asc(fuelings.id)).all(),
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/** Lê e valida o JSON. Lança `BackupError` com mensagem para o usuário. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('O arquivo não é um JSON válido.');
  }
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    throw new BackupError('O arquivo não é um backup válido deste app.');
  }
  return result.data;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
}

interface RowOps<T> {
  findUpdatedAt: (id: string) => number | undefined;
  insert: (row: T) => void;
  update: (row: T) => void;
}

function mergeRows<T extends { id: string; updatedAt: number }>(
  rows: T[],
  ops: RowOps<T>,
  result: ImportResult,
) {
  for (const row of rows) {
    const existing = ops.findUpdatedAt(row.id);
    if (existing === undefined) {
      ops.insert(row);
      result.inserted += 1;
    } else if (row.updatedAt > existing) {
      ops.update(row);
      result.updated += 1;
    } else {
      result.skipped += 1;
    }
  }
}

/**
 * Importa numa única transação: se algo falhar (ex.: referência quebrada), nada muda.
 * "Mesclar" compara por `id` e mantém o maior `updatedAt`.
 */
export function importBackup(ctx: RepoContext, backup: Backup, mode: ImportMode): ImportResult {
  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0 };
  try {
    inTransaction(ctx.db, () => {
      if (mode === 'replace') {
        ctx.db.delete(fuelings).run();
        ctx.db.delete(odometerSegments).run();
        ctx.db.delete(vehicles).run();
      }
      const { db } = ctx;
      mergeRows(
        backup.vehicles,
        {
          findUpdatedAt: (id) =>
            db.select().from(vehicles).where(eq(vehicles.id, id)).get()?.updatedAt,
          insert: (row) => db.insert(vehicles).values(row).run(),
          update: (row) => db.update(vehicles).set(row).where(eq(vehicles.id, row.id)).run(),
        },
        result,
      );
      mergeRows(
        backup.odometerSegments,
        {
          findUpdatedAt: (id) =>
            db.select().from(odometerSegments).where(eq(odometerSegments.id, id)).get()?.updatedAt,
          insert: (row) => db.insert(odometerSegments).values(row).run(),
          update: (row) =>
            db.update(odometerSegments).set(row).where(eq(odometerSegments.id, row.id)).run(),
        },
        result,
      );
      mergeRows(
        backup.fuelings,
        {
          findUpdatedAt: (id) =>
            db.select().from(fuelings).where(eq(fuelings.id, id)).get()?.updatedAt,
          insert: (row) => db.insert(fuelings).values(row).run(),
          update: (row) => db.update(fuelings).set(row).where(eq(fuelings.id, row.id)).run(),
        },
        result,
      );
      // O app precisa de ao menos um veículo ativo.
      bootstrapDatabase(ctx);
    });
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError(
      'Não foi possível importar o backup. Nenhum dado foi alterado.' +
        (error instanceof Error ? `\n${error.message}` : ''),
    );
  }
  return result;
}

const CSV_HEADER = [
  'Data',
  'Veículo',
  'Odômetro (km)',
  'Combustível',
  'Preço por litro (R$)',
  'Valor total (R$)',
  'Litros',
  'Tanque cheio',
  'Ignorado na média',
  'Posto',
  'Observações',
];

function csvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Inteiro escalado em decimal pt-BR sem separador de milhar: 5899, 3 -> "5,899". */
function decimal(value: number, decimals: number): string {
  const scale = 10 ** decimals;
  const fraction = String(Math.abs(value) % scale).padStart(decimals, '0');
  return `${Math.trunc(value / scale)},${fraction}`;
}

/** CSV de abastecimentos ativos, com BOM UTF-8 e `;` (Excel pt-BR). */
export function exportCsv(ctx: RepoContext): string {
  const names = new Map(
    ctx.db
      .select({ id: vehicles.id, nickname: vehicles.nickname })
      .from(vehicles)
      .all()
      .map((v) => [v.id, v.nickname]),
  );
  const rows = ctx.db
    .select()
    .from(fuelings)
    .where(isNull(fuelings.deletedAt))
    .orderBy(asc(fuelings.date), asc(fuelings.odometerKm))
    .all();

  const lines = [
    CSV_HEADER,
    ...rows.map((f) => [
      formatDate(f.date),
      names.get(f.vehicleId) ?? '',
      String(f.odometerKm),
      FUEL_LABELS[f.fuelType],
      decimal(f.pricePerLiterMilli, 3),
      decimal(f.totalCents, 2),
      decimal(f.litersMl, 3),
      f.fullTank ? 'Sim' : 'Não',
      f.excludeFromAverage ? 'Sim' : 'Não',
      f.station ?? '',
      f.notes ?? '',
    ]),
  ];
  return `﻿${lines.map((line) => line.map(csvField).join(';')).join('\r\n')}\r\n`;
}
