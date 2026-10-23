import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/** Banco síncrono: expo-sqlite no app, better-sqlite3 nos testes. */
export type Db = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/** Dependências injetadas nos repositórios (permite relógio e ids determinísticos em testes). */
export interface RepoContext {
  db: Db;
  now: () => number; // epoch ms
  today: () => string; // YYYY-MM-DD local
  newId: () => string;
}
