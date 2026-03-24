# Implementation Plan: Trip Comparison

## Overview

Implementação da funcionalidade de comparação de viagens lado a lado na página `Trips.tsx`. A abordagem é inteiramente frontend — sem novos endpoints — reutilizando `tripsAPI.getTelemetry` e `tripsAPI.getEvaluation`. A `ComparisonView` é renderizada como overlay de ecrã completo dentro de `Trips.tsx`, preservando o estado da lista ao fechar.

## Tasks

- [x] 1. Criar funções utilitárias puras em `tripComparison.ts`
  - Criar `app/frontend/src/utils/tripComparison.ts` com as seguintes funções:
    - `normalizeTelemetryToPercent(points: TripTelemetryPoint[]): NormalizedSpeedPoint[]` — normaliza eixo X para [0, 100]
    - `calcAvgSpeed(points: NormalizedSpeedPoint[]): number` — média aritmética dos valores `speed`
    - `compareValues(a: number | null, b: number | null): "A" | "B" | "tie" | "none"` — retorna o vencedor
    - `formatDiff(a: number | null, b: number | null, unit: string): string` — diferença absoluta formatada
    - `scoreStyle(score: number): { bg: string; color: string }` — reutiliza lógica existente de `Trips.tsx`
  - Exportar também as interfaces `NormalizedSpeedPoint`, `TripComparisonData`, `ListStateSnapshot`
  - _Requirements: 4.2, 4.6, 5.2, 5.3, 5.5, 7.3, 7.5_

  - [x] 1.1 Escrever property test para `normalizeTelemetryToPercent`
    - Instalar `fast-check` como devDependency: `npm install --save-dev fast-check`
    - Criar `app/frontend/src/utils/tripComparison.property.test.ts`
    - **Property 7: Normalização do eixo X para [0, 100]**
    - **Validates: Requirements 4.2**

  - [x] 1.2 Escrever property test para `compareValues`
    - **Property 9: Destaque do vencedor é correto**
    - **Validates: Requirements 5.2, 6.4, 7.3**

  - [x] 1.3 Escrever property test para `scoreStyle`
    - **Property 11: Codificação de cor de score**
    - **Validates: Requirements 5.5**

  - [x] 1.4 Escrever property test para `calcAvgSpeed`
    - **Property 8: Velocidade média de referência é a média aritmética**
    - **Validates: Requirements 4.6**

  - [x] 1.5 Escrever property test para `formatDiff`
    - **Property 10: Diferença absoluta é correta**
    - **Validates: Requirements 5.3, 7.5**

- [x] 2. Criar componente `CompareBar`
  - Criar `app/frontend/src/components/trips/CompareBar.tsx`
  - Implementar `CompareBarProps`: `selectedCount`, `onClear`, `onCompare`
  - Barra flutuante (position fixed, bottom) visível quando `selectedCount >= 1`
  - Botão "Comparar Viagens" ativo apenas quando `selectedCount === 2`
  - Mostrar contador "X de 2 selecionadas" e mensagem informativa quando `selectedCount === 2`
  - Botão "Limpar" para desselecionar todas
  - Acessível por teclado (focus, aria-disabled)
  - _Requirements: 1.2, 1.3, 1.4_

  - [x] 2.1 Escrever property test para lógica de ativação do botão Comparar
    - **Property 2: Botão Comparar ativo apenas com 2 selecionadas**
    - **Validates: Requirements 1.4**

- [x] 3. Adicionar estado de seleção e `CompareCheckbox` a `Trips.tsx` e `TripListCard`
  - Adicionar estado em `Trips.tsx`:
    - `selectedForComparison: string[]` (máx 2)
    - `comparisonOpen: boolean`
    - `listStateSnapshot: ListStateSnapshot | null`
  - Implementar handlers: `handleCompareToggle(tripId)`, `handleOpenComparison()`, `handleCloseComparison()`
  - `handleCompareToggle`: ignora seleção se já há 2 e a viagem não é uma delas (Property 1)
  - `handleOpenComparison`: guarda snapshot do estado atual antes de abrir
  - `handleCloseComparison`: restaura estado a partir do snapshot
  - Adicionar checkbox de seleção inline no `TripListCard` (visível apenas na vista Lista)
  - Checkbox desativada (`disabled`) quando já há 2 selecionadas e esta não é uma delas
  - Destacar visualmente o cartão quando selecionado
  - Renderizar `<CompareBar>` dentro de `Trips.tsx` quando `view === "LIST"`
  - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 2.2_

  - [x] 3.1 Escrever property test para limite de seleção
    - **Property 1: Limite de seleção**
    - **Validates: Requirements 1.3**

  - [x] 3.2 Escrever property test para toggle round-trip
    - **Property 3: Toggle de seleção é round-trip**
    - **Validates: Requirements 1.6**

- [x] 4. Checkpoint — Verificar seleção e CompareBar
  - Garantir que a checkbox aparece em cada cartão na vista Lista
  - Garantir que a `CompareBar` aparece ao selecionar 1 viagem e ativa o botão ao selecionar 2
  - Garantir que selecionar uma 3ª viagem é ignorado
  - Garantir que desselecionar funciona corretamente
  - Garantir que todos os testes passam, perguntar ao utilizador se surgirem dúvidas.

