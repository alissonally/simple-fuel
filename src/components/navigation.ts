import { router } from 'expo-router';

/** Fecha a tela atual. Sem histórico (deep link ou recarga no web), vai para a Início. */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
