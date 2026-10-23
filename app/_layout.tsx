import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { ToastProvider } from '@/components/Toast';
import { repoContext } from '@/db/client';
import { DatabaseGate } from '@/db/DatabaseGate';
import { NotificationsManager } from '@/features/notifications/NotificationsManager';
import { createQueryClient, RepoProvider } from '@/hooks';

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  return (
    <DatabaseGate>
      <RepoProvider value={repoContext}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="fueling/new"
                options={{ presentation: 'modal', title: 'Novo abastecimento' }}
              />
              <Stack.Screen name="fueling/[id]" options={{ title: 'Editar abastecimento' }} />
              <Stack.Screen
                name="vehicle/new"
                options={{ presentation: 'modal', title: 'Novo veículo' }}
              />
              <Stack.Screen name="vehicle/[id]" options={{ title: 'Editar veículo' }} />
              <Stack.Screen
                name="vehicle/complete-first"
                options={{
                  title: 'Seu primeiro veículo',
                  headerBackVisible: false,
                  gestureEnabled: false,
                }}
              />
            </Stack>
            <NotificationsManager />
            <StatusBar style="auto" />
          </ToastProvider>
        </QueryClientProvider>
      </RepoProvider>
    </DatabaseGate>
  );
}
