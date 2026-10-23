# Decisões

Decisões não cobertas por `docs/aplno.md`, registradas conforme a regra da seção 1.

- **Expo SDK 58** (estável mais recente em 23/10/2026).
- **Rotas em `app/` na raiz**, como na estrutura da seção 3 (o template do Expo sugere `src/app/`; o plano prevalece).
- **`noUncheckedIndexedAccess`** ativado no `tsconfig` além do `strict`, para reforçar a regra "sem `any`" em acessos a arrays.
- **Ícones** via `@expo/vector-icons` (Ionicons), já incluído no ecossistema Expo.
- **`react-dom`/`react-native-web`** instalados porque o `expo-router` os exige como peer; também permitem rodar no navegador.
- **Outlier (T3)**: a mediana de referência usa os *demais* ciclos válidos (o próprio ciclo não entra). Ciclos mistos nunca são marcados. Ciclos ignorados podem ser marcados, mas não servem de referência.
- **Desempate na ordenação de `buildCycles`**: segmento → odômetro → data → id, para resultado determinístico.
- **`buildCycles` aceita vários veículos** e processa cada um separadamente, o que simplifica o uso com `'all'`.
- **Km rodados no mês** seguem a seção 5: só ciclos não ignorados entram (km, consumo e custo/km usam o mesmo conjunto).
- **Datas no domínio** usam aritmética de strings `YYYY-MM-DD` em `src/domain/dates.ts` (sem `date-fns`), para manter o domínio sem dependências e sem fuso.
- **Validação de odômetro ≤ 0** também é erro (regra "valor ≤ 0" da seção 7 vale para todos os campos numéricos).
- **Aviso pós-salvamento** (`postSaveNotice`) não oferece "Ignorar" para ciclo já ignorado.
