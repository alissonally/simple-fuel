# Plano de execução — App de controle de combustível (MVP)

Oct 23, 2026 · @Alisson Araújo

## 1. Contexto e instruções para o agente

Construa um app mobile offline-first, em React Native + Expo, para registrar abastecimentos e calcular consumo (km/l) e gasto mensal de combustível. Este documento é a especificação completa do MVP: siga as tarefas da seção 8 em ordem, uma por vez, e só avance quando os critérios de aceite da tarefa estiverem atendidos.

**Regras de execução**

- Idioma da interface: português do Brasil. Moeda BRL (R$), separador decimal vírgula, datas DD/MM/AAAA. Código, nomes de variáveis e commits em inglês.
- Sem backend no MVP. Todos os dados ficam em SQLite local. Não adicione autenticação, analytics nem chamadas de rede.
- O schema já nasce preparado para sync futuro (seção 4). Não simplifique esses campos.
- Valores derivados (km rodados, consumo, custo/km) **nunca** são persistidos. São calculados na leitura por funções puras (seção 5).
- Toda regra de cálculo fica em `src/domain/`, sem dependência de React, banco ou Expo, e com testes unitários.
- TypeScript em modo `strict`. Sem `any`.
- Ao terminar cada tarefa: rode `npm run typecheck`, `npm run lint` e `npm test`; faça um commit no formato Conventional Commits.
- Se uma decisão não estiver coberta aqui, escolha a opção mais simples, registre-a em `DECISIONS.md` e siga em frente.

**Decisões já tomadas**

| Tema                            | Decisão                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| Gasto mensal                    | Soma por data do abastecimento                                     |
| Método de consumo               | Tanque cheio, com abastecimentos parciais acumulados               |
| Veículos                        | Um veículo implícito; cadastro detalhado só ao adicionar o segundo |
| Persistência                    | SQLite local, sem sync no MVP                                      |
| Compartilhamento entre usuários | Fase 2                                                             |
| Backup                          | Export/import JSON já no MVP                                       |

## 2. Regras de negócio

O consumo é calculado pelo método tanque cheio. O gasto mensal é a soma dos valores pagos com data no mês.

### 2.1 Entrada de um abastecimento

| Campo                | Obrigatório | Padrão                            | Observação                                |
| -------------------- | ----------- | --------------------------------- | ----------------------------------------- |
| Veículo              | Sim         | Último usado                      | Seletor visível só com 2+ veículos ativos |
| Data                 | Sim         | Hoje                              | Não pode ser futura                       |
| Odômetro (km)        | Sim         | —                                 | Inteiro, sem casas decimais               |
| Preço por litro (R$) | Sim         | Último preço do mesmo combustível | 3 casas decimais (ex.: 5,899)             |
| Valor total (R$)     | Sim         | —                                 | 2 casas decimais                          |
| Tanque cheio         | Sim         | Sim                               | Toggle                                    |
| Combustível          | Sim         | Combustível padrão do veículo     | gasolina, etanol, diesel, gnv             |
| Posto                | Não         | —                                 | Texto livre                               |
| Observações          | Não         | —                                 | Texto livre                               |

Litros são derivados no momento do registro e persistidos com 3 casas decimais:

```latex
\text{litros} = \frac{\text{valor\_total}}{\text{preco\_litro}}
```

### 2.2 Consumo por ciclo (tanque cheio)

Um **ciclo** começa num abastecimento de tanque cheio e termina no próximo abastecimento de tanque cheio do mesmo veículo, com os registros ordenados por odômetro.

```latex
\text{km\_ciclo} = \text{odometro}_{\text{cheio atual}} - \text{odometro}_{\text{cheio anterior}}
```

```latex
\text{litros\_ciclo} = \sum \text{litros dos registros com odometro} \in (\text{cheio anterior}, \text{cheio atual}]
```

```latex
\text{consumo (km/l)} = \frac{\text{km\_ciclo}}{\text{litros\_ciclo}} \qquad \text{custo/km} = \frac{\text{valor\_ciclo}}{\text{km\_ciclo}}
```

