import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/Toast';

import { createQueryClient, RepoProvider } from '@/hooks';

import { createTestContext, type TestContext } from './db';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Providers do app sobre um banco em memória. */
export function createTestProviders(ctx: TestContext = createTestContext()) {
  const client = createQueryClient();
  // Sem timers de coleta de cache, para o Jest encerrar sem handles abertos.
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, gcTime: Infinity },
    mutations: { ...client.getDefaultOptions().mutations, gcTime: Infinity },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepoProvider value={ctx}>
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={METRICS}>
            <ToastProvider>{children}</ToastProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </RepoProvider>
    );
  }
  return { ctx, client, Wrapper };
}
