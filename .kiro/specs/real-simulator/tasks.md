# Implementation Plan: Real Simulator

## Overview

Implementar a página `/real-simulator` no frontend MotoGuard IoT. A funcionalidade é puramente frontend: parsing de CSV no browser, sincronização com vídeo `.mp4`, emissão de telemetria via Socket.IO existente, e mapa Leaflet com o percurso GPS.

## Tasks

- [x] 1. Criar o módulo CSV_Parser
  - [x] 1.1 Implementar `parseCSV` em `app/frontend/src/real-simulator/csvParser.ts`
    - Ler cabeçalho e detetar coluna de timestamp (`timestamp`, `time`, `t`) — case-insensitive
    - Mapear colunas CSV para campos `ParsedRow` conforme tabela do design
    - Ignorar linhas com `latitude`/`longitude` em falta e incrementar `skippedCount`
    - Suportar timestamps numéricos (segundos relativos) e ISO 8601
    - Preencher valores por defeito para campos ausentes (`gear=1`, `throttle_pct=0`, etc.)
    - Retornar `ParseResult` ou `ParseError` (`NO_TIMESTAMP_COLUMN`, `INVALID_EXTENSION`, `EMPTY_FILE`)
    - _Requirements: 1.2, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.5_

  - [x] 1.2 Escrever property test P1 — Row count
    - **Property 1: CSV parsing preserves row count minus skipped rows**
    - **Validates: Requirements 1.6**
    - Usar fast-check; gerar CSV arbitrário com N rows e K inválidas; asserir `rows.length === N - K && skippedCount === K`

  - [x] 1.3 Escrever property test P2 — Timestamp round-trip
    - **Property 2: Timestamp parsing round-trip**
    - **Validates: Requirements 1.7, 2.5**
    - Gerar strings numéricas e ISO 8601 arbitrárias; asserir `|parsed - original| < 1ms`

  - [x] 1.4 Escrever property test P3 — Column mapping case-insensitive
    - **Property 3: Column mapping is case-insensitive and complete**
    - **Validates: Requirements 2.1, 2.3**
    - Gerar CSV com colunas em case aleatório; asserir todos os campos mapeados e defaults corretos

- [x] 2. Implementar `buildPayload` e `formatTime`
  - [x] 2.1 Criar `app/frontend/src/real-simulator/telemetryEmitter.ts`
    - Implementar `buildPayload(row, deviceId, simulationStartTime, eventStatus): TelemetryPayload`
    - Preencher `system.device_id`, `system.moto_model = "Real Simulator"`, `system.event_status`, `system.timestamp`, `system.tick`
    - Implementar `emitTelemetry(socket, payload)` que chama `socket.emit('telemetry_update', payload)`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.2 Implementar `formatTime(seconds: number): string` em `app/frontend/src/real-simulator/utils.ts`
    - Retornar string no formato `MM:SS`
    - _Requirements: 5.8_

  - [x] 2.3 Escrever property test P5 — Payload structure
    - **Property 5: Emitted payload reflects the selected CSV row**
    - **Validates: Requirements 4.3, 6.1, 6.2, 6.3**
    - Gerar `ParsedRow` e `deviceId` arbitrários; asserir campos obrigatórios, `device_id` e `event_status`

  - [x] 2.4 Escrever property test P10 — MM:SS format
    - **Property 10: Time format MM:SS is always valid**
    - **Validates: Requirements 5.8**
    - Gerar inteiros não-negativos arbitrários; asserir string corresponde a `^\d{2}:\d{2}$`

- [x] 3. Implementar o hook `useSyncEngine`
  - [x] 3.1 Criar `app/frontend/src/real-simulator/useSyncEngine.ts`
    - Implementar binary search sobre `rows[i].timestampSec` para encontrar a linha mais próxima de `currentTimeSec`
    - Modo vídeo: ler `videoRef.current.currentTime` a cada 100ms via `setInterval`
    - Modo timer (sem vídeo): avançar `currentTimeSec` com `setInterval` ajustado por `playbackSpeed`
    - Expor `start()`, `pause()`, `stop()`, `seek(timeSec)`, `currentIndex`
    - Chamar `onRowChange(row, index)` quando o índice muda
    - Limpar intervalos no cleanup do `useEffect`
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 3.2 Escrever property test P4 — Nearest row selection
    - **Property 4: Sync_Engine selects the nearest CSV row**
    - **Validates: Requirements 4.1, 4.2, 4.4**
    - Gerar array de rows com timestamps arbitrários e query time T; asserir que o índice selecionado minimiza `|rows[i].timestampSec - T|`

  - [x] 3.3 Escrever property test P6 — Emission rate ≤ 10 Hz
    - **Property 6: Emission rate does not exceed 10 Hz**
    - **Validates: Requirements 4.5**
    - Simular sessão de duração D a velocidade V; asserir `emittedCount <= D * 10`

  - [x] 3.4 Escrever property test P8 — Stop resets state
    - **Property 8: Stop resets all state to initial**
    - **Validates: Requirements 4.7, 5.4, 5.9**
    - Asserir `currentRowIndex === 0`, `currentTimeSec === 0`, `playbackState === 'stopped'` após stop

  - [x] 3.5 Escrever property test P9 — Speed change preserves playing state
    - **Property 9: Playback speed change preserves playing state**
    - **Validates: Requirements 5.5, 5.6**
    - Asserir `playbackState === 'playing'` após mudança de velocidade durante reprodução