- Os litros do abastecimento que **abre** o ciclo não entram na soma. Eles pertencem ao ciclo anterior.
- Abastecimentos parciais não fecham ciclo. Seus litros e valores são somados ao ciclo que os contém.
- Registros anteriores ao primeiro tanque cheio do veículo não geram consumo.
- O primeiro registro do veículo serve só de base. A home mostra: "O consumo aparece a partir do próximo tanque cheio".
- O ciclo é **misto** quando contém mais de um tipo de combustível. Ele entra no consumo geral, mas fica fora das médias por combustível.
- O ciclo pode ser marcado manualmente como **ignorado**. Nesse caso ele aparece no histórico, mas fica fora de todas as médias.
- Um marco de reinício de odômetro quebra a sequência. Nenhum ciclo cruza um marco.

### 2.3 Fechamento mensal (por veículo e total)

| Métrica           | Regra                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Gasto             | Soma de `total_cents` dos abastecimentos com `date` no mês                                        |
| Litros            | Soma de `liters` dos abastecimentos com `date` no mês                                             |
| Abastecimentos    | Contagem no mês                                                                                   |
| Km rodados        | Soma de `km_ciclo` dos ciclos fechados no mês (data do cheio que fecha o ciclo)                   |
| Consumo médio     | Soma de km ÷ soma de litros dos ciclos fechados no mês e não ignorados. Sem ciclos fechados = "—" |
| Custo/km          | Soma de valor ÷ soma de km desses mesmos ciclos                                                   |
| Preço médio/litro | Gasto ÷ litros                                                                                    |

O total geral soma gasto, litros e km de todos os veículos ativos. O consumo médio não é somado entre veículos: o total mostra só gasto, litros e km.

### 2.4 Veículos

- No primeiro uso, o app cria silenciosamente o veículo "Meu veículo", com combustível padrão gasolina. Nenhuma tela de cadastro aparece.
- Em Configurações, a opção "Adicionar veículo" abre um formulário com apelido (obrigatório), placa, marca, modelo, ano e combustível padrão.
- Ao salvar o 2º veículo ativo, o app exibe um passo obrigatório pedindo apelido do 1º (pré-preenchido com "Meu veículo") e os campos opcionais.
- Com 2+ veículos ativos, aparece o seletor de veículo no topo da home, no formulário e no resumo mensal.
- Arquivar um veículo preserva seu histórico. Com 1 veículo ativo, a UI volta ao modo simples.
- Excluir um veículo aplica soft delete no veículo e em seus abastecimentos, com confirmação. Não é permitido excluir o último veículo ativo.
- Placa: aceita os formatos `ABC1234` e `ABC1D23`, salva em maiúsculas sem hífen e é exibida como `ABC-1234` / `ABC1D23`.

## 3. Stack e estrutura do projeto

Use Expo (SDK estável mais recente) com Expo Router, SQLite via Drizzle e TanStack Query sobre o repositório local. Antes de instalar, confira na documentação oficial as versões compatíveis com o SDK escolhido.

| Camada                   | Biblioteca                                                 | Uso                                   |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------- |
| Framework                | `expo`, `expo-router`                                      | Navegação por arquivos                |
| Banco                    | `expo-sqlite`, `drizzle-orm`, `drizzle-kit`                | Schema, migrations, queries           |
| Estado de servidor local | `@tanstack/react-query`                                    | Cache e invalidação após mutações     |
| Formulários              | `react-hook-form`, `zod`                                   | Validação compartilhada com o domínio |
| IDs                      | `uuid` (v7)                                                | IDs gerados no cliente                |
| Datas                    | `date-fns` + locale `ptBR`                                 | Formatação e limites de mês           |
| Gráfico                  | `react-native-gifted-charts`                               | Barras dos últimos meses              |
| Notificações             | `expo-notifications`                                       | Aviso local de fechamento do mês      |
| Backup                   | `expo-file-system`, `expo-sharing`, `expo-document-picker` | Export/import JSON e CSV              |
| Testes                   | `jest`, `jest-expo`, `@testing-library/react-native`       | Domínio e telas                       |
| Qualidade                | `typescript` (strict), `eslint`, `prettier`                | —                                     |

**Estrutura de pastas**

