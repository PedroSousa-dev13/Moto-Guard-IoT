# Requirements Document

## Introduction

Esta feature transforma a pipeline ML do MotoGuard IoT de um sistema batch on-demand para um sistema de detecção de anomalias em tempo real. Atualmente, a pipeline ML só executa quando o utilizador abre manualmente o detalhe de uma viagem completada, tornando o ML "invisível" e pouco útil. Esta feature implementa execução automática da pipeline ao completar viagens, detecção de anomalias em tempo real durante a viagem (streaming ML), alertas preditivos baseados em padrões anómalos, e visualização do score ML live no Dashboard.

## Glossary

- **ML_Pipeline**: Sistema Python que executa inferência com Isolation Forest para calcular ML_Score e identificar anomalias
- **ML_Score**: Pontuação 0-100 calculada pelo modelo ML que indica normalidade da condução (100 = normal, 0 = altamente anómalo)
- **Heuristic_Score**: Pontuação 0-100 calculada por regras heurísticas baseadas em eventos e thresholds do perfil da mota
- **Online_Detector**: Modelo ML incremental que processa telemetria em streaming durante a viagem ativa
- **ML_Anomaly_Alert**: Alerta gerado em tempo real quando o Online_Detector deteta padrão anómalo durante a viagem
- **Telemetry_Stream**: Fluxo contínuo de dados MQTT recebidos durante uma viagem ativa
- **Trip_Completion_Trigger**: Evento que ocorre quando uma viagem muda de status ACTIVE para COMPLETED
- **Backend_Service**: Serviço Node.js que orquestra MQTT, Socket.IO, Prisma e invoca a ML_Pipeline
- **Frontend_Dashboard**: Interface React que mostra telemetria e alertas em tempo real via WebSocket
- **MQTT_Service**: Serviço que recebe telemetria do simulador/dispositivo via broker Mosquitto
- **Socket_Service**: Serviço que gere conexões WebSocket e emite eventos para o Frontend_Dashboard
- **Isolation_Forest**: Algoritmo de detecção de anomalias usado no modelo ML atual (batch)
- **Model_Artifact**: Ficheiro .pkl que contém o modelo treinado, scaler e metadados
- **Feature_Vector**: Array de features numéricas extraídas da telemetria para inferência ML

## Requirements

### Requirement 1: Execução Automática da Pipeline ML

**User Story:** Como utilizador, quero que a pipeline ML execute automaticamente ao completar uma viagem, para que eu possa ver o ML_Score sem ter de abrir manualmente o TripDetail.

#### Acceptance Criteria

1. WHEN a Trip status changes to COMPLETED, THE Backend_Service SHALL invoke the ML_Pipeline within 5 seconds
2. WHEN the ML_Pipeline completes successfully, THE Backend_Service SHALL persist the ML_Score and mlModelVersion in the Trip record
3. IF the ML_Pipeline fails or times out, THEN THE Backend_Service SHALL persist only the Heuristic_Score and log the error
4. THE Backend_Service SHALL execute the ML_Pipeline asynchronously without blocking trip completion
5. WHEN multiple trips complete simultaneously, THE Backend_Service SHALL queue ML_Pipeline invocations to prevent resource exhaustion

### Requirement 2: Online ML Detector para Streaming

**User Story:** Como utilizador, quero que o sistema detete anomalias em tempo real durante a viagem, para que eu seja alertado imediatamente sobre padrões de condução perigosos.

#### Acceptance Criteria

1. WHEN a Trip status changes to ACTIVE, THE Backend_Service SHALL initialize an Online_Detector instance for that deviceId
2. WHEN telemetry arrives via MQTT_Service during an active trip, THE Backend_Service SHALL pass the telemetry to the Online_Detector within 100ms
3. THE Online_Detector SHALL process each telemetry sample and return an anomaly_score between 0.0 and 1.0
4. WHEN the anomaly_score exceeds 0.7 for 3 consecutive samples, THE Backend_Service SHALL generate an ML_Anomaly_Alert
5. WHEN a Trip status changes to COMPLETED or CRASH_DETECTED, THE Backend_Service SHALL destroy the Online_Detector instance for that deviceId
6. THE Online_Detector SHALL use an incremental learning algorithm compatible with streaming data
7. THE Online_Detector SHALL maintain a sliding window of the last 30 telemetry samples for context

