// Ícones carregam fontes via expo-asset, indisponível no Jest.
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  function Ionicons({ name, accessibilityLabel }: { name: string; accessibilityLabel?: string }) {
    return <Text accessibilityLabel={accessibilityLabel}>{`icon:${name}`}</Text>;
  }
  return { __esModule: true, default: Ionicons };
});
