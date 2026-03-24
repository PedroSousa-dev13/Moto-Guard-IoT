# Design Document — Real Simulator

## Overview

O Real Simulator é uma nova página do MotoGuard IoT que permite reproduzir ficheiros CSV de telemetria gravados em campo, sincronizando a emissão de dados com a reprodução de um vídeo `.mp4`. O utilizador importa um CSV, opcionalmente associa um vídeo, e controla a reprodução com play/pause/stop e velocidade variável. Os dados são emitidos via Socket.IO diretamente para o backend, simulando um dispositivo físico real.

A funcionalidade é puramente frontend — o CSV é processado no browser, sem upload para o servidor. A emissão de telemetria usa o evento `telemetry_update` do Socket.IO existente, tornando o backend completamente agnóstico à origem dos dados.

---

## Architecture

```mermaid
graph TD
    subgraph Frontend — /real-simulator
        UI[RealSimulator Page]
        CP[CSV_Parser]
        PE[Playback_Controller]
        SE[Sync_Engine]
        TE[Telemetry_Emitter]
        RM[Route_Map]
        VP[Video_Player]
    end

    subgraph Backend existente
        SIO[Socket.IO Server]
        SS[socket.service.ts]
        DB[(PostgreSQL)]
        INF[(InfluxDB)]
    end

    UI -->|File input| CP
    CP -->|ParsedRows| PE
    PE -->|playback state| SE
    VP -->|currentTime| SE
    SE -->|current row| TE
    SE -->|GPS coords| RM
    TE -->|telemetry_update| SIO
    SIO --> SS
    SS --> DB
    SS --> INF
    SS -->|broadcast| UI
```

O fluxo principal:
1. O utilizador importa um CSV → `CSV_Parser` valida e converte para `ParsedRow[]`
2. O utilizador clica Play → `Playback_Controller` inicia o `Video_Player` e o `Sync_Engine`
3. O `Sync_Engine` lê `video.currentTime` a cada 100ms e seleciona a linha CSV mais próxima
4. O `Telemetry_Emitter` constrói um `TelemetryPayload` e emite via `socket.emit('telemetry_update', payload)`
5. O backend processa normalmente (trip lifecycle, heuristics, InfluxDB)

Quando não há vídeo, o `Sync_Engine` usa um `setInterval` interno ajustado pelo `Playback_Speed`.

---

## Components and Interfaces

### RealSimulator (página principal)
Rota: `/real-simulator`. Orquestra todos os sub-componentes e mantém o estado global da sessão.

```typescript
interface SimulatorSession {
  rows: ParsedRow[];          // dados CSV processados
  deviceId: string;           // configurável, default "REAL-SIM-001"
  videoFile: File | null;
  playbackState: 'idle' | 'playing' | 'paused' | 'stopped';
  playbackSpeed: 0.25 | 0.5 | 1 | 2 | 4;
  currentRowIndex: number;
  emittedCount: number;
}
```

### CSV_Parser
Módulo puro (sem side effects) que recebe o texto do ficheiro CSV e devolve `ParseResult`.

```typescript
interface ParsedRow {
  timestampSec: number;       // sempre em segundos relativos ao início
  latitude: number;
  longitude: number;
  speed_kmh: number;
  rpm: number;
  gear: number;
  throttle_pct: number;
  engine_temp_c: number;
  voltage: number;
  roll_deg: number;
  pitch_deg: number;
  yaw_deg: number;
  g_force: number;
}

interface ParseResult {
  rows: ParsedRow[];
  skippedCount: number;
  columns: string[];
  durationSec: number;        // timestamp da última linha
  errors: string[];           // erros não fatais
}

interface ParseError {
  type: 'NO_TIMESTAMP_COLUMN' | 'INVALID_EXTENSION' | 'EMPTY_FILE';
  message: string;
}

function parseCSV(text: string): ParseResult | ParseError;
```

Mapeamento de colunas (case-insensitive):

| Coluna CSV | Campo TelemetryPayload |
|---|---|
| `speed`, `speed_kmh` | `telemetry.speed_kmh` |
| `rpm` | `telemetry.rpm` |
| `gear` | `telemetry.gear` |
| `throttle`, `throttle_pct` | `telemetry.throttle_pct` |
| `engine_temp`, `engine_temp_c` | `telemetry.engine_temp_c` |
| `voltage` | `telemetry.voltage` |
| `lat`, `latitude` | `location.latitude` |
| `lon`, `lng`, `longitude` | `location.longitude` |
| `roll`, `roll_deg` | `imu.roll_deg` |
| `pitch`, `pitch_deg` | `imu.pitch_deg` |
| `yaw`, `yaw_deg` | `imu.yaw_deg` |
| `g_force`, `gforce` | `imu.g_force` |
| `timestamp`, `time`, `t` | `system.timestamp` (Timestamp_Column) |

### Sync_Engine
Responsável por manter o alinhamento entre o tempo de reprodução e o índice CSV.

