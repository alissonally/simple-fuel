# Decisões

Decisões não cobertas por `docs/aplno.md`, registradas conforme a regra da seção 1.

- **Expo SDK 58** (estável mais recente em 23/10/2026).
- **Rotas em `app/` na raiz**, como na estrutura da seção 3 (o template do Expo sugere `src/app/`; o plano prevalece).
- **`noUncheckedIndexedAccess`** ativado no `tsconfig` além do `strict`, para reforçar a regra "sem `any`" em acessos a arrays.
- **Ícones** via `@expo/vector-icons` (Ionicons), já incluído no ecossistema Expo.
- **`react-dom`/`react-native-web`** instalados porque o `expo-router` os exige como peer; também permitem rodar no navegador.
