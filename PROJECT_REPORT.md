# 🏍️ MotoGuard IoT — Relatório Técnico do Projeto

## Sistema de Monitorização Inteligente para Motociclos com Deteção de Anomalias Baseada em Machine Learning

---

**Projeto de Licenciatura 2025/2026**

**Autor:** Pedro Miguel Fernandes de Sousa  
**Instituição:** Universidade de Trás-os-Montes e Alto Douro (UTAD)  
**Orientadores:** Cristiano Pendão, Arsénio Reis  
**Data:** Maio 2026

---

## 📋 Resumo Executivo

O **MotoGuard IoT** é um sistema distribuído de Internet das Coisas (IoT) diseñado para a monitorização em tempo real de motociclos, combinando telemetria, deteção de anomalias baseada em Machine Learning e análise pós-viagem. O sistema utiliza uma arquitetura de microsserviços containerizada com Docker Compose, integrando um backend Node.js/Express, frontend React 19, bases de dados PostgreSQL e InfluxDB, um simulador Python realista e um pipeline de Machine Learning com Isolation Forest.

**Palavras-chave:** IoT, Telemetria, MQTT, Socket.IO, Machine Learning, Isolation Forest, React, Node.js, Docker, TypeScript, Python, PostgreSQL, InfluxDB.

---

## 1. Introdução e Contextualização

### 1.1 Motivação do Projeto

A monitorização de motociclos em tempo real representa um desafio técnico significativo devido à complexidade dos dados envolvidos (telemetria, IMU, GPS, saúde do veículo) e aos requisitos de baixa latência. Este projeto surge da necessidade de criar uma solução integrada que permita:

1. **Monitorização em tempo real** de parâmetros críticos do motociclo
2. **Deteção automática de eventos de risco** (quedas, travagens bruscas, sobreaquecimento)
3. **Análise pós-viagem** com classificação automática e scoring de segurança
4. **Simulação realista** para desenvolvimento e teste sem necessidade de hardware físico
5. **Machine Learning** para deteção de anomalias não capturadas por regras heurísticas

### 1.2 Objetivos

O objetivo principal foi desenvolver um sistema IoT completo que permitisse a um motociclista monitorizar a sua condução, receber alertas em tempo real e analisar o seu desempenho após cada viagem. Os objetivos específicos incluem:

- Implementar um pipeline de telemetria em tempo real com latência inferior a 100ms
- Criar um simulador Python com 8 perfis de motociclos distintos e física realista
- Desenvolver um módulo de deteção de eventos heurísticos (quedas, sobreaquecimento, falhas elétricas)
- Implementar um pipeline ML para deteção de anomalias com Isolation Forest
- Classificar automaticamente viagens em categorias (COMMUTE, WEEKEND_RIDE, TRACK_DAY, OFF_ROAD)
- Disponibilizar uma interface web responsiva com visualizações interativas

### 1.3 Âmbito e Limitações

O projeto foi desenvolvido como Proposta de Licenciatura com foco na arquitetura de software e na implementação funcional. As principais limitações identificadas incluem:

- O simulador reproduz condições controladas; dados de sensores reais (IRL) são limitados
- O modelo ML foi treinado com dados sintéticos; validação com dados reais é necessária
- O sistema não inclui integração com hardware físico real (apenas simulador)
- A deteção de anomalias em tempo real tem limitações de desempenho em dispositivos com poucos recursos

---

## 2. Arquitetura do Sistema

### 2.1 Visão Geral da Arquitetura

O MotoGuard IoT segue uma arquitetura de microsserviços com os seguintes componentes principais:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MOTO GUARD IOT                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐         │
│  │   FRONTEND       │    │    BACKEND       │    │   SIMULADOR      │         │
│  │   React 19       │◄──►│   Node.js 20     │◄──►│   Python 3.12    │         │
│  │   TypeScript    │    │   Express        │    │   Paho-MQTT      │         │
│  │   Socket.IO     │    │   Prisma         │    │   Física Realista│         │
│  │   Tailwind CSS  │    │   Socket.IO      │    │   8 Perfis       │         │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘         │
│           │                      │                      │                   │
│           │              ┌───────▼───────┐              │                   │
│           │              │   MQTT Broker  │              │                   │
│           │              │   Mosquitto    │◄─────────────┘                   │
│           │              └───────┬────────┘                                    │
│           │                      │                                            │
│  ┌────────▼────────┐    ┌───────▼───────┐    ┌──────────────────┐            │
│  │  PostgreSQL 16   │    │   InfluxDB 2  │    │   ML Pipeline    │            │
│  │  (Dados Relac.) │    │  (Séries Temp)│    │  (Scikit-learn)  │            │
│  │  Users, Trips,   │    │  (Telemetria) │    │  (Isolation F.)  │            │
│  │  Motorcycles     │    │                │    │  (Z-Score Detect)│            │
│  └─────────────────┘    └────────────────┘    └──────────────────┘            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxos de Dados