```
app/                      # Expo Router
  _layout.tsx             # providers, migrations, seed do veículo implícito
  (tabs)/
    _layout.tsx
    index.tsx             # Home
    history.tsx           # Histórico
    monthly.tsx           # Resumo mensal
    settings.tsx          # Configurações
  fueling/new.tsx         # Novo abastecimento (modal)
  fueling/[id].tsx        # Editar abastecimento
  vehicle/new.tsx
  vehicle/[id].tsx
  vehicle/complete-first.tsx
src/
  domain/                 # funções puras, sem React/DB
    types.ts
    money.ts              # centavos, parse/format BRL
    plate.ts
    cycles.ts             # buildCycles
    monthly.ts            # summarizeMonth
    validation.ts         # regras da seção 7
    __tests__/
  db/
    schema.ts
    client.ts
    migrations/
  repositories/           # única camada que toca o banco
    vehicles.ts
    fuelings.ts
    segments.ts
  hooks/                  # React Query sobre os repositories
  features/backup/        # export/import
  features/notifications/
  components/
  theme/
```

A direção das dependências é `app → hooks → repositories → db` e `app/hooks → domain`. O `domain` não importa nada dessas camadas.

## 4. Modelo de dados

O modelo tem três tabelas: `vehicles`, `odometer_segments` e `fuelings`. Todas seguem as mesmas convenções, que preparam o terreno para sync futuro:

- `id`: UUID v7, texto, gerado no cliente.
- `created_at` e `updated_at`: inteiro, epoch em ms, atualizados pelo repositório.
- `deleted_at`: inteiro nulável (soft delete). Toda query de leitura filtra `deleted_at IS NULL`.
- Valores monetários ficam em inteiros: `*_cents` (centavos). O preço por litro fica em milésimos de real (`price_per_liter_milli`, ex.: R$ 5,899 = 5899).
- Litros ficam em mililitros inteiros (`liters_ml`), o que evita ponto flutuante.
- A data do abastecimento é texto `YYYY-MM-DD` (data local, sem fuso).

```ts
// src/db/schema.ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(),
  nickname: text('nickname').notNull(),
  plate: text('plate'),
  brand: text('brand'),
  model: text('model'),
  year: integer('year'),
  defaultFuel: text('default_fuel', { enum: ['gasoline', 'ethanol', 'diesel', 'cng'] }).notNull(),
  archivedAt: integer('archived_at'),
  ...timestamps,
});

// Cada veículo tem ao menos 1 segmento. "Reiniciar odômetro" cria um novo.
export const odometerSegments = sqliteTable(
  'odometer_segments',
  {
    id: text('id').primaryKey(),
    vehicleId: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    sequence: integer('sequence').notNull(), // 1, 2, 3...
    startedOn: text('started_on').notNull(), // YYYY-MM-DD
    ...timestamps,
  },
  (t) => ({ byVehicle: index('seg_vehicle_idx').on(t.vehicleId, t.sequence) }),
);

export const fuelings = sqliteTable(
  'fuelings',
  {
    id: text('id').primaryKey(),
    vehicleId: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    segmentId: text('segment_id')
      .notNull()
      .references(() => odometerSegments.id),
    date: text('date').notNull(), // YYYY-MM-DD
    odometerKm: integer('odometer_km').notNull(),
    pricePerLiterMilli: integer('price_per_liter_milli').notNull(),
    totalCents: integer('total_cents').notNull(),
    litersMl: integer('liters_ml').notNull(),
    fullTank: integer('full_tank', { mode: 'boolean' }).notNull(),
    fuelType: text('fuel_type', { enum: ['gasoline', 'ethanol', 'diesel', 'cng'] }).notNull(),
    excludeFromAverage: integer('exclude_from_average', { mode: 'boolean' })
      .notNull()
      .default(false),
    station: text('station'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => ({
    bySegmentOdo: index('fuel_seg_odo_idx').on(t.segmentId, t.odometerKm),
    byVehicleDate: index('fuel_vehicle_date_idx').on(t.vehicleId, t.date),
  }),
);
```

Notas sobre o modelo:

