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
- **Drizzle estável** (`drizzle-orm` 0.45 / `drizzle-kit` 0.31) em vez do RC 1.0. Índices declarados no formato de array (o formato de objeto do plano está obsoleto); o SQL gerado é o mesmo.
- **Repositórios síncronos** sobre `BaseSQLiteDatabase<'sync'>`: `expo-sqlite` no app e `better-sqlite3` em memória nos testes, com as mesmas migrations. Dependências (`db`, relógio, `today`, gerador de id) chegam por um `RepoContext`.
- **UUID v7** via `uuid` com bytes aleatórios do `expo-crypto` (Hermes não garante `crypto.getRandomValues`).
- **Segmento 1** começa em `1900-01-01`, para aceitar abastecimentos retroativos de qualquer data. Só segmentos criados por "Reiniciar odômetro" começam hoje.
- **Apelido de veículo** é único entre os veículos ativos (sem diferenciar maiúsculas), o que cobre a regra do `complete-first`.
- **Último preço** sugerido no formulário é o do mesmo combustível em qualquer veículo (o preço depende do posto, não do carro).
- **Editar abastecimento trocando o veículo** move o registro para o segmento atual do novo veículo.
- **Novo abastecimento em veículo arquivado** é recusado pelo repositório.
- **`app_meta`** entrou no schema Drizzle e na migration inicial.
- **React Query para dados locais**: `staleTime: Infinity`, sem retry e `networkMode: 'always'` (sem isso, queries pausariam offline). O `RepoContext` chega aos hooks por um `RepoProvider`, o que permite testar hooks e telas com SQLite em memória.
- **Hook de pós-mutação** (`onFuelingDataChanged`) é o ponto de extensão para reagendar a notificação (T12).
