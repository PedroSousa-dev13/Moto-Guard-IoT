# Design Document — Demo Mode

## Overview

O Demo Mode é uma camada de simulação puramente frontend que permite explorar a aplicação MotoGuard IoT sem qualquer dependência externa ativa. Quando ativado, substitui todas as fontes de dados reais (API REST, Socket.IO) por equivalentes locais que servem dados pré-gravados coerentes.

O design assenta em três pilares:
1. **Estado global** via React Context (`DemoContext`) persistido em `sessionStorage`
2. **Intercetação de dados** via axios interceptor e EventEmitter local
3. **Integração não-invasiva** com os componentes existentes (`OnboardingGuard`, `HomePage`, `useSocket`)

A abordagem escolhida evita modificar a lógica de negócio existente — os componentes continuam a consumir as mesmas APIs e hooks, sendo a camada demo transparente para eles.

---

## Architecture

```mermaid
graph TD
    subgraph "Ativação"
        HP[HomePage] -->|clica "Explorar em Modo Demo"| DC[DemoContext.activateDemo]
        DC -->|sessionStorage.setItem| SS[(sessionStorage)]
        DC -->|navigate /dashboard| Router
    end

    subgraph "Camada Demo"
        DD[demoData.ts] -->|fornece dados| DAI[DemoAPIInterceptor]
        DD -->|fornece telemetria| DSE[DemoSocketEmitter]
        DC -->|isDemoMode| DAI
        DC -->|isDemoMode| DSE
    end

    subgraph "Componentes Existentes"
        DAI -->|axios response| API[services/api.ts]
        DSE -->|eventos sintéticos| US[useSocket hook]
        OG[OnboardingGuard] -->|lê isDemoMode| DC
        DB[DemoBanner] -->|lê isDemoMode| DC
    end

    subgraph "Saída"
        DB -->|clica "Sair"| DC2[DemoContext.exitDemoMode]
        DC2 -->|sessionStorage.removeItem| SS
        DC2 -->|navigate /| Router
        DC2 -->|stop| DSE
    end
```

### Fluxo de dados em modo demo

```
HomePage click
  → DemoContext.activateDemo()
    → sessionStorage.set("demo_mode", "true")
    → navigate("/dashboard")
      → OnboardingGuard lê isDemoMode=true → bypass check
      → DemoBanner renderiza
      → Dashboard monta useSocket
        → DemoSocketEmitter.start() emite telemetria a cada 1500ms
      → Trips monta → axios GET /api/trips
        → DemoAPIInterceptor interceta → retorna demoTrips
```

---

## Components and Interfaces

### DemoContext

Contexto React que centraliza o estado do modo demo e as funções de controlo.

```typescript
// src/context/DemoContext.tsx

interface DemoContextValue {
  isDemoMode: boolean;
  activateDemo: () => void;
  exitDemoMode: () => void;
  demoUser: DemoUser;
}

interface DemoUser {
  id: string;          // "demo-user-001"
  name: string;        // "Demo User"
  email: string;       // "demo@motoguard.demo"
}

const DEMO_SESSION_KEY = "demo_mode";
```

O provider lê `sessionStorage` na inicialização para restaurar o estado entre navegações na mesma sessão. Expõe o contexto via `useDemoContext()` hook.

### demoData.ts

Módulo estático com todos os dados pré-gravados. Exporta objetos tipados que satisfazem as interfaces de `types/index.ts`.

```typescript
// src/demo/demoData.ts

export const demoMotorcycles: Motorcycle[]         // 2 motas
export const demoTrips: Trip[]                     // 5 viagens
export const demoFeedItems: TripFeedItem[]         // 5 feed items (1:1 com trips)
export const demoTelemetry: Record<string, TripTelemetryPoint[]>  // keyed by tripId, ≥50 pts each
export const demoAlerts: Alert[]                   // 3 alertas (INFO, WARNING, CRITICAL)
export const demoAnalytics: DemoAnalyticsData      // dados para página Analytics
export const DEMO_USER: DemoUser
```