- `litersMl` é calculado no repositório como `round(totalCents * 10_000 / pricePerLiterMilli)`. Ele é persistido para que o arredondamento não mude retroativamente.
- `excludeFromAverage` fica no abastecimento de tanque cheio que **fecha** o ciclo e representa a marcação "ignorar ciclo".
- Para `cng` (GNV), a unidade exibida é m³ em vez de litros. O armazenamento usa o mesmo campo.
- Um mesmo segmento não pode ter dois abastecimentos ativos com o mesmo odômetro. Essa regra é validada no repositório, e não por índice único, por causa do soft delete.
- `app_meta` é uma tabela chave/valor para `schema_version`, `last_vehicle_id` e preferências de notificação.

## 5. Funções de domínio

Toda a lógica de cálculo cabe em duas funções puras, `buildCycles` e `summarizeMonth`, mais utilitários de dinheiro, placa e validação. As telas nunca recalculam nada por conta própria.

```ts
// src/domain/types.ts
export type FuelType = 'gasoline' | 'ethanol' | 'diesel' | 'cng';

export interface FuelingRecord {
  id: string;
  vehicleId: string;
  segmentId: string;
  segmentSequence: number;
  date: string; // YYYY-MM-DD
  odometerKm: number;
  pricePerLiterMilli: number;
  totalCents: number;
  litersMl: number;
  fullTank: boolean;
  fuelType: FuelType;
  excludeFromAverage: boolean;
}

export interface Cycle {
  vehicleId: string;
  openingFuelingId: string;
  closingFuelingId: string;
  closedOn: string; // data do cheio que fecha
  km: number;
  litersMl: number;
  totalCents: number;
  kmPerLiter: number; // km / (litersMl/1000)
  costPerKmCents: number; // totalCents / km
  fuelTypes: FuelType[];
  mixed: boolean;
  excluded: boolean;
  outlier: boolean; // ver seção 7
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  vehicleId: string | 'all';
  spentCents: number;
  litersMl: number;
  fuelingCount: number;
  km: number;
  kmPerLiter: number | null; // null = sem ciclos válidos
  costPerKmCents: number | null;
  avgPricePerLiterMilli: number | null;
  cyclesCount: number;
}
```

```ts
// src/domain/cycles.ts
export function buildCycles(records: FuelingRecord[]): Cycle[];
```

Algoritmo de `buildCycles` (registros de um único veículo):

1. Ordenar por `segmentSequence` e depois por `odometerKm`.
2. Percorrer cada segmento separadamente. Ao trocar de segmento, descartar o ciclo aberto.
3. Enquanto não houver um tanque cheio de abertura, ignorar registros.
4. A cada registro após a abertura, acumular `litersMl`, `totalCents` e `fuelType`.
5. Ao encontrar `fullTank = true`, fechar o ciclo com `km = odo_atual - odo_abertura`. Se `km <= 0` ou `litersMl == 0`, descartar o ciclo. O registro atual passa a ser a nova abertura.
6. `excluded = closing.excludeFromAverage`. `mixed = fuelTypes.length > 1`.
7. Calcular `outlier` contra a mediana dos ciclos válidos do mesmo veículo, com o mesmo combustível único e não excluídos. A marcação exige ao menos 3 ciclos de referência e desvio maior que 40%.

```ts
// src/domain/monthly.ts
export function summarizeMonth(
  month: string, // YYYY-MM
  records: FuelingRecord[], // já filtrados por veículo, ou todos para 'all'
  cycles: Cycle[],
  vehicleId: string | 'all',
): MonthlySummary;

export function summarizeRange(
  months: string[],
  records: FuelingRecord[],
  cycles: Cycle[],
  vehicleId: string | 'all',
): MonthlySummary[];
```

- Gasto, litros e contagem usam `records` com `date` no mês.
- Km, consumo e custo/km usam `cycles` com `closedOn` no mês e `excluded = false`.
- Com `vehicleId = 'all'`, `kmPerLiter` e `costPerKmCents` retornam `null` (regra 2.3).

