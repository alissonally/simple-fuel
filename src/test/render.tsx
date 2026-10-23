import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createQueryClient, RepoProvider } from '@/hooks';

import { createTestContext, type TestContext } from './db';

/** Providers do app sobre um banco em memória. */
export function createTestProviders(ctx: TestContext = createTestContext()) {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepoProvider value={ctx}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </RepoProvider>
    );
  }
  return { ctx, client, Wrapper };
}
