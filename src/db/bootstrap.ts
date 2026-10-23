import { getMeta, setMeta } from '@/repositories/meta';
import { ensureDefaultVehicle } from '@/repositories/vehicles';

import { inTransaction } from './transaction';
import type { RepoContext } from './types';

export const SCHEMA_VERSION = 1;

/** Roda após as migrations: registra a versão e cria o veículo implícito. */
export function bootstrapDatabase(ctx: RepoContext): void {
  inTransaction(ctx.db, () => {
    if (getMeta(ctx, 'schema_version') !== String(SCHEMA_VERSION)) {
      setMeta(ctx, 'schema_version', String(SCHEMA_VERSION));
    }
    ensureDefaultVehicle(ctx);
  });
}