```ts
// src/domain/money.ts
export function parseBRL(input: string): number | null; // "1.234,56" -> 123456
export function formatBRL(cents: number): string; // 123456 -> "R$ 1.234,56"
export function parsePriceMilli(input: string): number | null; // "5,899" -> 5899
export function formatPrice(milli: number): string; // 5899 -> "R$ 5,899"
export function litersFrom(totalCents: number, priceMilli: number): number; // -> ml

// src/domain/plate.ts
export function normalizePlate(input: string): string | null; // "abc-1d23" -> "ABC1D23"
export function formatPlate(plate: string): string;
```

## 6. Telas e fluxos

O app tem quatro abas (Início, Histórico, Resumo e Ajustes) e um modal de abastecimento acessível por um botão fixo na aba Início.

### 6.1 Início (`(tabs)/index`)

- Seletor de veículo no topo, só com 2+ veículos ativos.
- Card "Último consumo": km/l do último ciclo, com data e combustível. Se o ciclo for outlier, mostra um alerta discreto.
- Card "Média geral": km/l médio de todos os ciclos válidos do veículo, com média separada por combustível se houver mais de um.
- Card "Este mês": gasto, número de abastecimentos e litros.
- Botão grande "Registrar abastecimento".
- Estado vazio (nenhum registro): ilustração simples, o texto "Registre seu primeiro abastecimento" e o botão.
- Com apenas 1 registro, ou sem ciclo fechado: "O consumo aparece a partir do próximo tanque cheio".

### 6.2 Novo / editar abastecimento (`fueling/new`, `fueling/[id]`)

- Ordem dos campos: Veículo (condicional), Odômetro, Preço por litro, Valor total, Tanque cheio, Combustível, Data e uma seção recolhível "Mais detalhes" (Posto, Observações).
- Teclado numérico. Máscara de moeda que digita da direita para a esquerda.
- Abaixo do odômetro, a dica "Último registro: 45.230 km".
- Abaixo do valor total, os litros calculados em tempo real: "≈ 34,58 L".
- Ao salvar: valida (seção 7), persiste, invalida as queries, fecha o modal e mostra um toast com o consumo do ciclo, se ele fechou: "Consumo: 11,4 km/l".
- A edição tem a ação "Excluir", com confirmação.

### 6.3 Histórico (`(tabs)/history`)

- Lista agrupada por mês, do mais recente para o mais antigo. Cada item mostra data, odômetro, valor, litros, ícone de tanque cheio ou parcial e combustível.
- Itens que fecham ciclo mostram o km/l do ciclo, com badges "misto", "ignorado" ou "fora do padrão" quando aplicável.
- Toque no item abre a edição. Pressionar e segurar num item que fecha ciclo alterna "Ignorar na média".
- Filtro por veículo, condicional.

### 6.4 Resumo mensal (`(tabs)/monthly`)

- Navegação entre meses com setas ‹ Outubro 2026 ›. Começa no mês atual e não avança além dele.
- Métricas da seção 2.3 em cards.
- Gráfico de barras com o gasto dos últimos 6 meses. Tocar numa barra navega para o mês.
- Com 2+ veículos: segmento "Todos / Veículo A / Veículo B". Em "Todos", uma tabela mostra o gasto por veículo.
- Nota fixa: "Gasto pela data do abastecimento. Consumo pelos ciclos fechados no mês".

### 6.5 Ajustes (`(tabs)/settings`)

- Veículos: lista, adicionar, editar, arquivar, excluir e "Reiniciar odômetro" (cria um segmento, com confirmação explicativa).
- Notificação de fechamento do mês: liga/desliga (padrão ligado após o primeiro registro, pedindo permissão nesse momento).
- Backup: "Exportar dados (JSON)", "Importar dados (JSON)" e "Exportar planilha (CSV)".
- Sobre: versão do app.

### 6.6 Fluxo do segundo veículo

1. Ajustes → Adicionar veículo → formulário → Salvar.
2. Se agora existem exatamente 2 veículos ativos e o primeiro ainda tem o apelido "Meu veículo" e nenhum dado opcional, o app navega para `vehicle/complete-first`.
3. Essa tela pede o apelido do primeiro veículo, obrigatório e diferente do segundo, e os campos opcionais. Não há botão "pular" para o apelido.
4. Ao concluir, volta para a Início com o seletor visível e o novo veículo selecionado.

