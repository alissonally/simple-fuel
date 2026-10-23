import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { odometerSegments, type SegmentRow } from '@/db/schema';
import type { RepoContext } from '@/db/types';

/** Início do segmento 1: aceita abastecimentos de qualquer data passada. */
export const FIRST_SEGMENT_START = '1900-01-01';

const active = (vehicleId: string) =>
  and(eq(odometerSegments.vehicleId, vehicleId), isNull(odometerSegments.deletedAt));

export function listSegments(ctx: RepoContext, vehicleId?: string): SegmentRow[] {
  const query = ctx.db.select().from(odometerSegments);
  return (
    vehicleId ? query.where(active(vehicleId)) : query.where(isNull(odometerSegments.deletedAt))
  )
    .orderBy(asc(odometerSegments.vehicleId), asc(odometerSegments.sequence))
    .all();
}

export function getSegment(ctx: RepoContext, id: string): SegmentRow | undefined {
  return ctx.db
    .select()
    .from(odometerSegments)
    .where(and(eq(odometerSegments.id, id), isNull(odometerSegments.deletedAt)))
    .get();
}

export function currentSegment(ctx: RepoContext, vehicleId: string): SegmentRow {
  const segment = ctx.db
    .select()
    .from(odometerSegments)
    .where(active(vehicleId))
    .orderBy(desc(odometerSegments.sequence))
    .limit(1)
    .get();
  if (!segment) throw new Error(`Vehicle ${vehicleId} has no odometer segment`);
  return segment;
}

export function createSegment(
  ctx: RepoContext,
  vehicleId: string,
  sequence: number,
  startedOn: string,
): SegmentRow {
  const now = ctx.now();
  const row: SegmentRow = {
    id: ctx.newId(),
    vehicleId,
    sequence,
    startedOn,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  ctx.db.insert(odometerSegments).values(row).run();
  return row;
}

/** "Reiniciar odômetro": registros futuros vão para um novo segmento que começa hoje. */
export function restartOdometer(ctx: RepoContext, vehicleId: string): SegmentRow {
  const current = currentSegment(ctx, vehicleId);
  return createSegment(ctx, vehicleId, current.sequence + 1, ctx.today());
}