### DemoAPIInterceptor

Axios request interceptor registado no `api` instance de `services/api.ts`. Ativo apenas quando `isDemoMode === true`.

```typescript
// src/demo/demoAPIInterceptor.ts

// Padrões de URL intercetados:
// GET  /api/motorcycles          → demoMotorcycles
// GET  /api/trips                → demoTrips
// GET  /api/trips/feed           → demoFeedItems
// GET  /api/trips/:id            → demoTrips.find(t => t.id === id)
// GET  /api/telemetry/:tripId    → demoTelemetry[tripId]
// GET  /api/trips/:id/evaluation → demoEvaluation
// POST|PUT|DELETE *              → { success: true }
// GET  * (não mapeado)           → {}  (status 200)

function setupDemoInterceptor(isDemoMode: () => boolean): () => void
// retorna função de cleanup que remove o interceptor
```

O interceptor usa `axios.interceptors.request.use` para cancelar o request real e retornar uma `Promise` resolvida com dados simulados via `axios.defaults.adapter` ou `CanceledError` com dados injetados. A abordagem recomendada é usar um **response interceptor** que deteta requests demo e resolve com dados mock antes de chegar à rede.

### DemoSocketEmitter

EventEmitter local que replica a interface de eventos do Socket.IO usada pelo `useSocket` hook. Não usa Socket.IO real.

```typescript
// src/demo/demoSocketEmitter.ts

class DemoSocketEmitter extends EventEmitter {
  start(): void    // inicia intervalos de emissão
  stop(): void     // limpa todos os intervalos
}

// Eventos emitidos (mesmos nomes que o socket real):
// "connect"          → imediato ao start()
// "status"           → { mqttConnected: true, hasData: true, telemetryCount: 0 }
// "telemetry_update" → TelemetryPayload com variação a cada 1500ms
// "trip_started"     → após 3000ms
```

A variação de telemetria usa funções de oscilação simples (seno/cosseno + ruído) para simular movimento realista sem ser completamente aleatório.

### DemoBanner

Componente React persistente exibido em todas as páginas protegidas quando `isDemoMode === true`.

```typescript
// src/demo/DemoBanner.tsx

export default function DemoBanner(): JSX.Element | null
// Renderiza null se !isDemoMode
// Renderiza banner âmbar com texto + botão "Sair do Modo Demo"
```

O banner é inserido no `Layout.tsx` (ou no wrapper de rotas protegidas em `App.tsx`) para garantir presença em todas as páginas.

### Integração com OnboardingGuard

O `OnboardingGuard` recebe `isDemoMode` via `useDemoContext()`. Quando `true`, renderiza imediatamente os filhos sem chamar `motorcyclesAPI.getAll()`.

```typescript
// Modificação mínima em OnboardingGuard.tsx:
const { isDemoMode } = useDemoContext();
if (isDemoMode) return <>{children ?? <Outlet />}</>;
```

### Integração com HomePage

O botão "Ver Demonstração" existente abre o modal de passos técnicos. É adicionado um novo botão "Explorar em Modo Demo" que chama `activateDemo()`.

```typescript
// Modificação em HomePage.tsx:
const { activateDemo } = useDemoContext();

// No JSX do modal de demo:
<button onClick={() => { activateDemo(); setIsDemoOpen(false); }}>
  🎮 Explorar em Modo Demo
</button>
```

### Integração com useSocket

O hook `useSocket` é modificado para detetar `isDemoMode` e usar o `DemoSocketEmitter` em vez do Socket.IO real.

```typescript
// Modificação em useSocket.ts:
const { isDemoMode } = useDemoContext();

useEffect(() => {
  if (isDemoMode) {
    const emitter = new DemoSocketEmitter();
    emitter.start();
    emitter.on("telemetry_update", (data) => { /* mesma lógica */ });
    // ...
    return () => emitter.stop();
  }
  // lógica Socket.IO existente...
}, [isDemoMode]);
```

---

## Data Models

### Motas Demo