### 6.7 Notificação de fechamento do mês

- Uma notificação local é agendada para o dia 1 de cada mês, às 9h.
- Após cada inserção, edição ou exclusão, o app cancela e reagenda a notificação com o texto atualizado: "Outubro: você gastou R$ 487,30 em combustível". Se não houve registro no mês, não agenda nada.
- Tocar na notificação abre o Resumo no mês anterior (deep link `monthly?month=YYYY-MM`).

## 7. Validações e casos de borda

Há dois níveis de validação. Erros bloqueiam o salvamento. Avisos pedem confirmação ("Salvar mesmo assim"). As regras ficam em `src/domain/validation.ts` e são usadas pelo schema zod do formulário e pelo repositório.

| Situação                                                                                                                             | Nível                | Comportamento                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------ |
| Campo obrigatório vazio, ou valor ≤ 0                                                                                                | Erro                 | Mensagem no campo                                                  |
| Data futura                                                                                                                          | Erro                 | "A data não pode ser futura"                                       |
| Odômetro igual ao de outro registro ativo no mesmo segmento                                                                          | Erro                 | "Já existe um abastecimento com esse odômetro"                     |
| Odômetro incoerente com a data dentro do segmento (vizinho anterior por odômetro com data maior, ou vizinho seguinte com data menor) | Erro                 | Mostra os dois registros vizinhos e pede correção                  |
| Odômetro menor que o último, com data coerente (registro retroativo)                                                                 | Permitido            | Insere no meio da sequência. Os ciclos são recalculados na leitura |
| Data anterior ao início do segmento atual                                                                                            | Erro                 | "Essa data pertence a um odômetro anterior ao reinício"            |
| Preço por litro fora de R$ 2,000–R$ 15,000                                                                                           | Aviso                | Provável erro de digitação                                         |
| Litros calculados acima de 120 L                                                                                                     | Aviso                | "Volume acima do comum para um tanque"                             |
| Salto de odômetro acima de 2.000 km desde o registro anterior                                                                        | Aviso                | "Faltou registrar algum abastecimento?"                            |
| Ciclo fechado com consumo outlier (seção 5)                                                                                          | Aviso pós-salvamento | Toast com ação "Ignorar este ciclo na média"                       |

**Outros casos a tratar explicitamente:**

- **Editar ou excluir um registro antigo.** Nada é recalculado em cascata no banco. O app invalida as queries, e `buildCycles` refaz tudo na leitura.
- **Excluir o abastecimento que abre um ciclo.** O próximo tanque cheio anterior assume a abertura. Esse comportamento é natural do algoritmo e precisa ser coberto por teste.
- **Trocar o tipo de tanque cheio para parcial.** Dois ciclos se fundem em um. Precisa ser coberto por teste.
- **Reiniciar odômetro.** Cria um segmento com `startedOn = hoje`. Registros futuros vão para ele. O ciclo aberto do segmento anterior é descartado.
- **Mudança de mês.** Os limites do mês usam a data local `YYYY-MM-DD`, sem conversão de fuso.
- **Importação de backup.** Valida o JSON com zod e oferece "Substituir tudo" ou "Mesclar". A mescla é feita por `id`, com o maior `updatedAt` vencendo. A importação roda dentro de uma transação: se algo falhar, nada muda.
- **Notificação.** Além de reagendar após cada mutação, o app reagenda ao abrir. Isso cobre o caso de um mês inteiro sem registros. Se a permissão for negada, o toggle aparece desligado com uma explicação.
- **Veículo arquivado.** Não aparece no seletor do formulário, mas aparece no histórico e no resumo dos meses em que teve registros.

## 8. Tarefas em ordem

São 12 tarefas. As tarefas 1 a 4 entregam o núcleo testável sem UI. As tarefas 5 a 12 constroem o app em cima dele. Cada tarefa termina com typecheck, lint, testes verdes e um commit.

### T1 — Bootstrap do projeto

Criar o projeto Expo com TypeScript e Expo Router. Configurar ESLint, Prettier, Jest (`jest-expo`) e os scripts `typecheck`, `lint`, `test` e `db:generate`. Criar a estrutura de pastas da seção 3.