### Requirement 3: Alertas Preditivos ML

**User Story:** Como utilizador, quero receber alertas quando o ML deteta padrões anómalos em tempo real, para que eu possa ajustar a minha condução antes de um evento crítico.

#### Acceptance Criteria

1. WHEN an ML_Anomaly_Alert is generated, THE Backend_Service SHALL persist a TripEvent with type ML_ANOMALY_DETECTED
2. WHEN an ML_Anomaly_Alert is generated, THE Socket_Service SHALL emit an alert event to all connected Frontend_Dashboard clients
3. THE ML_Anomaly_Alert SHALL include a human-readable message describing the dominant anomalous features
4. THE ML_Anomaly_Alert SHALL include the current anomaly_score, latitude, longitude, speedKmh, rollDeg, and gForce
5. THE Frontend_Dashboard SHALL display ML_Anomaly_Alert notifications in real-time with severity WARNING
6. THE Frontend_Dashboard SHALL show ML_Anomaly_Alert events in the Alertas page with a distinctive ML badge

### Requirement 4: Score ML Live no Dashboard

**User Story:** Como utilizador, quero ver o score ML atualizar em tempo real durante a viagem, para que eu possa monitorizar a qualidade da minha condução enquanto conduzo.

#### Acceptance Criteria

1. WHEN telemetry arrives during an active trip, THE Backend_Service SHALL calculate a live_ml_score based on the Online_Detector anomaly_score
2. THE live_ml_score SHALL be normalized to a 0-100 scale where 100 represents normal driving and 0 represents highly anomalous
3. WHEN the live_ml_score is calculated, THE Socket_Service SHALL emit a score_update event to the Frontend_Dashboard
4. THE Frontend_Dashboard SHALL display a visual gauge showing the live_ml_score with color coding: green (80-100), yellow (50-79), red (0-49)
5. THE Frontend_Dashboard SHALL update the live_ml_score gauge within 200ms of receiving the score_update event
6. WHILE no trip is active, THE Frontend_Dashboard SHALL display the ML score gauge as inactive with value "—"
7. THE Frontend_Dashboard SHALL show a sparkline chart of the last 60 seconds of live_ml_score history

### Requirement 5: Persistência de Eventos ML

**User Story:** Como utilizador, quero que os alertas ML sejam guardados na base de dados, para que eu possa rever o histórico de anomalias detetadas em cada viagem.

#### Acceptance Criteria

1. WHEN an ML_Anomaly_Alert is generated, THE Backend_Service SHALL create a TripEvent record with type ML_ANOMALY_DETECTED
2. THE TripEvent SHALL include severity WARNING, message describing the anomaly, and telemetry snapshot
3. THE TripEvent SHALL be associated with the active Trip via tripId foreign key
4. WHEN a user views TripDetail, THE Frontend_Dashboard SHALL display ML_ANOMALY_DETECTED events in the events timeline
5. THE TripEvent table SHALL support the new EventType value ML_ANOMALY_DETECTED

### Requirement 6: Integração com MQTT Service

**User Story:** Como sistema, quero que o Online_Detector receba telemetria do MQTT_Service, para que possa processar dados em tempo real conforme chegam.

#### Acceptance Criteria

1. WHEN MQTT_Service receives telemetry on the telemetry topic, THE Backend_Service SHALL check if a trip is active for that deviceId
2. IF a trip is active, THEN THE Backend_Service SHALL pass the telemetry to the Online_Detector before emitting to Socket_Service
3. THE Backend_Service SHALL not block MQTT message processing while waiting for Online_Detector inference
4. THE Online_Detector inference SHALL complete within 50ms per telemetry sample
5. IF Online_Detector inference exceeds 50ms, THEN THE Backend_Service SHALL log a performance warning and skip that sample