```typescript
interface SyncEngineOptions {
  rows: ParsedRow[];
  videoRef: RefObject<HTMLVideoElement> | null;  // null = modo timer
  playbackSpeed: number;
  onRowChange: (row: ParsedRow, index: number) => void;
  maxHz?: number;  // default 10
}

// Implementado como hook React
function useSyncEngine(options: SyncEngineOptions): {
  start: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSec: number) => void;
  currentIndex: number;
}
```

Algoritmo de seleção de linha: binary search sobre `rows[i].timestampSec` para encontrar o índice com menor `|rows[i].timestampSec - currentTimeSec|`.

### Telemetry_Emitter
Constrói e emite `TelemetryPayload` via Socket.IO.

```typescript
function buildPayload(
  row: ParsedRow,
  deviceId: string,
  simulationStartTime: Date,
  eventStatus: string
): TelemetryPayload;

// Usa o socket existente do useSocket hook
function emitTelemetry(socket: Socket, payload: TelemetryPayload): void;
```

O `Telemetry_Emitter` emite diretamente `socket.emit('telemetry_update', payload)` — o backend já tem um handler para este evento no `socket.service.ts` que processa a telemetria normalmente.

> Decisão de design: emitir `telemetry_update` diretamente (em vez de `send_command`) evita o round-trip MQTT e permite que o backend trate os dados do Real Simulator exatamente como dados de um dispositivo real, incluindo trip lifecycle e heuristics.

### Route_Map
Wrapper do componente Leaflet existente, adaptado para receber um array de coordenadas GPS e uma posição atual.

```typescript
interface RouteMapProps {
  gpsTrack: Array<{ lat: number; lng: number }>;  // percurso completo
  currentPosition: { lat: number; lng: number } | null;
}
```

### Video_Player
Componente React que encapsula um `<video>` HTML5. Os controlos nativos de volume/fullscreen são expostos; play/pause/seek são controlados programaticamente pelo `Playback_Controller`.

```typescript
interface VideoPlayerProps {
  videoFile: File | null;
  videoRef: RefObject<HTMLVideoElement>;
  onFileSelect: (file: File) => void;
}
```

---

## Data Models

### ParsedRow
Representa uma linha do CSV após parsing e normalização. Todos os campos numéricos têm valores por defeito se ausentes no CSV.

```typescript
interface ParsedRow {
  timestampSec: number;   // segundos relativos, sempre >= 0
  latitude: number;       // obrigatório (linha ignorada se ausente)
  longitude: number;      // obrigatório (linha ignorada se ausente)
  speed_kmh: number;      // default: 0
  rpm: number;            // default: 0
  gear: number;           // default: 1
  throttle_pct: number;   // default: 0
  engine_temp_c: number;  // default: 80
  voltage: number;        // default: 12.5
  roll_deg: number;       // default: 0
  pitch_deg: number;      // default: 0
  yaw_deg: number;        // default: 0
  g_force: number;        // default: 1.0
}
```

### TelemetryPayload (existente, em `telemetry.model.ts`)
Estrutura já definida no backend e frontend. O `Telemetry_Emitter` constrói payloads conformes com esta interface, preenchendo os campos `system` com:
- `device_id`: valor configurado pelo utilizador
- `moto_model`: `"Real Simulator"`
- `event_status`: `"TRIP_ACTIVE"` durante reprodução, `"TRIP_ENDED"` no stop
- `timestamp`: ISO 8601 calculado como `simulationStartTime + row.timestampSec * 1000ms`
- `tick`: índice da linha CSV atual

