# Requirements Document

## Introduction

O **Simulador Real** é uma nova página do frontend do MotoGuard IoT que permite ao utilizador importar um ficheiro CSV com dados de telemetria gravados (speed, rpm, GPS lat/lon, etc.) e reproduzi-los em tempo real para a websocket, simulando um dispositivo físico a enviar dados ao vivo.

A página apresenta um layout dividido: mapa com o percurso GPS à esquerda e um player de vídeo `.mp4` à direita. O envio dos dados CSV para a websocket é sincronizado com a reprodução do vídeo — quando o vídeo está no segundo X, os dados do CSV correspondentes a esse timestamp são emitidos. O utilizador controla a simulação com botões de play, pause, stop e seleção de velocidade de reprodução.

Esta funcionalidade é útil para testar o sistema com dados reais gravados em campo, sem necessitar de um dispositivo físico ligado.

---

## Glossary

- **Real_Simulator**: A página frontend "Simulador Real" e o conjunto de componentes que a compõem.
- **CSV_Parser**: O módulo responsável por ler e interpretar o ficheiro CSV de telemetria.
- **CSV_Row**: Uma linha do ficheiro CSV, representando um instante de telemetria com timestamp e campos de dados.
- **Telemetry_Emitter**: O módulo frontend responsável por enviar payloads de telemetria para a websocket do backend, simulando um dispositivo real.
- **Playback_Controller**: O módulo que gere o estado de reprodução (play, pause, stop, velocidade) e coordena o CSV_Parser com o Telemetry_Emitter e o Video_Player.
- **Video_Player**: O componente de reprodução de vídeo `.mp4` integrado na página.
- **Sync_Engine**: O mecanismo que mantém o alinhamento temporal entre a posição do vídeo e o índice de dados CSV a emitir.
- **Route_Map**: O componente de mapa (Leaflet) que exibe o percurso GPS derivado das coordenadas do CSV.
- **Timestamp_Column**: A coluna do CSV que contém o tempo relativo (em segundos) ou absoluto (ISO 8601) de cada linha de telemetria.
- **Playback_Speed**: Multiplicador de velocidade de reprodução (0.25×, 0.5×, 1×, 2×, 4×).
- **TelemetryPayload**: A estrutura de dados JSON enviada para a websocket, conforme definida em `telemetry.model.ts`.
- **Device_ID**: Identificador do dispositivo simulado, configurável pelo utilizador.

---

## Requirements

### Requirement 1: Importação de Ficheiro CSV

**User Story:** Como utilizador, quero importar um ficheiro CSV com dados de telemetria gravados, para poder reproduzi-los no simulador.

#### Acceptance Criteria

1. THE Real_Simulator SHALL apresentar uma zona de drag-and-drop e um botão de seleção de ficheiro para importar um ficheiro CSV.
2. WHEN um ficheiro CSV é selecionado ou arrastado, THE CSV_Parser SHALL ler e validar o ficheiro no browser, sem enviar o ficheiro para o servidor.
3. WHEN o CSV_Parser processa um ficheiro válido, THE Real_Simulator SHALL exibir uma pré-visualização com o número de linhas detetadas, as colunas encontradas e o intervalo de timestamps.
4. IF o ficheiro selecionado não tiver extensão `.csv`, THEN THE Real_Simulator SHALL apresentar uma mensagem de erro indicando que apenas ficheiros CSV são suportados.
5. IF o CSV não contiver uma coluna de timestamp reconhecível (`timestamp`, `time`, `t`), THEN THE CSV_Parser SHALL apresentar um erro descritivo indicando a coluna em falta.
6. IF o CSV contiver linhas com valores em falta nos campos obrigatórios (timestamp, latitude, longitude), THEN THE CSV_Parser SHALL ignorar essas linhas e reportar o número de linhas ignoradas.
7. THE CSV_Parser SHALL suportar timestamps em formato numérico (segundos relativos, e.g. `0.0`, `1.5`) e em formato ISO 8601 (e.g. `2024-01-15T10:30:00.000Z`).
8. WHEN o CSV_Parser termina o processamento com sucesso, THE Real_Simulator SHALL habilitar os controlos de simulação (play, pause, stop).

---

### Requirement 2: Mapeamento de Colunas CSV para TelemetryPayload

