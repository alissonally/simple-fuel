import { QueryClient } from '@tanstack/react-query';

/**
 * Os dados são locais: nada fica "velho" sozinho (só invalidações mudam o banco),
 * não há retry e as queries rodam mesmo sem rede.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}