### PlaybackState
```typescript
type PlaybackState = 'idle' | 'playing' | 'paused' | 'stopped';

interface PlaybackContext {
  state: PlaybackState;
  speed: 0.25 | 0.5 | 1 | 2 | 4;
  currentTimeSec: number;
  totalDurationSec: number;
  emittedCount: number;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: CSV parsing preserves row count minus skipped rows

*For any* CSV string with N total data rows and K rows with missing required fields (timestamp, latitude, or longitude), parsing should produce exactly N - K valid rows and report K as `skippedCount`.

**Validates: Requirements 1.6**

---

### Property 2: Timestamp parsing round-trip

*For any* valid timestamp string (numeric seconds or ISO 8601), parsing it to `timestampSec` and converting back to an equivalent representation should preserve the original time offset within 1ms precision.

**Validates: Requirements 1.7, 2.5**

---

### Property 3: Column mapping is case-insensitive and complete

*For any* CSV with known column names in any combination of upper/lower case, and for any row in the parsed result, the fields of the resulting `ParsedRow` should match the CSV values, and any field absent from the CSV should have its documented default value.

**Validates: Requirements 2.1, 2.3**

---

### Property 4: Sync_Engine selects the nearest CSV row

*For any* array of `ParsedRow` values and any query time T (in seconds), the row selected by the Sync_Engine should be the one whose `timestampSec` minimizes `|row.timestampSec - T|`.

**Validates: Requirements 4.1, 4.2, 4.4**

---

### Property 5: Emitted payload reflects the selected CSV row

*For any* `ParsedRow` and configured `deviceId`, the `TelemetryPayload` built by `buildPayload` should contain all numeric fields from the row, the configured `deviceId` in `system.device_id`, and `system.event_status` equal to `"TRIP_ACTIVE"`.

**Validates: Requirements 4.3, 6.1, 6.2, 6.3**

---

### Property 6: Emission rate does not exceed 10 Hz

*For any* playback session of duration D seconds at any `Playback_Speed`, the total number of payloads emitted should not exceed D × 10.

**Validates: Requirements 4.5**

---

### Property 7: Pause stops emission

*For any* playing session, after transitioning to paused state, no new `telemetry_update` events should be emitted until play is resumed.

**Validates: Requirements 4.6, 5.3**

---

### Property 8: Stop resets all state to initial

*For any* session in any state (playing, paused), after a stop command, `currentRowIndex` should be 0, `currentTimeSec` should be 0, and `playbackState` should be `'stopped'`.

**Validates: Requirements 4.7, 5.4, 5.9**

---

### Property 9: Playback speed change preserves playing state

*For any* playing session, changing `Playback_Speed` to any valid value (0.25, 0.5, 1, 2, 4) should not change `playbackState` from `'playing'`.

**Validates: Requirements 5.5, 5.6**

---

### Property 10: Time format MM:SS is always valid

*For any* non-negative integer number of seconds S, `formatTime(S)` should return a string matching the pattern `^\d{2}:\d{2}$` where the seconds component is in [0, 59].

**Validates: Requirements 5.8**

---

### Property 11: Cleanup on unmount stops emission

*For any* active playback session, when the component unmounts (navigation away), no further `telemetry_update` events should be emitted after the cleanup effect runs.

**Validates: Requirements 7.4**

---

## Error Handling

| Situação | Comportamento |
|---|---|
| Ficheiro sem extensão `.csv` | Erro imediato, sem parsing |
| CSV sem coluna de timestamp | `ParseError` com `type: 'NO_TIMESTAMP_COLUMN'` e mensagem descritiva |
| Linha com latitude/longitude em falta | Linha ignorada, `skippedCount` incrementado |
| Linha com timestamp inválido | Linha ignorada, `skippedCount` incrementado |
| CSV vazio (0 linhas de dados) | `ParseError` com `type: 'EMPTY_FILE'` |
| Socket não conectado ao clicar Play | Mensagem de erro na UI, reprodução não inicia |
| Erro ao emitir payload | Log de erro na consola, reprodução continua (best-effort) |
| Vídeo sem suporte `.mp4` no browser | Mensagem de erro nativa do `<video>` element |

---

## Testing Strategy

### Unit Tests
Focados em exemplos concretos e casos de fronteira:
- `CSV_Parser`: ficheiro válido mínimo, ficheiro sem timestamp, ficheiro com linhas inválidas, timestamps ISO 8601 e numéricos
- `buildPayload`: verificar estrutura completa do payload para uma row conhecida
- `formatTime`: casos `0`, `59`, `60`, `3599`, `3600`
- Routing: `/real-simulator` redireciona para login se não autenticado
- Sidebar: item "Simulador Real" presente no grupo "Sistema"
- Stop emite payload final com `event_status: 'TRIP_ENDED'`

### Property-Based Tests
Usar **fast-check** (já disponível no ecossistema TypeScript/Vitest do projeto).

Cada teste deve correr no mínimo **100 iterações**.

Tag format: `// Feature: real-simulator, Property N: <property_text>`

| Property | Gerador | Asserção |
|---|---|---|
| P1 — Row count | CSV arbitrário com N rows, K inválidas | `result.rows.length === N - K && result.skippedCount === K` |
| P2 — Timestamp round-trip | Strings numéricas e ISO 8601 arbitrárias | `\|parsed - original\| < 1ms` |
| P3 — Column mapping | CSV com colunas em case aleatório | Todos os campos mapeados corretamente; campos ausentes têm defaults |
| P4 — Nearest row | Array de rows com timestamps arbitrários, query time T | `selectedIndex` minimiza `\|rows[i].timestampSec - T\|` |
| P5 — Payload structure | Row arbitrária + deviceId arbitrário | Payload tem todos os campos obrigatórios; `device_id` e `event_status` corretos |
| P6 — Emission rate | Sessão de duração D a velocidade V | `emittedCount <= D * 10` |
| P7 — Pause stops emission | Sessão em play, transição para pause | Nenhum evento emitido após pause |
| P8 — Stop resets state | Sessão em qualquer estado | Estado após stop é o estado inicial |
| P9 — Speed change preserves play | Sessão em play, speed change | `playbackState === 'playing'` após mudança |
| P10 — MM:SS format | Inteiros não-negativos arbitrários | String corresponde a `^\d{2}:\d{2}$` |
| P11 — Cleanup on unmount | Sessão ativa, unmount | Nenhum evento emitido após cleanup |
