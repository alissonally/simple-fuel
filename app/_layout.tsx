import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DatabaseGate } from '@/db/DatabaseGate';

export default function RootLayout() {
  return (
    <DatabaseGate>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </DatabaseGate>
  );
}