O sistema processa dados em três fluxos principais:

#### 2.2.1 Telemetria em Tempo Real
```
Simulador Python → MQTT (Mosquitto) → Backend MQTT Service → 
  ├── InfluxDB (armazenamento)
  ├── Socket.IO (broadcast)
  ├── Heurísticas Service (deteção de eventos)
  └── Realtime Anomaly Service (ML em tempo real)
```

#### 2.2.2 Operações de Utilizador
```
Frontend (React) → REST API (Express) → Prisma ORM → PostgreSQL
```

#### 2.2.3 Pipeline ML
```
Trip concluída → trip-ml-pipeline.service.ts → 
  child_process spawn → Python infer.py → Isolation Forest →
  score + feedback → PostgreSQL (persistência)
```

### 2.3 Stack Tecnológico

#### Frontend
| Componente | Versão | Descrição |
|-------------|--------|-----------|
| React | 19.x | Framework UI moderno |
| TypeScript | 5.6.x | Tipagem estática |
| Vite | 6.x | Build tool de última geração |
| Tailwind CSS | 4.x | Framework CSS utility-first |
| Socket.IO Client | 4.8.x | WebSocket em tempo real |
| Leaflet | 1.9.x | Mapas interativos OpenStreetMap |
| Recharts | 3.x | Gráficos React |
| React Router DOM | 7.x | Router SPA |
| Redux Toolkit | 2.9.x | Estado global |
| i18next | - | Internacionalização PT/EN |
| jsPDF + html2canvas | - | Exportação PDF |

#### Backend
| Componente | Versão | Descrição |
|-------------|--------|-----------|
| Node.js | 20.x | Runtime JavaScript server-side |
| TypeScript | 5.6.x | Tipagem estática |
| Express | 4.21.x | Framework web minimalista |
| Prisma | 7.4.x | ORM com geração de tipos |
| Socket.IO | 4.8.x | Servidor WebSocket |
| MQTT.js | 5.x | Cliente MQTT |
| JWT (jsonwebtoken) | 9.x | Autenticação baseada em tokens |
| bcryptjs | 3.x | Hashing de passwords |
| Resend | 4.x | Serviço de email transacional |
| Multer | 2.x | Upload de ficheiros |
| fast-xml-parser | 5.x | Parsing GPX |
| express-rate-limit | 8.x | Rate limiting |
| swagger-ui-express | 5.x | Documentação API |
| @influxdata/influxdb-client | 1.35.x | Cliente InfluxDB |

#### Bases de Dados
| Base de Dados | Versão | Uso |
|---------------|--------|-----|
| PostgreSQL | 16-alpine | Dados relacionais (users, motorcycles, trips, events) |
| InfluxDB | 2 | Séries temporais (telemetria) |

#### IoT & Simulação
| Componente | Versão | Descrição |
|-------------|--------|-----------|
| Python | 3.12.x | Simulador e ML |
| Paho-MQTT | 2.x | Cliente MQTT Python |
| Eclipse Mosquitto | 2 | Broker MQTT |

#### Machine Learning
| Componente | Versão | Descrição |
|-------------|--------|-----------|
| Scikit-learn | 1.5.x | Isolation Forest |
| Pandas | 2.x | Manipulação de dados |
| NumPy | - | Computação numérica |
| Joblib | - | Serialização de modelos |

#### Infraestrutura
| Componente | Descrição |
|------------|-----------|
| Docker | Contentorização |
| Docker Compose | Orquestração |

---

## 3. Componentes do Sistema

### 3.1 Backend (Node.js + Express)

O backend é o núcleo do sistema, implementado em Node.js 20 com TypeScript. Estrutura-se em camadas bem definidas:

```
backend/src/
├── index.ts                    # Entry point (Express + Socket.IO + MQTT)
├── config/
│   ├── env.ts                  # Variáveis de ambiente tipadas
│   └── swagger.ts              # Documentação OpenAPI 3.0
├── controllers/                # Controladores (8 ficheiros)
│   ├── auth.controller.ts      # Registo, login, perfil
│   ├── auth-reset.controller.ts # Recuperação de password
│   ├── command.controller.ts   # Envio de comandos ao simulador
│   ├── gpx.controller.ts       # Import/export GPX
│   ├── health.controller.ts    # Health check
│   ├── motorcycle.controller.ts # Gestão de motas
│   ├── telemetry.controller.ts  # Telemetria atual e histórica
│   └── trip.controller.ts      # Gestão de viagens
├── routes/                     # Rotas Express (14 ficheiros)
│   ├── index.ts                # Agregador de rotas
│   ├── auth.routes.ts          # /api/auth/*
│   ├── gpx.routes.ts           # /api/gpx/*
│   └── ... (outras)
├── services/                  # Lógica de negócio (15 serviços)
│   ├── mqtt.service.ts         # Cliente MQTT
│   ├── socket.service.ts       # WebSocket (1285 linhas!)
│   ├── influx.service.ts       # InfluxDB client
│   ├── prisma.service.ts       # ORM Prisma
│   ├── telemetry.store.ts      # Estado em memória
│   ├── heuristics.service.ts   # Deteção de eventos heurísticos
│   ├── trip-ml-pipeline.service.ts # Pipeline ML
│   ├── trip-categorization.service.ts # Classificação de viagens
│   ├── trip-feed.service.ts   # Feed de viagens com scores
│   ├── trip-evaluation.service.ts # Scoring heurístico
│   ├── trip-clustering.service.ts # K-means clustering
│   ├── realtime-anomaly.service.ts # Z-score anomaly detection
│   ├── device-association.service.ts #Associação device-mota
│   ├── email.service.ts        # Emails de emergência
│   └── gpx-import.service.ts   # Parser GPX
├── middleware/
│   ├── auth.middleware.ts      # JWT authentication
│   ├── csrf.middleware.ts      # CSRF protection
│   └── perf-logger.middleware.ts # Performance logging
├── utils/
│   ├── crypto.ts               # AES-256-GCM encryption
│   ├── validate-telemetry.ts  # Validação payload MQTT
│   └── setup-static-serving.ts # Static file serving
└── models/
    └── telemetry.model.ts      # Interfaces TypeScript telemetria
```

#### 3.1.1 Autenticação e Autorização

O sistema implementa autenticação JWT com as seguintes características:

- **JWT em cookie httpOnly** (7 dias de validade)
- **CSRF protection** para rotas protegidas (state-changing methods)
- **Rate limiting** em rotas de autenticação (15min, 20 tentativas)
- **Password hashing** com bcrypt (cost 12)
- **Token de reset** com expiry (24h) e hash em BD

#### 3.1.2 Pipeline de Telemetria

O backend subscreve o tópico MQTT `motoguard/telemetria` e processa cada mensagem:

1. **Validação:** Verifica estrutura do payload com `validateTelemetryPayload()`
2. **Storage:** Escreve no InfluxDB (`influxService.writeTelemetry()`)
3. **Broadcast:** Emite para todos os clientes Socket.IO (`telemetry_update`)
4. **Eventos:** Avalia com heurísticas (`handleHeuristicEvents()`)
5. **Anomalias:** Processa com ML em tempo real (`realtimeAnomalyService`)
6. **Lifecycle:** Gère início/fim de viagens (`handleTripLifecycle()`)

#### 3.1.3 Gestão de Viagens

O `SocketService` implementa uma máquina de estados para viagens:

- **Início:** Triggered por velocidade > 5 km/h ou evento `TRIP_STARTED`
- **Ativa:** Atualiza estatísticas (velocidade máx, inclinação máx, distância)
- **Fim:** Triggered por velocidade < 2 km/h por 10s ou evento `TRIP_ENDED`
- **Flush parcial:** A cada 300 ticks (~30s) para não perder dados

#### 3.1.4 API REST

A API expõe ~30 endpoints organizados em:

| Prefixo | Funcionalidade |
|---------|----------------|
| `/api/auth/*` | Autenticação (registro, login, perfil, recuperação) |
| `/api/motorcycles/*` | Gestão de motas |
| `/api/trips/*` | Viagens (listar, detalhe, avaliação, categorização) |
| `/api/telemetry/*` | Telemetria (atual, por viagem) |
| `/api/gpx/*` | Import/export GPX |
| `/api/command` | Envio de comandos ao simulador |
| `/api/health` | Health check |
| `/api/ml/status` | Estado do modelo ML |

Swagger UI disponível em `http://localhost:3000/api-docs`.

### 3.2 Frontend (React 19)

O frontend é uma SPA (Single Page Application) React 19 com TypeScript, buildada com Vite 6.

```
frontend/src/
├── App.tsx                  # Router + Providers
├── main.tsx                 # Entry point
├── pages/                   # 17 páginas
│   ├── HomePage.tsx         # Landing page
│   ├── Login.tsx            # Login/registo
│   ├── Dashboard.tsx       # Dashboard tempo real
│   ├── Trips.tsx           # Lista de viagens
│   ├── TripDetail.tsx      # Detalhe de viagem
│   ├── Map.tsx             # Mapa interativo
│   ├── Gpx.tsx             # Import GPX
│   ├── GpxSimulator.tsx    # Simulador GPX
│   ├── RealSimulator.tsx   # Simulador dados reais
│   ├── SimulatorContexts.tsx # Contexto simulador
│   ├── Analytics.tsx       # Analytics + heatmaps
│   ├── Alertas.tsx         # Lista de alertas
│   ├── Garage.tsx          # Gestão de motas
│   ├── Settings.tsx        # Configurações
│   ├── Profile.tsx         # Perfil utilizador
│   ├── ResetPassword.tsx   # Recuperação password
│   └── About.tsx           # Sobre o projeto
├── components/             # 24+ componentes
│   ├── auth/               # ProtectedRoute, OnboardingGuard
│   ├── dashboard/          # Gauges, cards
│   ├── trips/              # Trip list item, details
│   ├── ui/                 # Componentes base
│   ├── gpx/                # GPX components
│   ├── Layout.tsx          # Layout principal
│   ├── Header.tsx          # Header
│   ├── Navbar.tsx          # Navegação
│   ├── Sidebar.tsx         # Sidebar
│   ├── GaugeCard.tsx       # Gauges velocidade/RPM
│   ├── MapCard.tsx         # Mapa incorporado
│   ├── IMUCard.tsx         # Visualização IMU
│   ├── StatusCard.tsx      # Status conexão
│   ├── TempVoltCard.tsx    # Temperatura/Voltagem
│   ├── CompactMetric.tsx   # Métrica compacta
│   ├── CommandPanel.tsx    # Painel de comandos
│   ├── EventHeatmap.tsx    # Heatmap eventos
│   ├── LazyChart.tsx       # Gráfico lazy-loaded
│   ├── PlaybackControls.tsx # Controles playback
│   ├── PlaybackSlider.tsx  # Slider timeline
│   ├── SOSCountdown.tsx    # Contagem regressiva SOS
│   ├── NotificationCenter.tsx # Centro notificações
│   └── OfflineBanner.tsx  # Banner offline
├── hooks/
│   ├── useAuth.tsx         # Hook autenticação
│   ├── useSocket.ts        # Hook Socket.IO
│   └── useNotifications.ts # Hook notificações
├── i18n/                   # Internacionalização
│   ├── I18nContext.tsx     # Contexto i18n
│   ├── TranslatedApp.tsx   # App traduzida
│   ├── translations.ts     # Traduções PT/EN (~200 chaves)
│   └── README.md           # Documentação i18n
├── demo/                   # Modo Demo (sem auth)
│   ├── DemoContext.tsx     # Contexto demo
│   ├── DemoBanner.tsx      # Banner demo
│   ├── demoData.ts         # Dados demo (5 viagens)
│   ├── demoAPIInterceptor.ts # Interceptador API
│   └── demoSocketEmitter.ts  # Emissor Socket.IO demo
├── services/
│   └── api.ts              # Axios client
├── types/
│   ├── index.ts            # Tipos globais
│   └── telemetry.ts        # Tipos telemetria
├── utils/                  # Utilitários
│   ├── alerts.ts           # Utilitários alertas
│   ├── analytics.ts        # Utilitários analytics
│   ├── settings.ts         # Utilitários settings
│   ├── categoryDeviceMap.ts # Mapa categoria-device
│   ├── categoryImageMap.ts  # Mapa categoria-imagem
│   ├── export.ts           # Utilitários exportação
│   ├── trips.ts            # Utilitários viagens
│   ├── tripComparison.ts   # Comparação viagens
│   ├── gpx.ts              # Utilitários GPX
│   ├── gpxParseClient.ts   # Parser GPX client
│   └── gpxRouteConverter.ts # Conversor rota
├── gpx-simulator/         # Componentes simulador GPX
└── real-simulator/        # Componentes simulador IRL
```

