/** Mock mínimo do expo-router para testes de tela. */
export const router = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
  dismissTo: jest.fn(),
  setParams: jest.fn(),
};
export const useLocalSearchParams = jest.fn(() => ({}));
export const useRouter = () => router;
export const Stack = { Screen: () => null };
