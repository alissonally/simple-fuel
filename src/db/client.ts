import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import { toISODate } from '@/domain/dates';

import { newId } from './ids';
import * as schema from './schema';
import type { RepoContext } from './types';

export const DATABASE_NAME = 'combustivel.db';

export const sqlite = openDatabaseSync(DATABASE_NAME);
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

export const repoContext: RepoContext = {
  db,
  now: () => Date.now(),
  today: () => toISODate(new Date()),
  newId,
};