### Requirement 7: Integração com Socket.IO

**User Story:** Como sistema, quero que os alertas ML e scores live sejam enviados via WebSocket, para que o Frontend_Dashboard receba atualizações em tempo real.

#### Acceptance Criteria

1. WHEN an ML_Anomaly_Alert is generated, THE Socket_Service SHALL emit an "ml_alert" event to all connected clients
2. WHEN a live_ml_score is calculated, THE Socket_Service SHALL emit a "ml_score_update" event to all connected clients
3. THE "ml_alert" event payload SHALL include: deviceId, motoModel, timestamp, anomaly_score, message, severity, latitude, longitude
4. THE "ml_score_update" event payload SHALL include: deviceId, live_ml_score, timestamp
5. THE Socket_Service SHALL throttle "ml_score_update" events to maximum 2 per second per deviceId to prevent frontend overload

### Requirement 8: Modelo Python Online

**User Story:** Como sistema, quero um modelo Python que suporte inferência incremental, para que possa processar telemetria em streaming sem recarregar o modelo a cada sample.

#### Acceptance Criteria

1. THE Online_Detector SHALL load the Model_Artifact once during initialization
2. THE Online_Detector SHALL expose a process_sample method that accepts a Feature_Vector and returns anomaly_score
3. THE Online_Detector SHALL use a stateful algorithm that maintains internal state between samples
4. THE Online_Detector SHALL support One-Class SVM or Isolation Forest with partial_fit capability
5. THE Online_Detector SHALL normalize features using the same scaler from the Model_Artifact
6. THE Online_Detector SHALL handle missing or invalid features by substituting with neutral values

### Requirement 9: Fallback e Degradação Graciosa

**User Story:** Como sistema, quero que o sistema continue a funcionar mesmo se o ML falhar, para que os utilizadores não percam funcionalidade crítica.

#### Acceptance Criteria

1. IF the Model_Artifact file does not exist, THEN THE Backend_Service SHALL disable Online_Detector and log a warning
2. IF Online_Detector initialization fails, THEN THE Backend_Service SHALL disable real-time ML and continue with heuristic-only mode
3. IF Online_Detector inference raises an exception, THEN THE Backend_Service SHALL log the error and skip ML processing for that sample
4. WHEN ML is disabled, THE Frontend_Dashboard SHALL hide the live_ml_score gauge and show a "ML indisponível" message
5. THE Backend_Service SHALL still execute the batch ML_Pipeline on trip completion even if Online_Detector is disabled

### Requirement 10: Configuração e Feature Flags

**User Story:** Como administrador, quero poder ativar/desativar o ML em tempo real via configuração, para que possa controlar o comportamento do sistema sem redeployment.

#### Acceptance Criteria

1. THE Backend_Service SHALL read an environment variable ML_REALTIME_ENABLED to enable/disable Online_Detector
2. WHEN ML_REALTIME_ENABLED is false, THE Backend_Service SHALL not initialize Online_Detector instances
3. WHEN ML_REALTIME_ENABLED is false, THE Backend_Service SHALL still execute the batch ML_Pipeline on trip completion
4. THE Backend_Service SHALL log the ML_REALTIME_ENABLED status on startup
5. WHERE ML_REALTIME_ENABLED is true, THE Backend_Service SHALL validate that the Model_Artifact exists before enabling Online_Detector

### Requirement 11: Performance e Escalabilidade

**User Story:** Como sistema, quero que o processamento ML em tempo real não degrade a performance do sistema, para que a telemetria continue a fluir sem atrasos.

#### Acceptance Criteria

1. THE Online_Detector inference SHALL complete within 50ms for 95% of samples
2. THE Backend_Service SHALL process telemetry at a rate of at least 10 samples per second per active trip
3. THE Backend_Service SHALL support up to 5 concurrent active trips with Online_Detector enabled
4. THE Online_Detector SHALL consume no more than 100MB of memory per instance
5. IF system memory exceeds 80% usage, THEN THE Backend_Service SHALL disable new Online_Detector instances and log a warning

