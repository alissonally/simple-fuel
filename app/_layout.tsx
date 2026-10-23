import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { repoContext } from '@/db/client';
import { DatabaseGate } from '@/db/DatabaseGate';
import { createQueryClient, RepoProvider } from '@/hooks';

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  return (
    <DatabaseGate>
      <RepoProvider value={repoContext}>
        <QueryClientProvider client={queryClient}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </RepoProvider>
    </DatabaseGate>
  );
}
