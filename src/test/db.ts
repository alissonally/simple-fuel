import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import { bootstrapDatabase } from '@/db/bootstrap';
import * as schema from '@/db/schema';
import type { RepoContext } from '@/db/types';

export interface TestContext extends RepoContext {
  sqlite: Database.Database;
  /** Avança o relógio do contexto. */
  tick: (ms?: number) => void;
}

/** Banco SQLite em memória com as migrations reais aplicadas. */
export function createTestContext({
  today = '2026-10-23',
  bootstrap = true,
}: { today?: string; bootstrap?: boolean } = {}): TestContext {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../db/migrations') });

  let clock = Date.UTC(2026, 9, 23, 12);
  let ids = 0;
  const ctx: TestContext = {
    db,
    sqlite,
    now: () => clock,
    today: () => today,
    newId: () => `id-${String(++ids).padStart(4, '0')}`,
    tick: (ms = 1000) => {
      clock += ms;
    },
  };
  if (bootstrap) bootstrapDatabase(ctx);
  return ctx;
}