- [x] 5. Criar componente `OverlaySpeedChart`
  - Criar `app/frontend/src/components/trips/OverlaySpeedChart.tsx`
  - Implementar `OverlaySpeedChartProps`: `seriesA`, `seriesB`, `labelA`, `labelB`, `avgSpeedA`, `avgSpeedB`
  - Usar Recharts `LineChart` com duas `Line` (cores distintas) e eixo X normalizado [0%, 100%]
  - Adicionar `ReferenceLine` horizontal para velocidade média de cada série
  - Adicionar `Legend` e `Tooltip` com valores de velocidade de cada série
  - Renderizar apenas a série disponível se uma for `null`, com nota textual
  - Mostrar mensagem "Sem dados de telemetria" se ambas as séries forem `null` ou vazias
  - Incluir `<AccessibleDataTable>` como alternativa textual (tabela oculta visualmente, acessível por screen reader)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.4_

- [x] 6. Criar componente `ComparisonView`
  - Criar `app/frontend/src/components/trips/ComparisonView.tsx`
  - Implementar `ComparisonViewProps`: `tripIds: [string, string]`, `trips: Trip[]`, `onClose: () => void`
  - Gerir internamente `TripComparisonData` para cada viagem (telemetry + evaluation)
  - Carregar dados em paralelo com `Promise.all([getTelemetry, getEvaluation])` para ambas as viagens com `?limit=500`
  - Mostrar spinner por secção enquanto carrega
  - Renderizar as seguintes sub-secções:
    - **ComparisonHeader**: nome da mota + data de início de cada viagem + botão fechar
    - **TripStatsRow**: distância, duração, vel. média, vel. máxima lado a lado com destaque do vencedor e diferença absoluta
    - **ScoresRow**: heurístico e ML lado a lado com destaque do vencedor, diferença e "N/D" para ML nulo
    - **OverlaySpeedChart**: gráfico de velocidade sobreposto
    - **EventSummaryRow**: contagens por severidade (INFO/WARNING/CRITICAL) e por tipo lado a lado
  - Overlay de ecrã completo (position fixed, z-index alto), sem nova rota
  - Layout responsivo: colunas paralelas em desktop, empilhado em mobile (< 768px)
  - Botão fechar acessível por teclado (Escape key listener)
  - Mostrar mensagem de erro + botão fechar se uma viagem não existir (404/403)
  - _Requirements: 2.1, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3_

  - [x] 6.1 Escrever testes unitários para `ComparisonView`
    - Criar `app/frontend/src/components/trips/ComparisonView.test.tsx`
    - Testar renderização inicial com dados mock
    - Testar estado de loading e erro em cada secção
    - Testar comportamento do botão fechar e restauração de estado
    - Testar casos extremos: ML score nulo, telemetria vazia, zero eventos
    - _Requirements: 2.4, 3.3, 3.4, 5.4, 6.5_

  - [x] 6.2 Escrever property test para cabeçalho da ComparisonView
    - **Property 5: Cabeçalho contém identificadores das duas viagens**
    - **Validates: Requirements 2.3**

  - [x] 6.3 Escrever property test para limite de pontos de telemetria
    - **Property 6: Limite de 500 pontos de telemetria**
    - **Validates: Requirements 3.5**

  - [x] 6.4 Escrever property test para restauração de estado ao fechar
    - **Property 4: Fechar restaura estado da lista**
    - **Validates: Requirements 2.2**

  - [x] 6.5 Escrever property test para Event Summary
    - **Property 12: Event summary exibe contagens corretas**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 6.6 Escrever property test para Trip Stats
    - **Property 13: Trip stats exibe as quatro métricas**
    - **Validates: Requirements 7.2**

- [x] 7. Integrar `ComparisonView` em `Trips.tsx`
  - Renderizar `<ComparisonView>` condicionalmente quando `comparisonOpen === true`
  - Passar `tripIds`, `trips` e `onClose={handleCloseComparison}` como props
  - Garantir que fechar a `ComparisonView` restaura o snapshot do estado da lista
  - _Requirements: 2.1, 2.2_

- [x] 8. Adicionar estilos CSS em `App.css`
  - Adicionar estilos para `.compare-checkbox`, `.trip-card-v2.compare-selected`
  - Adicionar estilos para `.compare-bar` (barra flutuante)
  - Adicionar estilos para `.comparison-overlay` (overlay ecrã completo)
  - Adicionar estilos para `.comparison-header`, `.comparison-section`, `.comparison-cols`
  - Adicionar media query `@media (max-width: 768px)` para layout empilhado
  - Garantir rácios de contraste ≥ 4.5:1 nas cores de destaque
  - _Requirements: 8.1, 8.3_

- [x] 9. Checkpoint final — Verificar comparação completa
  - Garantir que abrir a comparação carrega dados em paralelo para ambas as viagens
  - Garantir que o gráfico de velocidade sobreposto renderiza corretamente
  - Garantir que scores, eventos e stats são exibidos lado a lado com destaque correto
  - Garantir que fechar restaura filtros, página e seleções da lista
  - Garantir que todos os testes passam, perguntar ao utilizador se surgirem dúvidas.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser ignoradas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- `fast-check` deve ser adicionado como devDependency antes de escrever os property tests
- A função `scoreStyle` em `tripComparison.ts` deve replicar a lógica já existente em `Trips.tsx` (verde ≥ 80, amarelo ≥ 60, vermelho < 60)
- O parâmetro `?limit=500` deve ser passado na chamada a `tripsAPI.getTelemetry`
- Nenhum novo endpoint de backend é necessário
- A `ComparisonView` não usa React Router — é um overlay dentro de `Trips.tsx`