#### 3.2.1 Funcionalidades Principais

- **Dashboard em Tempo Real:** Gauges interativos, mapa, telemetria viva
- **Gestão de Viagens:** Lista paginada, feed com scores, detalhe
- **Visualização GPX:** Mapa com rota, charts de velocidade/elevação
- **Simuladores:** GPX Simulator, Real Simulator (IRL)
- **Analytics:** Estatísticas agregadas, heatmaps, clustering
- **Alertas:** Lista filtrável de eventos por tipo/severidade
- **Garagem:** CRUD de motas com perfis
- **Configurações:** Preferências, linguagem, tema

### 3.3 Simulador Python

O simulador é uma aplicação Python 3.12 que gera telemetria realista via MQTT.

```
simulador/
├── headless_simulator.py   # Simulador principal (~1070 linhas)
├── config.py               # Configuração e perfis
├── moto_physics.py         # Física do motociclo
├── routes.py               # Lógica de rotas GPX + OSRM
├── verify_coherence.py    # Verificação de coerência
├── test_physics.py        # Testes física
├── requirements.txt        # paho-mqtt
├── config.py               # DEVICE_ID, MQTT config, perfis
└── odometer_state.json    # Estado do odómetro persistido
```

#### 3.3.1 Perfis de Motociclos (8 modelos)

| Modelo | Vel. Máx | RPM Máx | Temp Motor | Peso | Inclinação Típica | Roll Queda | G-Force Queda |
|--------|----------|---------|-------------|------|-------------------|-------------|---------------|
| Scooter | 120 km/h | 9 000 | 60-90°C | 130 kg | 25° | 55° | 2.0G |
| Naked | 200 km/h | 12 000 | 70-105°C | 190 kg | 40° | 70° | 2.5G |
| Desportiva | 299 km/h | 15 000 | 80-110°C | 200 kg | 55° | 85° | 3.0G |
| Trail | 200 km/h | 10 000 | 70-100°C | 230 kg | 35° | 65° | 2.0G |
| Custom/Cruiser | 180 km/h | 7 000 | 65-95°C | 300 kg | 30° | 50° | 1.8G |
| Motocross/Enduro | 130 km/h | 13 000 | 80-115°C | 110 kg | 40° | 75° | 3.5G |
| Touring | 220 km/h | 8 000 | 60-95°C | 350 kg | 30° | 45° | 1.5G |
| Supermotard | 160 km/h | 11 000 | 75-110°C | 150 kg | 50° | 80° | 3.0G |

#### 3.3.2 Eventos Simuláveis

- Queda (crash) com thresholds configuráveis
- Falha de alternador (low voltage)
- Sobreaquecimento do motor
- Travagem brusca (high deceleration)
- Aceleração rápida
- Inclinação excessiva
- ABS ativado
- TC ativado

#### 3.3.3 Rotas GPX

O simulador suporte rotas GPX reais com:
- **Parsing:** Via fast-xml-parser
- **Snap to Roads:** Integração OSRM opcional
- **Playback:** Interpolação temporal dos waypoints

### 3.4 Machine Learning Pipeline

O sistema ML está implementado em Python 3.11 com scikit-learn.

```
ml/
├── infer.py                    # Inferência (deteta tipo de dados)
├── train.py                    # Treino Isolation Forest
├── train_gpx.py                # Treino modelo GPX
├── generate_training_data.py   # Geração dados sintéticos
├── generate_gpx_training_data.py # Geração dados GPX
├── retrain_gpx_with_real_data.py # Retreino com dados reais
├── features.py                 # Extração features (24) - telemetria
├── features_gpx.py             # Extração features (10) - GPX
├── clustering.py              # K-means clustering estilos
├── online_detector.py         # Z-score detetor tempo real
├── check_gpx_data.py          # Verificação dados GPX
├── test_anomaly.py            # Testes deteção anomalias
├── test_clustering.py         # Testes clustering
├── models/
│   ├── isolation_forest.pkl   # Modelo telemetria
│   └── gpx_model.pkl          # Modelo GPX
├── tests/
│   └── test_infer.py          # Testes inferência
├── requirements.txt            # scikit-learn, pandas, numpy, joblib
├── README_GPX.md              # Documentação GPX ML
└── Dockerfile                  # Container ML
```

