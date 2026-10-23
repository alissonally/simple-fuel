import { eq } from 'drizzle-orm';

import { appMeta } from '@/db/schema';
import type { RepoContext } from '@/db/types';

export type MetaKey = 'schema_version' | 'last_vehicle_id' | 'notifications_enabled';

export function getMeta(ctx: RepoContext, key: MetaKey): string | null {
  return ctx.db.select().from(appMeta).where(eq(appMeta.key, key)).get()?.value ?? null;
}

export function setMeta(ctx: RepoContext, key: MetaKey, value: string): void {
  ctx.db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } })
    .run();
}
