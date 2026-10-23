import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return function TabIcon({ focused, size }: { focused: boolean; size: number }) {
    return <Ionicons name={name} color={focused ? colors.primary : colors.muted} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('speedometer') }} />
      <Tabs.Screen name="history" options={{ title: 'Histórico', tabBarIcon: icon('list') }} />
      <Tabs.Screen name="monthly" options={{ title: 'Resumo', tabBarIcon: icon('bar-chart') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
