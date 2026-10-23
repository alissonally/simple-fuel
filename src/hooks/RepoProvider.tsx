import { createContext, useContext, type ReactNode } from 'react';

import type { RepoContext } from '@/db/types';

const Context = createContext<RepoContext | null>(null);

/** Disponibiliza o contexto dos repositórios (banco real no app, em memória nos testes). */
export function RepoProvider({ value, children }: { value: RepoContext; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRepo(): RepoContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useRepo must be used inside <RepoProvider>');
  return ctx;
}