#### 3.4.1 Modelos de Machine Learning

**Modelo 1: Isolation Forest (Telemetria)**
- **Input:** 24 features (velocidade máx, RPM máx, inclinação máx, G-force máx, temperatura máx, distância, eventos, etc.)
- **Output:** Anomaly score (0-1), feedback label, dominant features

**Modelo 2: Isolation Forest (GPX)**
- **Input:** 10 features (distância, elevacao gain/loss, velocidade média/máx, tempo total, etc.)
- **Output:** Similar ao modelo de telemetria

**Modelo 3: K-Means (Driving Style)**
- **Input:** Features de condução
- **Output:** Cluster (AGGRESSIVE, DEFENSIVE, ECONOMY)

#### 3.4.2 Deteção de Anomalias em Tempo Real

O `realtime-anomaly.service.ts` no backend invoca `online_detector.py` que:
1. Mantém buffer de 100 pontos por device
2. Aplica throttling (1 Hz real, a cada 10 ticks)
3. Executa Z-score detection
4. Emite evento `realtime_anomaly` via Socket.IO

### 3.5 Base de Dados

#### PostgreSQL (Dados Relacionais)

Schema Prisma com 6 modelos:

1. **User** — Utilizadores (email, passwordHash, name, emergencyContact, resendApiKey encriptada)
2. **MotorcycleProfile** — Perfis de motas (8 perfis com thresholds)
3. **Motorcycle** — Motas dos utilizadores (deviceId, profileId)
4. **Trip** — Viagens (source, status, mlScore, category, drivingStyle)
5. **TripEvent** — Eventos de risco (14 tipos, 3 severidades)
6. **GpxData** — Dados GPX importados (waypoints, bounds)

#### InfluxDB (Séries Temporais)

- **Measurement:** `telemetry`
- **Tags:** `device_id`, `moto_model`
- **Fields:** speed_kmh, rpm, gear, throttle_pct, engine_temp_c, voltage, roll_deg, pitch_deg, yaw_deg, g_force, latitude, longitude, oil_pressure_bar, tire_pressure_front_bar, tire_pressure_rear_bar
- **Retenção:** 30 dias

---

## 4. Implementação e Decisões de Design

### 4.1 Arquitetura de Microsserviços

O sistema foi desenhado como microsserviços para permitir:
- **Escalabilidade independente** de cada componente
- **Desenvolvimento paralelo** (frontend, backend, ML)
- **Manutenção facilitada** (falha num serviço não colapsa o resto)
- **Tecnologias otimizadas** (Python para ML, Node.js para I/O, React para UI)

### 4.2 Padrões de Código

#### Backend (TypeScript)
- **Separação de responsabilidades:** Controllers → Services → Repositories
- **Tipagem rigorosa:** Interfaces para todos os payloads
- **Error handling:** Try-catch com logging estruturado
- **Async/await:** Preferência a promises sobre callbacks
- **Graceful shutdown:** Cleanup de connections no SIGTERM

#### Frontend (React)
- **Hooks:** useAuth, useSocket, useNotifications
- **Context API:** AuthProvider, DemoProvider, I18nProvider
- **Component composition:** Layout > Page > Components
- **State management:** Redux Toolkit para estado global, React Query para server state

### 4.3 Padrões de Segurança

- **JWT com cookie httpOnly:** Previne XSS theft
- **CSRF protection:** Double-submit cookie pattern
- **Rate limiting:** Previne brute-force
- **Input validation:** Validação tanto no frontend (Forms) como no backend (Controllers)
- **Password hashing:** bcrypt com cost 12
- **Encryption:** AES-256-GCM para dados sensíveis (Resend API keys)
- **SQL injection:** Prevenida via Prisma ORM (parameterized queries)
- **JWT sub validation:** Validação estrita do campo `sub` (deve ser string)

### 4.4 Decisões de Design Controversas

1. **Demo Mode绕过 autenticação:** Feito para apresentações, mas identificado como risco no audit (H1)