**User Story:** Como utilizador, quero que os dados do CSV sejam mapeados automaticamente para os campos de telemetria do sistema, para que a simulação seja compatível com o backend.

#### Acceptance Criteria

1. THE CSV_Parser SHALL mapear automaticamente as seguintes colunas CSV para os campos do TelemetryPayload, de forma case-insensitive:
   - `speed`, `speed_kmh` → `telemetry.speed_kmh`
   - `rpm` → `telemetry.rpm`
   - `gear` → `telemetry.gear`
   - `throttle`, `throttle_pct` → `telemetry.throttle_pct`
   - `engine_temp`, `engine_temp_c` → `telemetry.engine_temp_c`
   - `voltage` → `telemetry.voltage`
   - `lat`, `latitude` → `location.latitude`
   - `lon`, `lng`, `longitude` → `location.longitude`
   - `roll`, `roll_deg` → `imu.roll_deg`
   - `pitch`, `pitch_deg` → `imu.pitch_deg`
   - `yaw`, `yaw_deg` → `imu.yaw_deg`
   - `g_force`, `gforce` → `imu.g_force`
2. WHEN uma coluna do CSV não corresponde a nenhum campo conhecido, THE CSV_Parser SHALL ignorar essa coluna sem erro.
3. THE CSV_Parser SHALL preencher com valores por defeito os campos do TelemetryPayload não presentes no CSV (e.g. `gear=1`, `throttle_pct=0`, `g_force=1.0`).
4. THE Real_Simulator SHALL permitir ao utilizador configurar o Device_ID a usar na simulação, com valor por defeito `REAL-SIM-001`.
5. THE CSV_Parser SHALL construir o campo `system.timestamp` a partir do Timestamp_Column, convertendo timestamps relativos para ISO 8601 com base no momento de início da simulação.

---

### Requirement 3: Layout da Página — Mapa e Vídeo

**User Story:** Como utilizador, quero ver o percurso GPS no mapa e o vídeo sincronizados lado a lado, para ter contexto visual durante a reprodução.

#### Acceptance Criteria

1. THE Real_Simulator SHALL apresentar um layout dividido horizontalmente: Route_Map à esquerda (≥50% da largura) e Video_Player à direita.
2. THE Route_Map SHALL exibir o percurso completo derivado das coordenadas GPS do CSV assim que o ficheiro for importado com sucesso.
3. WHILE a simulação está em reprodução, THE Route_Map SHALL atualizar a posição do marcador em tempo real com as coordenadas GPS da linha CSV atual.
4. THE Route_Map SHALL marcar o ponto de início do percurso com um marcador verde e o ponto de fim com um marcador vermelho.
5. THE Video_Player SHALL suportar a seleção de um ficheiro de vídeo `.mp4` local, sem enviar o ficheiro para o servidor.
6. IF nenhum ficheiro de vídeo for selecionado, THE Real_Simulator SHALL apresentar o layout com o Route_Map em largura total e uma zona de placeholder para o vídeo.
7. THE Video_Player SHALL expor controlos nativos de volume e fullscreen, mas os controlos de play/pause/seek SHALL ser geridos exclusivamente pelo Playback_Controller para garantir sincronização.

---

### Requirement 4: Sincronização Vídeo–CSV (Sync Engine)

**User Story:** Como utilizador, quero que os dados de telemetria enviados para a websocket estejam sincronizados com o frame de vídeo atual, para que a simulação reflita fielmente o momento gravado.

#### Acceptance Criteria

1. THE Sync_Engine SHALL usar o tempo atual do Video_Player (em segundos) como referência para determinar qual linha CSV emitir.
2. WHEN o Video_Player avança para o segundo X, THE Sync_Engine SHALL selecionar a linha CSV cujo timestamp é o mais próximo de X (menor diferença absoluta).
3. THE Telemetry_Emitter SHALL emitir o TelemetryPayload correspondente à linha CSV selecionada via websocket, no evento `telemetry_update`.
4. WHEN o utilizador faz seek no vídeo para uma posição diferente, THE Sync_Engine SHALL recalcular imediatamente a linha CSV correspondente e retomar a emissão a partir dessa posição.
5. THE Sync_Engine SHALL emitir dados com uma frequência máxima de 10 Hz (um payload por cada 100ms), independentemente da taxa de frames do vídeo.
6. WHILE a simulação está em pausa, THE Telemetry_Emitter SHALL parar de emitir novos payloads.
7. WHEN a simulação é parada (stop), THE Sync_Engine SHALL repor o vídeo e o índice CSV para o início.
8. IF o CSV não tiver vídeo associado, THE Sync_Engine SHALL usar um timer interno baseado no Playback_Speed para avançar pelos dados CSV, sem depender do Video_Player.