### Requirement 12: Logging e Observabilidade

**User Story:** Como desenvolvedor, quero logs detalhados do processamento ML, para que possa diagnosticar problemas e otimizar performance.

#### Acceptance Criteria

1. WHEN Online_Detector is initialized, THE Backend_Service SHALL log the deviceId and model version
2. WHEN an ML_Anomaly_Alert is generated, THE Backend_Service SHALL log the deviceId, anomaly_score, and dominant features
3. WHEN Online_Detector inference exceeds 50ms, THE Backend_Service SHALL log a performance warning with inference time
4. WHEN Online_Detector is destroyed, THE Backend_Service SHALL log the deviceId and total samples processed
5. THE Backend_Service SHALL log ML_Pipeline invocation start, completion, and duration for batch processing

### Requirement 13: Testes e Validação

**User Story:** Como desenvolvedor, quero testes automatizados para o ML em tempo real, para que possa garantir que o sistema funciona corretamente.

#### Acceptance Criteria

1. THE Online_Detector SHALL have unit tests covering initialization, process_sample, and error handling
2. THE Backend_Service SHALL have integration tests simulating telemetry streams with known anomalies
3. THE integration tests SHALL verify that ML_Anomaly_Alert events are generated when anomaly_score exceeds threshold
4. THE integration tests SHALL verify that live_ml_score updates are emitted via Socket_Service
5. THE integration tests SHALL verify graceful degradation when Model_Artifact is missing

### Requirement 14: Migração de Schema

**User Story:** Como sistema, quero que o schema da base de dados suporte o novo tipo de evento ML, para que possa persistir alertas ML.

#### Acceptance Criteria

1. THE Prisma schema SHALL add ML_ANOMALY_DETECTED to the EventType enum
2. THE Backend_Service SHALL run a database migration to update the EventType enum
3. THE migration SHALL be idempotent and safe to run multiple times
4. THE migration SHALL not require downtime or data loss
5. WHEN the migration completes, THE Backend_Service SHALL be able to create TripEvent records with type ML_ANOMALY_DETECTED

### Requirement 15: UI Dashboard - Gauge ML Score

**User Story:** Como utilizador, quero ver um gauge visual do score ML no Dashboard, para que possa monitorizar a qualidade da condução de forma intuitiva.

#### Acceptance Criteria

1. THE Frontend_Dashboard SHALL display a circular gauge labeled "ML Score" in the gauges section
2. THE gauge SHALL show the live_ml_score value from 0 to 100
3. THE gauge SHALL use color coding: green (80-100), yellow (50-79), red (0-49)
4. THE gauge SHALL animate smoothly when the value changes
5. WHILE no trip is active, THE gauge SHALL display "—" and be visually dimmed
6. THE gauge SHALL include a small "ML" badge to distinguish it from the Heuristic_Score

### Requirement 16: UI Dashboard - Sparkline Histórico

**User Story:** Como utilizador, quero ver um gráfico temporal do score ML, para que possa ver como a qualidade da condução evoluiu durante a viagem.

#### Acceptance Criteria

1. THE Frontend_Dashboard SHALL display a sparkline chart below the ML Score gauge
2. THE sparkline SHALL show the last 60 seconds of live_ml_score history
3. THE sparkline SHALL use the same color coding as the gauge
4. THE sparkline SHALL scroll horizontally as new data arrives
5. WHEN a trip ends, THE sparkline SHALL clear and reset for the next trip

### Requirement 17: UI Alertas - Badge ML

**User Story:** Como utilizador, quero identificar facilmente alertas gerados pelo ML, para que possa distingui-los de alertas heurísticos.

#### Acceptance Criteria

1. WHEN displaying a TripEvent with type ML_ANOMALY_DETECTED, THE Frontend_Dashboard SHALL show a distinctive "ML" badge
2. THE badge SHALL use a purple color to distinguish from heuristic event colors
3. THE alert message SHALL include the dominant anomalous features in human-readable format
4. THE alert SHALL be clickable to show full details including anomaly_score and telemetry snapshot