- [ ] `npx expo start` abre o app com as quatro abas vazias
- [ ] `npm run typecheck && npm run lint && npm test` passa
- [ ] `tsconfig` com `strict: true` e alias `@/` para `src/`

### T2 — Domínio: dinheiro, placa e tipos

Implementar `types.ts`, `money.ts` e `plate.ts` (seção 5).

- [ ] `parseBRL` aceita "1.234,56", "1234,56" e "1234". Rejeita texto inválido
- [ ] `litersFrom(20000, 5899)` retorna 33904 ml
- [ ] `normalizePlate` aceita os formatos antigo e Mercosul, com ou sem hífen e em minúsculas
- [ ] Cobertura de 100% de linhas nesses arquivos

### T3 — Domínio: `buildCycles`

Implementar o algoritmo da seção 5 e testar com tabelas de casos.

- [ ] Sequência simples: cheio, cheio, cheio gera 2 ciclos com valores corretos
- [ ] Parciais no meio: cheio, parcial, parcial, cheio gera 1 ciclo somando os 3 últimos registros
- [ ] Primeiros registros parciais são ignorados até o primeiro cheio
- [ ] Registros fora de ordem de inserção produzem o mesmo resultado
- [ ] Excluir o registro de abertura e trocar cheio por parcial se comportam como na seção 7
- [ ] Dois segmentos: nenhum ciclo cruza a fronteira
- [ ] Detecção de `mixed`, `excluded` e `outlier`, incluindo o mínimo de 3 ciclos de referência

### T4 — Domínio: `summarizeMonth` e validação

Implementar `monthly.ts` e `validation.ts`.

- [ ] Ciclo aberto em setembro e fechado em outubro conta em outubro
- [ ] Mês sem ciclos fechados retorna `kmPerLiter: null`, com gasto preenchido
- [ ] `vehicleId: 'all'` soma gasto, litros e km e retorna consumo `null`
- [ ] Cada linha da tabela da seção 7 tem ao menos um teste

### T5 — Banco e repositórios

Criar o schema Drizzle (seção 4), as migrations, `client.ts` e os repositórios. Os repositórios cuidam de UUID v7, timestamps, soft delete e cálculo de `litersMl`. No startup, rodar as migrations e criar o veículo implícito e seu segmento 1, se não existirem.

- [ ] Instalação limpa cria exatamente 1 veículo e 1 segmento
- [ ] Nenhuma leitura retorna registros com `deleted_at` preenchido
- [ ] Inserção usa `validation.ts` e recusa erros. Avisos só passam com `confirmWarnings: true`
- [ ] Testes de repositório rodando contra SQLite em memória

### T6 — Hooks React Query

Criar hooks como `useVehicles`, `useActiveVehicle`, `useFuelings(vehicleId)`, `useCycles(vehicleId)`, `useMonthlySummary(month, vehicleId)` e as mutações. Toda mutação invalida `fuelings`, `cycles` e `monthly`.

- [ ] `useCycles` chama `buildCycles` sobre os dados do repositório, sem SQL de cálculo
- [ ] O veículo ativo é persistido em `app_meta.last_vehicle_id`

### T7 — Formulário de abastecimento

Implementar a seção 6.2 com react-hook-form e zod.

- [ ] Litros estimados atualizam enquanto o usuário digita
- [ ] Avisos abrem um diálogo "Salvar mesmo assim"
- [ ] Toast de consumo quando o salvamento fecha um ciclo
- [ ] A edição carrega os valores e permite excluir

### T8 — Início e Histórico

Implementar as seções 6.1 e 6.3, incluindo estados vazios e badges.

- [ ] Estados de 0, 1 e 2+ registros exibem as mensagens corretas
- [ ] Pressionar e segurar alterna `excludeFromAverage` e a média se atualiza

### T9 — Resumo mensal

Implementar a seção 6.4 com o gráfico de barras.

- [ ] Navegação entre meses limitada ao mês atual
- [ ] Tocar numa barra navega para o mês correspondente
- [ ] Aceita o parâmetro de rota `month` (usado pelo deep link)

