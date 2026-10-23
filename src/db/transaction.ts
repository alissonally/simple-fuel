import type { Db } from './types';

const open = new WeakSet<Db>();

/**
 * Executa `fn` numa transação. Chamadas aninhadas reaproveitam a transação externa,
 * já que o banco é uma única conexão síncrona.
 */
export function inTransaction<T>(db: Db, fn: () => T): T {
  if (open.has(db)) return fn();
  return db.transaction(() => {
    open.add(db);
    try {
      return fn();
    } finally {
      open.delete(db);
    }
  });
}