2. **Volume mount sobrescreve dist/ em dev:** Permite hot-reload, mas causa confusão em produção (M2)

3. **Buffer de telemetria em memória:** Não persiste no disco, mas OK para demos (dados efémeros)

4. **ML inferência síncrona com timeout:** Bloqueia request até 5s, mas com fallback heurístico (_req 3.5)

---

## 5. Testing e Qualidade de Código

### 5.1 Testes Backend

O projeto usa **Vitest** para testes:

```bash
# Executar testes
npm test

# Com coverage
npm run test:coverage
```

- **Coverage thresholds:** 80% statements, branches, functions, lines
- **Test files:** Em `backend/src/**/*.test.ts` (coverage excludes generated/)
- **58 testes** documentados como passing no audit

### 5.2 Testes Frontend

- Vitest com jsdom environment
- React Testing Library
- Test files em `frontend/src/**/*.test.tsx`

### 5.3 Testes Python (ML)

- pytest para testes ML
- test_anomaly.py, test_clustering.py, test_infer.py

---

## 6. Questões de Segurança (Audit Report)

O projeto foi submetido a um audit de segurança com os seguintes findings:

### HIGH Severity (8)
1. Demo mode bypasses authentication (H1)
2. Planning files littering repository root (H2)
3. Legacy code not removed (H3)
4. Prisma generated code committed to git (H4)
5. Missing ENCRYPTION_KEY in docker-compose.yml (H5)
6. getStoredUserId() uses localStorage (H6)
7. localStorage.clear() in Settings (H7)
8. DEVICE_ID hardcoded in simulator (H8)

### MEDIUM Severity (4)
1. Missing APP_URL and RESEND_API_KEY in docker-compose.yml (M1)
2. Volume mount overrides container build (M2)
3. Auth reset routes lack rate limiting (M3)
4. `as any` type safety violations (M4)

### LOW Severity (5)
1. README outdated versions (L1)
2. README placeholder screenshots (L2)
3. Duplicate images in public/motos/ (L3)
4. app/.env on disk — risk of accidental commit (L4)
5. Orphaned 3D model `app/models/VR-Mobil.glb` (L5)

---

## 7. Lições Aprendidas e Trabalho Futuro

### 7.1 Lições Aprendidas

1. **Arquitetura de microsserviços** com Docker Compose facilita desenvolvimento mas complica debugging
2. **TypeScript em ambos frontend e backend** melhora DX significativamente
3. **Prisma ORM** simplifica muito o acesso a BD mas requer cuidado com generated code
4. **Socket.IO** facilita WebSocket mas requer gestão cuidadosa de estado (o SocketService tem 1285 linhas!)
5. **ML em produção** requer fallback para heurístico (REQ 9.1, 9.2)

### 7.2 Trabalho Futuro

1. **Hardware real:** Integrar com sensores ESP32/Arduino
2. **PWA:** Service workers para offline-first
3. **Dashboards partilháveis:** Links públicos para relatórios
4. **Live location sharing:** Compartilhar localização em tempo real
5. **Integração com apps externas:** Strava, Google Maps

---

## 8. Conclusões

O MotoGuard IoT representa um sistema completo de IoT para monitorização de motociclos, demonstrando competência em:

- **Arquitetura de software** distribuída e escalável
- **Desenvolvimento full-stack** (React, Node.js, Python)
- **Bases de dados** relacionais e de séries temporais
- **Machine Learning** aplicada (Isolation Forest, clustering)
- **DevOps** (Docker, Docker Compose)
- **Qualidade de código** (TypeScript, testes, tipagem)

O projeto atingiu os objetivos principais de demostrar um sistema IoT funcional com telemetria em tempo real, deteção de anomalias ML e análise pós-viagem. As limitações identificadas (dados reais, validação ML) são direcionadas para trabalho futuro.

---

## Referências

- React Documentation: https://react.dev
- Node.js Documentation: https://nodejs.org/docs
- Prisma Documentation: https://www.prisma.io/docs
- Socket.IO Documentation: https://socket.io/docs
- MQTT Protocol: https://mqtt.org
- Scikit-learn Documentation: https://scikit-learn.org
- InfluxDB Documentation: https://docs.influxdata.com/influxdb
- Isolation Forest: https://scikit-learn.org/stable/modules/outlier_detection.html

---

**Documento gerado em:** Maio 2026  
**Última atualização:** 2026-05-15  
**Versão:** 1.0