# Tasks — Demo Mode

## Task List

- [x] 1. Criar DemoContext e Provider
  - [x] 1.1 Criar `src/demo/DemoContext.tsx` com `DemoContextValue`, `DemoProvider` e `useDemoContext` hook
  - [x] 1.2 Implementar `activateDemo()`: escreve `"true"` em `sessionStorage["demo_mode"]` e navega para `/dashboard`
  - [x] 1.3 Implementar `exitDemoMode()`: remove `sessionStorage["demo_mode"]`, para o emitter e navega para `/`
  - [x] 1.4 Inicializar `isDemoMode` lendo `sessionStorage` no mount do Provider
  - [x] 1.5 Expor `demoUser` com `{ id: "demo-user-001", name: "Demo User", email: "demo@motoguard.demo" }`
  - [x] 1.6 Envolver `App.tsx` com `DemoProvider` (dentro de `AuthProvider`, fora de `Router`)

- [x] 2. Criar demoData.ts com dados pré-gravados
  - [x] 2.1 Criar `src/demo/demoData.ts` com 2 motas tipadas como `Motorcycle`
  - [x] 2.2 Adicionar 5 viagens tipadas como `Trip` (estados: 4 COMPLETED + 1 ACTIVE, fontes variadas)
  - [x] 2.3 Adicionar 5 `TripFeedItem` correspondentes às viagens (1:1)
  - [x] 2.4 Adicionar ≥50 pontos de telemetria por viagem como `Record<string, TripTelemetryPoint[]>`
  - [x] 2.5 Adicionar 3 alertas com severidades INFO, WARNING e CRITICAL
  - [x] 2.6 Garantir que todas as viagens COMPLETED têm `startedAt < endedAt` e `distanceKm > 0`
  - [x] 2.7 Adicionar `demoEvaluation` para endpoint `/trips/:id/evaluation`

- [x] 3. Implementar DemoAPIInterceptor
  - [x] 3.1 Criar `src/demo/demoAPIInterceptor.ts` com função `setupDemoInterceptor(isDemoMode: () => boolean): () => void`
  - [x] 3.2 Intercetар `GET /api/motorcycles` → retornar `demoMotorcycles`
  - [x] 3.3 Intercetар `GET /api/trips` → retornar `demoTrips`
  - [x] 3.4 Intercetар `GET /api/trips/feed` → retornar `demoFeedItems`
  - [x] 3.5 Intercetар `GET /api/trips/:id` → retornar trip correspondente ou 404 simulado
  - [x] 3.6 Intercetар `GET /api/telemetry/:tripId` → retornar `demoTelemetry[tripId]`
  - [x] 3.7 Intercetар `GET /api/trips/:id/evaluation` → retornar `demoEvaluation`
  - [x] 3.8 Intercetар `POST|PUT|DELETE *` → retornar `{ success: true }` com status 200
  - [x] 3.9 Fallback para endpoints GET não mapeados → retornar `{}` com status 200
  - [x] 3.10 Registar o interceptor no `DemoProvider` e remover no cleanup

- [x] 4. Implementar DemoSocketEmitter
  - [x] 4.1 Criar `src/demo/demoSocketEmitter.ts` com classe `DemoSocketEmitter extends EventEmitter`
  - [x] 4.2 Implementar `start()`: emite `connect` e `status` imediatamente, inicia intervalo de 1500ms para `telemetry_update`
  - [x] 4.3 Implementar variação de telemetria com oscilação (seno/cosseno + ruído) para `speed_kmh`, `rpm`, `roll_deg`, `g_force`
  - [x] 4.4 Emitir `trip_started` após 3000ms do `start()`
  - [x] 4.5 Implementar `stop()`: limpa todos os intervalos e timeouts; idempotente
  - [x] 4.6 Modificar `useSocket.ts` para usar `DemoSocketEmitter` quando `isDemoMode === true`

- [x] 5. Criar DemoBanner component
  - [x] 5.1 Criar `src/demo/DemoBanner.tsx` que retorna `null` quando `!isDemoMode`
  - [x] 5.2 Renderizar banner com fundo âmbar, texto "Modo Demo — dados simulados" e botão "Sair do Modo Demo"
  - [x] 5.3 Botão chama `exitDemoMode()` do `useDemoContext()`
  - [x] 5.4 Inserir `<DemoBanner />` no wrapper de rotas protegidas em `App.tsx` (dentro do `OnboardingGuard`)

- [x] 6. Integrar com OnboardingGuard
  - [x] 6.1 Importar `useDemoContext` em `OnboardingGuard.tsx`
  - [x] 6.2 Adicionar early return: `if (isDemoMode) return <>{children ?? <Outlet />}</>`  antes da lógica de verificação existente

- [x] 7. Integrar com HomePage
  - [x] 7.1 Importar `useDemoContext` em `HomePage.tsx`
  - [x] 7.2 Adicionar botão "🎮 Explorar em Modo Demo" no modal de demo existente
  - [x] 7.3 Handler do botão: `activateDemo()` + `setIsDemoOpen(false)`

- [x] 8. Testes unitários e de propriedade
  - [x] 8.1 Criar `src/demo/__tests__/DemoContext.test.tsx` — testes de ativação/desativação e sessionStorage
  - [x] 8.2 Criar `src/demo/__tests__/DemoBanner.test.tsx` — renderização condicional e botão de saída
  - [x] 8.3 Criar `src/demo/__tests__/demoData.test.ts` — propriedades 3, 4, 11, 12 com fast-check
  - [x] 8.4 Criar `src/demo/__tests__/demoAPIInterceptor.test.ts` — propriedades 5 e 6
  - [x] 8.5 Criar `src/demo/__tests__/demoSocketEmitter.test.ts` — propriedades 7 e 8 com fake timers
  - [x] 8.6 Atualizar `OnboardingGuard.test.tsx` — adicionar caso de teste para `isDemoMode=true` (propriedade 2)
