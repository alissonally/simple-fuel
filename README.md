# Controle de Combustível

App Android/iOS para registrar abastecimentos e acompanhar consumo (km/l) e gasto mensal. Funciona 100% offline, com dados locais em SQLite.

## Fluxo de uso

```
Início ──► Registrar abastecimento ──► Salvar ──► toast "Consumo: 11,4 km/l"
  │
  ├─ Histórico ──► tocar no item: editar/excluir
  │              └► segurar no item: ignorar o ciclo na média
  ├─ Resumo ────► gasto e consumo do mês + gráfico dos últimos 6 meses
  └─ Ajustes ───► veículos, notificação, backup
```

### 1. Primeiro uso
O app cria o veículo **"Meu veículo"** (gasolina) e abre na Início. Não há cadastro inicial.

### 2. Registrar abastecimento
Campos: odômetro, preço/litro, valor total, tanque cheio, combustível, data e, em "Mais detalhes", posto e observações.
- O preço vem preenchido com o último preço do mesmo combustível.
- Os litros são calculados ao digitar o valor (`≈ 34,58 L`).
- Valores suspeitos (salto grande de km, preço fora da faixa, litros demais) pedem confirmação antes de salvar.

### 3. Consumo (método tanque cheio)
- Um **ciclo** vai de um tanque cheio até o próximo.
- `km/l = km rodados ÷ litros abastecidos no ciclo`. Abastecimentos parciais entram na soma, mas não fecham ciclo.
- O consumo aparece a partir do **2º tanque cheio**.
- Badges no histórico: **misto** (mais de um combustível no ciclo), **fora do padrão** (consumo muito diferente da mediana) e **ignorado** (fora das médias).

### 4. Resumo mensal
Navegue entre meses com `‹ ›`. Mostra gasto, litros, km, consumo médio, custo/km e preço médio. O gasto conta pela data do abastecimento; o consumo, pelos ciclos fechados no mês.

### 5. Vários veículos
Ajustes → **Adicionar veículo**. No 2º veículo, o app pede para nomear o primeiro. A partir daí, aparece um seletor de veículo na Início, no formulário, no Histórico e no Resumo.
Também em Ajustes: editar, arquivar, excluir e **reiniciar odômetro** (ex.: troca de painel).

### 6. Notificação de fim de mês
Todo dia 1, às 9h: *"Outubro: você gastou R$ 487,30 em combustível"*. Tocar na notificação abre o Resumo do mês anterior.

### 7. Backup
Ajustes → exportar/importar **JSON** (backup completo) ou exportar **CSV** (planilha).

## Desenvolvimento

**Stack:** Expo SDK 58 · Expo Router · expo-sqlite + Drizzle · React Query · react-hook-form + zod

```bash
npm install
npx expo start           # dev server (Expo Go)
npm run android          # development build local
npm test                 # testes (Jest)
npx tsc --noEmit         # typecheck
npx expo lint            # lint
```

> As notificações não funcionam no Expo Go. Para testá-las, use uma development build.

### Gerar APK

```bash
npx eas-cli@latest build --platform android --profile preview
```

O EAS gera um `.apk` instalável e mostra o link de download no fim. O perfil `production` gera um AAB para a Play Store.

### Estrutura

```
app/            rotas (Expo Router): (tabs), fueling/, vehicle/
src/domain/     regras puras: ciclos, resumo mensal, validação, formatação
src/db/         schema Drizzle, migrations, bootstrap
src/repositories/  leitura e escrita no banco
src/hooks/      React Query
src/features/   formulários, backup, notificações
src/components/ UI compartilhada
docs/plano.md   especificação completa
DECISIONS.md    decisões técnicas
```