- [x] 4. Checkpoint — Testar módulos puros
  - Garantir que todos os testes dos módulos `csvParser`, `telemetryEmitter` e `useSyncEngine` passam.
  - Pedir ao utilizador confirmação antes de avançar para os componentes React.

- [x] 5. Criar os componentes React da página
  - [x] 5.1 Criar `app/frontend/src/real-simulator/RouteMap.tsx`
    - Wrapper Leaflet que recebe `gpsTrack: Array<{lat, lng}>` e `currentPosition: {lat, lng} | null`
    - Desenhar o percurso completo como polyline ao montar
    - Atualizar marcador de posição atual durante reprodução
    - Marcador verde no início, marcador vermelho no fim
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 5.2 Criar `app/frontend/src/real-simulator/VideoPlayer.tsx`
    - Encapsular `<video>` HTML5 com `ref` exposto ao pai
    - Aceitar `videoFile: File | null` e criar `objectURL` para reprodução local
    - Expor controlos nativos de volume e fullscreen; ocultar controlos de play/pause/seek nativos
    - Mostrar zona de placeholder quando `videoFile` é null
    - _Requirements: 3.5, 3.6, 3.7_

  - [x] 5.3 Criar `app/frontend/src/real-simulator/CsvDropzone.tsx`
    - Zona de drag-and-drop e botão de seleção de ficheiro
    - Validar extensão `.csv` antes de chamar `parseCSV`
    - Mostrar pré-visualização: número de linhas, colunas encontradas, intervalo de timestamps
    - Mostrar erros descritivos (`ParseError`) e número de linhas ignoradas
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.8_

  - [x] 5.4 Criar `app/frontend/src/real-simulator/PlaybackControls.tsx`
    - Botões Play, Pause, Stop
    - Seletor de `Playback_Speed` (0.25×, 0.5×, 1×, 2×, 4×)
    - Barra de progresso com posição atual
    - Display de tempo `MM:SS / MM:SS` (atual / total)
    - Contador de payloads emitidos
    - Input para `Device_ID` com valor por defeito `REAL-SIM-001`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.5_

- [x] 6. Criar a página principal `RealSimulator`
  - [x] 6.1 Criar `app/frontend/src/pages/RealSimulator.tsx`
    - Orquestrar `CsvDropzone`, `RouteMap`, `VideoPlayer`, `PlaybackControls` e `useSyncEngine`
    - Manter `SimulatorSession` state: `rows`, `deviceId`, `videoFile`, `playbackState`, `playbackSpeed`, `currentRowIndex`, `emittedCount`
    - Usar `useSocket` para obter o socket e verificar ligação antes de Play
    - Mostrar erro se socket não conectado ao clicar Play
    - Layout dividido: `RouteMap` à esquerda (≥50%), `VideoPlayer` à direita
    - Emitir payload final com `event_status: 'TRIP_ENDED'` no Stop
    - Definir `document.title = 'Simulador Real — MotoGuard'`
    - Limpar timers e socket listeners no `useEffect` cleanup (unmount)
    - _Requirements: 3.1, 3.6, 4.3, 4.4, 5.2, 5.3, 5.4, 5.9, 6.1, 6.4, 6.6, 7.4, 7.5_

  - [x] 6.2 Escrever property test P7 — Pause stops emission
    - **Property 7: Pause stops emission**
    - **Validates: Requirements 4.6, 5.3**
    - Asserir que nenhum evento `telemetry_update` é emitido após transição para paused

  - [x] 6.3 Escrever property test P11 — Cleanup on unmount stops emission
    - **Property 11: Cleanup on unmount stops emission**
    - **Validates: Requirements 7.4**
    - Asserir que nenhum evento é emitido após unmount do componente

- [x] 7. Integrar na aplicação (routing e sidebar)
  - [x] 7.1 Adicionar rota `/real-simulator` em `app/frontend/src/App.tsx`
    - Importar `RealSimulator` e adicionar dentro do bloco de rotas protegidas com `OnboardingGuard`
    - _Requirements: 7.1, 7.3_

  - [x] 7.2 Adicionar item "Simulador Real" na sidebar em `app/frontend/src/components/Sidebar.tsx`
    - Adicionar ao grupo "Sistema" com label `"Simulador Real"` e ícone adequado (e.g. `PlayCircle` do lucide-react)
    - Adicionar chave de tradução `sidebar.realSimulator` em `app/frontend/src/i18n/translations.ts` para PT, EN e ES
    - _Requirements: 7.2_

- [x] 8. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam, pedir ao utilizador confirmação se surgirem dúvidas.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser saltadas para um MVP mais rápido
- Cada task referencia os requisitos específicos para rastreabilidade
- Os property tests usam **fast-check** (já disponível no projeto via Vitest)
- O `useSyncEngine` deve ser testável de forma isolada, sem depender do DOM do vídeo
- O backend não requer alterações — `telemetry_update` já é tratado pelo `socket.service.ts`