```typescript
// demoMotorcycles[0]
{
  id: "demo-moto-001",
  userId: "demo-user-001",
  name: "Honda CB650R Demo",
  brand: "Honda",
  model: "CB650R",
  year: 2023,
  category: "naked",
  plate: "DEMO-01",
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2024-01-15T10:00:00Z",
}

// demoMotorcycles[1]
{
  id: "demo-moto-002",
  userId: "demo-user-001",
  name: "Yamaha MT-07 Demo",
  brand: "Yamaha",
  model: "MT-07",
  year: 2022,
  category: "naked",
  plate: "DEMO-02",
  createdAt: "2024-01-10T09:00:00Z",
  updatedAt: "2024-01-10T09:00:00Z",
}
```

### Viagens Demo

5 viagens com estados e fontes variados:

| id | status | source | distanceKm | safetyScore |
|---|---|---|---|---|
| demo-trip-001 | COMPLETED | DEVICE_REAL | 42.3 | 87 |
| demo-trip-002 | COMPLETED | SIMULATOR | 18.7 | 62 |
| demo-trip-003 | COMPLETED | GPX_IMPORTED | 95.1 | 91 |
| demo-trip-004 | COMPLETED | SIMULATOR | 7.2 | 45 |
| demo-trip-005 | ACTIVE | DEVICE_REAL | 12.4 | 78 |

Cada viagem inclui `events` com pelo menos 1 evento de risco (tipos variados: `HARD_BRAKING`, `EXCESSIVE_LEAN`, `SPEEDING`).

### Telemetria Demo

Por viagem: array de ≥50 `TripTelemetryPoint` com timestamps espaçados de 5s. Valores gerados com oscilação realista:
- `speed_kmh`: 0–140 km/h (curva de aceleração/desaceleração)
- `rpm`: 1000–9000
- `gear`: 1–6
- `roll_deg`: -45° a +45°
- `g_force`: 0.8–2.5G
- `latitude/longitude`: coordenadas reais de Lisboa (38.7°N, -9.1°W) com pequenos incrementos

### Alertas Demo

```typescript
[
  { id: "demo-alert-001", severity: "CRITICAL", title: "Queda detetada", ... },
  { id: "demo-alert-002", severity: "WARNING",  title: "Travagem brusca", ... },
  { id: "demo-alert-003", severity: "INFO",     title: "Velocidade elevada", ... },
]
```

### TelemetryPayload para useSocket