### T10 — Múltiplos veículos

Implementar as seções 2.4 e 6.6: CRUD de veículos, arquivar, reiniciar odômetro, `complete-first` e seletores condicionais.

- [ ] Com 1 veículo ativo, nenhum seletor aparece em nenhuma tela
- [ ] Ao adicionar o 2º veículo, o app leva para `complete-first`. O apelido duplicado é recusado
- [ ] Arquivar até sobrar 1 veículo volta ao modo simples
- [ ] Não é possível excluir nem arquivar o último veículo ativo

### T11 — Backup e exportação

Export JSON com `{ schemaVersion, exportedAt, vehicles, odometerSegments, fuelings }`, incluindo registros com soft delete. Import com zod e as opções Substituir ou Mesclar (seção 7). Export CSV de abastecimentos com BOM UTF-8 e separador `;` (compatível com Excel pt-BR).

- [ ] Exportar, apagar os dados do app e importar restaura o estado idêntico
- [ ] JSON inválido mostra erro e não altera nada
- [ ] O CSV abre corretamente no Excel em português

### T12 — Notificação de fechamento do mês

Implementar a seção 6.7 com o reagendamento ao abrir o app e após cada mutação.

- [ ] A permissão só é pedida após o primeiro abastecimento
- [ ] Existe no máximo 1 notificação agendada por vez
- [ ] Tocar na notificação abre o resumo do mês anterior

## 9. Testes e definição de pronto

O MVP está pronto quando o roteiro manual abaixo passa num aparelho Android e num iOS (ou simuladores), com todos os testes automatizados verdes.

**Testes automatizados**

- `src/domain`: cobertura mínima de 95% de linhas, com testes em tabela (`it.each`) para `buildCycles`, `summarizeMonth` e as validações.
- Repositórios: SQLite em memória, cobrindo soft delete, veículo implícito e unicidade de odômetro por segmento.
- Telas: um teste de renderização por tela com Testing Library, cobrindo o estado vazio e o estado com dados.

**Roteiro manual de aceite**

1. Instalação limpa. A Início mostra o estado vazio, sem nenhuma tela de cadastro.
2. Registrar cheio: 10.000 km, R$ 5,899, R$ 200,00. A Início mostra "O consumo aparece a partir do próximo tanque cheio".
3. Registrar parcial: 10.200 km, R$ 5,899, R$ 100,00.
4. Registrar cheio: 10.450 km, R$ 5,899, R$ 150,00. O toast mostra cerca de 10,6 km/l (450 km ÷ 42,38 L).
5. O Resumo do mês mostra gasto de R$ 450,00 e 450 km.
6. Editar o registro 3 para tanque cheio. O histórico passa a mostrar dois ciclos.
7. Adicionar um 2º veículo. A tela `complete-first` aparece, e os seletores ficam visíveis depois.
8. Arquivar o 2º veículo. A UI volta ao modo simples.
9. Exportar JSON, limpar os dados do app, importar e conferir que tudo voltou igual.
10. Avançar a data do aparelho para o dia 1 do mês seguinte e conferir a notificação com o valor correto e o deep link.

## 10. Fora do escopo do MVP

Não implemente nada desta lista agora. O schema da seção 4 já deixa o caminho aberto para esses itens.

| Item                                                                                       | Fase   | Dependência no MVP                 |
| ------------------------------------------------------------------------------------------ | ------ | ---------------------------------- |
| Sync com backend Laravel (`pull since` / `push changes`, last-write-wins por `updated_at`) | 2      | UUID v7, timestamps, soft delete   |
| Login e veículos compartilhados (`vehicle_members`)                                        | 2      | Sync                               |
| Comparador etanol × gasolina na bomba, usando o consumo real de cada combustível           | 1.2    | Médias por combustível (seção 6.1) |
| Widget de tela inicial                                                                     | 1.2    | —                                  |
| Leitura de cupom fiscal ou QR Code da NFC-e                                                | Futuro | —                                  |
| Outros custos do veículo (manutenção, IPVA, seguro)                                        | Futuro | —                                  |
| Tema escuro customizado (além do automático do sistema)                                    | Futuro | —                                  |