---

### Requirement 5: Controlos de Simulação

**User Story:** Como utilizador, quero controlar a reprodução da simulação com botões de play, pause, stop e velocidade, para gerir o ritmo da simulação.

#### Acceptance Criteria

1. THE Playback_Controller SHALL apresentar os seguintes controlos: Play, Pause, Stop e seletor de Playback_Speed.
2. WHEN o utilizador clica em Play, THE Playback_Controller SHALL iniciar a reprodução do vídeo e a emissão de dados CSV em simultâneo.
3. WHEN o utilizador clica em Pause, THE Playback_Controller SHALL pausar o vídeo e suspender a emissão de dados CSV.
4. WHEN o utilizador clica em Stop, THE Playback_Controller SHALL parar o vídeo, repor a posição para o início e limpar o estado de emissão.
5. THE Playback_Controller SHALL suportar os seguintes valores de Playback_Speed: 0.25×, 0.5×, 1×, 2×, 4×.
6. WHEN o utilizador altera o Playback_Speed, THE Playback_Controller SHALL aplicar a nova velocidade ao Video_Player e ao timer interno do Sync_Engine sem interromper a reprodução.
7. THE Real_Simulator SHALL apresentar uma barra de progresso que indica a posição atual na linha temporal do CSV/vídeo.
8. THE Real_Simulator SHALL exibir o timestamp atual da simulação (tempo decorrido e tempo total) em formato `MM:SS`.
9. WHEN a reprodução atinge o fim do CSV ou do vídeo, THE Playback_Controller SHALL parar automaticamente e repor o estado para o início.

---

### Requirement 6: Emissão de Dados para a WebSocket

**User Story:** Como utilizador, quero que os dados CSV sejam enviados para a websocket do backend como se fossem de um dispositivo real, para que o sistema processe a telemetria normalmente.

#### Acceptance Criteria

1. THE Telemetry_Emitter SHALL emitir os dados via Socket.IO no evento `telemetry_update`, com a estrutura completa do TelemetryPayload.
2. THE Telemetry_Emitter SHALL usar o Device_ID configurado pelo utilizador no campo `system.device_id` de cada payload emitido.
3. THE Telemetry_Emitter SHALL preencher o campo `system.event_status` com `TRIP_ACTIVE` durante a reprodução.
4. WHEN a simulação é parada, THE Telemetry_Emitter SHALL emitir um payload final com `system.event_status` igual a `TRIP_ENDED`.
5. THE Real_Simulator SHALL exibir um contador de payloads emitidos durante a sessão de simulação.
6. IF a ligação websocket não estiver estabelecida quando o utilizador clica em Play, THEN THE Real_Simulator SHALL apresentar uma mensagem de erro e não iniciar a reprodução.
7. THE Telemetry_Emitter SHALL emitir os dados diretamente via Socket.IO do frontend para o backend, sem passar pelo mecanismo MQTT, usando o evento `send_telemetry_direct` ou equivalente suportado pelo backend.

---

### Requirement 7: Navegação e Integração na Aplicação

**User Story:** Como utilizador, quero aceder ao Simulador Real a partir da sidebar, para que seja uma página de primeira classe na aplicação.

#### Acceptance Criteria

1. THE Real_Simulator SHALL ser acessível através da rota `/real-simulator`.
2. THE Real_Simulator SHALL ser listado na sidebar do MotoGuard, no grupo "Sistema", com o label "Simulador Real" e um ícone adequado.
3. THE Real_Simulator SHALL ser uma rota protegida, acessível apenas a utilizadores autenticados.
4. WHEN o utilizador navega para outra página durante uma simulação ativa, THE Playback_Controller SHALL parar automaticamente a emissão de dados e libertar os recursos (ficheiros, timers, socket listeners).
5. THE Real_Simulator SHALL apresentar o título da página como "Simulador Real — MotoGuard" no `document.title`.
```