```typescript
// Estrutura emitida pelo DemoSocketEmitter (compatível com TelemetryPayload de types/telemetry.ts)
{
  system: {
    device_id: "DEMO-DEVICE-001",
    moto_model: "Honda CB650R Demo",
    event_status: "TRIP_ACTIVE",
    timestamp: "<ISO now>",
  },
  telemetry: {
    speed_kmh: <oscilante>,
    rpm: <oscilante>,
    gear: <1-6>,
    throttle_pct: <0-100>,
    odometer_km: <crescente>,
  },
  imu: {
    roll_deg: <oscilante>,
    pitch_deg: <oscilante>,
    yaw_deg: <oscilante>,
    g_force: <oscilante>,
  },
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: sessionStorage reflete o estado do Demo Mode

*For any* sequência de chamadas a `activateDemo()` e `exitDemoMode()`, o valor de `sessionStorage.getItem("demo_mode")` deve ser `"true"` após ativação e `null` após saída.

**Validates: Requirements 1.2, 6.1**

---

### Property 2: OnboardingGuard bypassa verificação em Demo Mode

*For any* rota protegida, quando `isDemoMode` é `true`, o `OnboardingGuard` deve renderizar os filhos imediatamente sem invocar `motorcyclesAPI.getAll()`.

**Validates: Requirements 1.4, 7.1, 7.3**

---

### Property 3: Invariantes temporais e de distância das viagens demo

*For all* viagens simuladas com status `COMPLETED`, `startedAt < endedAt` e `distanceKm > 0`.

**Validates: Requirements 2.5**

---

### Property 4: Cobertura de telemetria por viagem

*For all* viagens simuladas, o array de pontos de telemetria associado deve ter comprimento ≥ 50.

**Validates: Requirements 2.3**

---

### Property 5: API Interceptor retorna dados demo para todos os endpoints GET

*For any* chamada axios GET a `/api/motorcycles`, `/api/trips`, `/api/trips/feed`, `/api/trips/:id` ou `/api/telemetry/:tripId` quando `isDemoMode` é `true`, a resposta deve conter os dados do `demoData` correspondente sem contactar o servidor, e o status deve ser 200.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

### Property 6: API Interceptor retorna sucesso para mutações

*For any* chamada axios com método `POST`, `PUT` ou `DELETE` quando `isDemoMode` é `true`, a resposta deve ter status 2xx sem efetuar chamada de rede real.

**Validates: Requirements 3.6**

---

### Property 7: DemoSocketEmitter emite telemetria com variação

*For any* dois eventos `telemetry_update` consecutivos emitidos pelo `DemoSocketEmitter`, pelo menos um dos valores numéricos (`speed_kmh`, `rpm`, `roll_deg`) deve diferir entre as duas emissões.

**Validates: Requirements 4.2**

---

### Property 8: DemoSocketEmitter para após desativação

*For any* instância de `DemoSocketEmitter` que tenha sido iniciada com `start()`, após chamar `stop()`, nenhum evento `telemetry_update` adicional deve ser emitido.

**Validates: Requirements 4.5, 6.3**

---

### Property 9: DemoBanner presente quando Demo Mode ativo

*For any* página protegida renderizada com `isDemoMode === true`, o componente `DemoBanner` deve estar presente no DOM com o texto identificativo e o botão de saída.

**Validates: Requirements 5.1, 5.2**

---

### Property 10: Funcionalidades destrutivas desativadas em Demo Mode

*For any* componente que exponha ações destrutivas (alterar password, enviar comandos ao simulador, criar conta), quando `isDemoMode` é `true`, essas ações devem estar desativadas ou ocultas.

**Validates: Requirements 5.5**

---

### Property 11: Conformidade de tipos dos dados demo

*For all* objetos produzidos pelo `demoData` (`demoMotorcycles`, `demoTrips`, `demoFeedItems`, pontos de telemetria), os objetos devem satisfazer as respetivas interfaces TypeScript (`Motorcycle`, `Trip`, `TripFeedItem`, `TripTelemetryPoint`) — verificável via compilação TypeScript sem erros de tipo.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

---

### Property 12: Round-trip de serialização JSON dos dados demo

*For any* objeto de dados demo, `JSON.parse(JSON.stringify(obj))` deve produzir um objeto deep-equal ao original (sem perda de dados por serialização).

**Validates: Requirements 8.5**

---

### Property 13: Utilizador demo exposto pelo contexto

*For any* componente que consuma `useDemoContext()` quando `isDemoMode` é `true`, o campo `demoUser` deve ter `email === "demo@motoguard.demo"` e `name === "Demo User"`.

**Validates: Requirements 7.4**

---

## Error Handling

| Cenário | Comportamento |
|---|---|
| `useDemoContext()` usado fora do `DemoProvider` | Throw com mensagem clara: `"useDemoContext must be used within DemoProvider"` |
| `demoTelemetry[tripId]` não encontrado | Retornar array vazio `[]` com `total_points: 0` |
| Endpoint GET não mapeado no interceptor | Retornar `{ data: {}, status: 200 }` (edge case 3.7) |
| `DemoSocketEmitter.start()` chamado duas vezes | Idempotente — limpar intervalos anteriores antes de criar novos |
| `exitDemoMode()` chamado quando já inativo | No-op seguro |
| Navegação para `/trips/:id` com id não-demo | Interceptor retorna 404 simulado; componente mostra estado de erro normal |

---

## Testing Strategy

### Abordagem dual

Testes unitários cobrem exemplos específicos e casos de fronteira. Testes de propriedade cobrem invariantes universais com inputs gerados aleatoriamente.

**Biblioteca de property-based testing**: [fast-check](https://github.com/dubzzz/fast-check) (compatível com Vitest/Jest, TypeScript nativo)

### Testes unitários (exemplos e integração)

- `DemoContext`: ativar/desativar persiste/limpa sessionStorage corretamente
- `DemoContext`: `isDemoMode` inicializa a `true` se sessionStorage contém a chave
- `DemoBanner`: renderiza com texto correto e botão funcional
- `DemoBanner`: não renderiza quando `isDemoMode === false`
- `OnboardingGuard`: com `isDemoMode=true` renderiza filhos sem chamar API
- `HomePage`: botão "Explorar em Modo Demo" chama `activateDemo()`
- `DemoSocketEmitter`: emite `trip_started` após 3000ms (fake timers)
- `demoData`: contém ≥2 motas, ≥5 viagens, ≥3 alertas com severidades distintas

### Testes de propriedade (fast-check, mínimo 100 iterações cada)

Cada teste de propriedade deve ser anotado com o tag:
`// Feature: demo-mode, Property N: <texto da propriedade>`

