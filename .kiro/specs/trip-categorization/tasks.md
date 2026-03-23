# Tasks — Trip Categorization

## Task List

- [x] 1. Migração Prisma e schema
  - [x] 1.1 Adicionar enum `TripCategory` ao `schema.prisma` com valores `COMMUTE`, `WEEKEND_RIDE`, `TRACK_DAY`, `OFF_ROAD`
  - [x] 1.2 Adicionar campos `category TripCategory?` e `categoryConfidence Float?` ao modelo `Trip` no `schema.prisma`
  - [x] 1.3 Gerar e aplicar migração Prisma (`prisma migrate dev`) com nome descritivo (ex: `add_trip_category`)
  - [x] 1.4 Verificar que viagens existentes mantêm `category = null` após a migração

- [x] 2. Serviço de categorização backend (`trip-categorization.service.ts`)
  - [x] 2.1 Criar `app/backend/src/services/trip-categorization.service.ts` com o tipo `TripCategory` e a interface `CategorizationInput` / `CategorizationResult`
  - [x] 2.2 Implementar a função pura `categorizeTrip(input)` com as regras de classificação dos Requisitos 2.1–2.4, normalização por perfil (Req 1.3) e lógica de prioridade (Req 2.5)
  - [x] 2.3 Implementar o cálculo do score de confiança (proporção de condições satisfeitas; fallback `0.3` quando nenhum critério é satisfeito)
  - [x] 2.4 Implementar `categorizeTripById(tripId, userId)` que lê a viagem do Prisma, invoca `categorizeTrip` e persiste `category` + `categoryConfidence`
  - [x] 2.5 Implementar `reclassifyAllUnategorized()` que processa em lote todas as viagens `COMPLETED` com `category = null` e devolve `{ processed, errors }`

- [x] 3. Integração no fluxo de conclusão de viagem
  - [x] 3.1 Identificar o ponto onde uma viagem transita para `COMPLETED` (verificar `trip.controller.ts` e serviços relacionados)
  - [x] 3.2 Invocar `categorizeTripById` após a transição para `COMPLETED`, de forma não-bloqueante (fire-and-forget com log de erro)

- [x] 4. Endpoint de recategorização (`POST /trips/:id/categorize`)
  - [x] 4.1 Adicionar handler `categorizeTripHandler` em `trip.controller.ts` que valida ownership (404 se não encontrado ou não pertence ao utilizador) e invoca `categorizeTripById`
  - [x] 4.2 Registar a rota `POST /api/trips/:id/categorize` no ficheiro de rotas correspondente

- [x] 5. Exposição da categoria na API
  - [x] 5.1 Atualizar `buildTripFeedItem` em `trip-feed.service.ts` para incluir `category` e `categoryConfidence` no `TripFeedItem` devolvido
  - [x] 5.2 Atualizar a query Prisma em `listTripFeed` (`trip.controller.ts`) para selecionar os campos `category` e `categoryConfidence` da viagem
  - [x] 5.3 Atualizar `getTrip` (`trip.controller.ts`) para incluir `category` e `categoryConfidence` na resposta de detalhe

- [x] 6. Tipagem TypeScript frontend (`app/frontend/src/types/index.ts`)
  - [x] 6.1 Adicionar `export type TripCategory = "COMMUTE" | "WEEKEND_RIDE" | "TRACK_DAY" | "OFF_ROAD"`
  - [x] 6.2 Adicionar campos opcionais `category?: TripCategory | null` e `categoryConfidence?: number | null` à interface `Trip`
  - [x] 6.3 Adicionar campos opcionais `category?: TripCategory | null` e `categoryConfidence?: number | null` à interface `TripFeedItem`

- [x] 7. Componente `TripCategoryBadge` (frontend)
  - [x] 7.1 Criar `app/frontend/src/components/trips/TripCategoryBadge.tsx` com props `{ category, confidence? }`
  - [x] 7.2 Implementar mapeamento categoria → rótulo PT (`COMMUTE` → "Urbana", `WEEKEND_RIDE` → "Passeio", `TRACK_DAY` → "Pista", `OFF_ROAD` → "Todo-o-Terreno")
  - [x] 7.3 Implementar mapeamento categoria → cor (`COMMUTE` → azul, `WEEKEND_RIDE` → verde, `TRACK_DAY` → laranja, `OFF_ROAD` → castanho)
  - [x] 7.4 Implementar estilo de baixa confiança quando `confidence < 0.5` (opacidade reduzida + ícone de interrogação)
  - [x] 7.5 Garantir que o componente não renderiza nada quando `category` é nulo

- [x] 8. Integração do badge no frontend
  - [x] 8.1 Adicionar `TripCategoryBadge` ao `TripFeedCard` em `Trips.tsx`, junto aos badges de status e source
  - [x] 8.2 Adicionar `TripCategoryBadge` ao `TripListCard` em `Trips.tsx`, visível quando a card está expandida ou junto às métricas principais
  - [x] 8.3 Adicionar `TripCategoryBadge` à página `TripDetail.tsx`, junto às métricas principais (tile-grid)

- [x] 9. Testes de propriedade (PBT) — backend
  - [x] 9.1 Criar ficheiro de testes `app/backend/src/services/trip-categorization.service.test.ts` com fast-check
  - [x] 9.2 Implementar Property 1: output é sempre uma categoria válida (para qualquer input arbitrário)
  - [x] 9.3 Implementar Property 2: score de confiança está sempre em [0.0, 1.0]
  - [x] 9.4 Implementar Property 3: normalização por perfil é invariante à escala
  - [x] 9.5 Implementar Property 4: regras de classificação por categoria (COMMUTE, WEEKEND_RIDE, TRACK_DAY, OFF_ROAD)
  - [x] 9.6 Implementar Property 5: prioridade de desempate é determinística

- [x] 10. Testes de propriedade (PBT) — frontend
  - [x] 10.1 Criar ficheiro de testes `app/frontend/src/components/trips/TripCategoryBadge.test.tsx`
  - [x] 10.2 Implementar Property 7: badge renderiza rótulo e cor corretos para cada categoria
  - [x] 10.3 Implementar Property 8: badge de baixa confiança aplica estilo visual distinto

- [x] 11. Testes unitários complementares
  - [x] 11.1 Testar `categorizeTrip` com `distanceKm = null` e `avgSpeedKmh = null` → `confidence = 0.0`
  - [x] 11.2 Testar `categorizeTrip` sem perfil (limiares absolutos)
  - [x] 11.3 Testar endpoint `POST /trips/:id/categorize` com ID inválido → HTTP 404
  - [x] 11.4 Testar `TripCategoryBadge` com `category = null` → não renderiza nada
