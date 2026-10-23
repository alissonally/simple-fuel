import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseAsync, openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';

import { toISODate } from '@/domain/dates';

import { bootstrapDatabase } from './bootstrap';
import { newId } from './ids';
import migrations from './migrations/migrations';
import * as schema from './schema';
import type { RepoContext } from './types';

export const DATABASE_NAME = 'combustivel.db';

let ready: Promise<RepoContext> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * No web, o arquivo fica no OPFS, que aceita uma conexão por vez. Ao recarregar a
 * página, o worker da página anterior pode segurar o arquivo por um instante.
 */
async function openWithRetry(attempts = 20) {
  for (let attempt = 1; ; attempt++) {
    try {
      return openDatabaseSync(DATABASE_NAME);
    } catch (error) {
      const locked = error instanceof Error && /Access Handle/i.test(error.message);
      if (Platform.OS !== 'web' || !locked) throw error;
      if (attempt >= attempts) {
        throw new Error('O app já está aberto em outra aba. Feche-a e recarregue esta página.');
      }
      await sleep(250);
    }
  }
}

async function open(): Promise<RepoContext> {
  if (Platform.OS === 'web') {
    // No web, as chamadas síncronas passam por um Web Worker com timeout curto.
    // Uma abertura assíncrona antes garante que o worker e o wasm já carregaram. Ela usa
    // um banco em memória, porque o OPFS não permite duas conexões no mesmo arquivo.
    const warmUp = await openDatabaseAsync(':memory:');
    await warmUp.closeAsync();
  }
  const sqlite = await openWithRetry();
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema });
  await migrate(db, migrations);

  const ctx: RepoContext = {
    db,
    now: () => Date.now(),
    today: () => toISODate(new Date()),
    newId,
  };
  bootstrapDatabase(ctx);
  return ctx;
}

/** Abre o banco, roda as migrations e cria o veículo implícito (uma vez por execução). */
export function initDatabase(): Promise<RepoContext> {
  ready ??= open().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}