```typescript
// Property 1 — sessionStorage round-trip
// Feature: demo-mode, Property 1: sessionStorage reflete o estado do Demo Mode
fc.assert(fc.property(fc.boolean(), (activate) => {
  if (activate) { activateDemo(); expect(sessionStorage.getItem("demo_mode")).toBe("true"); }
  else { exitDemoMode(); expect(sessionStorage.getItem("demo_mode")).toBeNull(); }
}), { numRuns: 100 });

// Property 3 — invariantes temporais das viagens
// Feature: demo-mode, Property 3: invariantes temporais e de distância das viagens demo
fc.assert(fc.property(fc.constantFrom(...demoTrips.filter(t => t.status === "COMPLETED")), (trip) => {
  expect(new Date(trip.startedAt) < new Date(trip.endedAt!)).toBe(true);
  expect(trip.distanceKm).toBeGreaterThan(0);
}), { numRuns: 100 });

// Property 4 — cobertura de telemetria
// Feature: demo-mode, Property 4: cobertura de telemetria por viagem
fc.assert(fc.property(fc.constantFrom(...demoTrips), (trip) => {
  expect(demoTelemetry[trip.id].length).toBeGreaterThanOrEqual(50);
}), { numRuns: 100 });

// Property 5 — interceptor GET
// Feature: demo-mode, Property 5: API Interceptor retorna dados demo para todos os endpoints GET
fc.assert(fc.property(fc.constantFrom(...demoTrips), async (trip) => {
  const res = await api.get(`/api/trips/${trip.id}`);
  expect(res.status).toBe(200);
  expect(res.data.id).toBe(trip.id);
}), { numRuns: 100 });

// Property 7 — variação de telemetria
// Feature: demo-mode, Property 7: DemoSocketEmitter emite telemetria com variação
// Capturar N emissões consecutivas e verificar que não são todas iguais

// Property 8 — emitter para após stop
// Feature: demo-mode, Property 8: DemoSocketEmitter para após desativação

// Property 11 — conformidade de tipos (verificada em compile-time pelo TypeScript)
// Feature: demo-mode, Property 11: conformidade de tipos dos dados demo

// Property 12 — round-trip JSON
// Feature: demo-mode, Property 12: round-trip de serialização JSON dos dados demo
fc.assert(fc.property(fc.constantFrom(...demoTrips, ...demoMotorcycles), (obj) => {
  expect(JSON.parse(JSON.stringify(obj))).toEqual(obj);
}), { numRuns: 100 });
```

### Estrutura de ficheiros de teste

```
src/demo/
  __tests__/
    DemoContext.test.tsx
    DemoBanner.test.tsx
    demoData.test.ts          ← propriedades 3, 4, 11, 12
    demoAPIInterceptor.test.ts ← propriedades 5, 6
    demoSocketEmitter.test.ts  ← propriedades 7, 8
src/components/auth/
  OnboardingGuard.test.tsx    ← propriedade 2 (já existe, adicionar caso demo)
```
