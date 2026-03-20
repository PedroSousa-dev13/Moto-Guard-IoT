# Plano de Implementação: trip-ml-pipeline

## Visão Geral

Pipeline ML para avaliação de viagens MotoGuard IoT. Usa Isolation Forest (scikit-learn) para anomaly detection, invocado pelo backend Node.js via `child_process.spawn`. O ML_Score (0–100) complementa o Heuristic_Score existente e é apresentado ao utilizador com um Comparison_Report.

## Tasks

- [x] 1. Estrutura base do módulo Python ML
  - Criar diretório `ml/` com `ml/models/.gitkeep` e `ml/requirements.txt`
  - `ml/requirements.txt` deve incluir: `scikit-learn`, `psycopg2-binary`, `joblib`, `numpy`
  - _Requirements: 2.5, 2.6, 8.1_

- [x] 2. Implementar Feature_Extractor (`ml/features.py`)
  - [x] 2.1 Implementar a classe `FeatureExtractor` com método `extract(trip_data) -> np.ndarray`
    - Features de contagem por tipo de evento (10 features): `count_HARD_BRAKING`, `count_EXCESSIVE_LEAN`, `count_HIGH_VIBRATION`, `count_OVERHEAT`, `count_LOW_VOLTAGE`, `count_CRASH_DETECTED`, `count_RAPID_ACCELERATION`, `count_TIRE_PRESSURE_LOW`, `count_OIL_PRESSURE_LOW`, `count_SPEEDING`
    - Features de severidade (3 features): `count_INFO`, `count_WARNING`, `count_CRITICAL`
    - TripStats (6 features): `maxSpeedKmh`, `maxRollDeg`, `maxGForce`, `distanceKm`, `avgSpeedKmh`, `durationSeconds`
    - Features de perfil (3 features): `speed_ratio`, `roll_ratio`, `gforce_ratio` — zero se perfil ausente
    - Features derivadas (2 features): `events_per_km`, `critical_ratio`
    - Total: 24 features com dimensão fixa
    - Viagens sem TripEvents preenchem features de contagem com zero
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_
  - [x] 2.2 Expor `FEATURE_NAMES: list[str]` com os 24 nomes das features (para metadados do Model_Artifact)
    - _Requirements: 8.5_
  - [ ]* 2.3 Escrever property test para FeatureExtractor (`ml/tests/test_features.py`)
    - **Property 1: Dimensão fixa** — para qualquer trip_data válido, `len(extract(trip_data)) == 24`
    - **Validates: Requirements 1.1**
    - **Property 2: Viagem vazia** — trip sem eventos produz vetor com zeros nas 13 features de contagem/severidade
    - **Validates: Requirements 1.2**
    - **Property 3: events_per_km com distância zero** — `events_per_km == 0.0` quando `distanceKm == 0`
    - **Validates: Requirements 1.8**
    - Usar `hypothesis` com `@given(st.builds(...))`

- [x] 3. Implementar geração de dados sintéticos (`ml/generate_training_data.py`)
  - Script standalone que gera viagens sintéticas e insere na BD PostgreSQL
  - Gerar pelo menos 3 categorias: condução normal (sem eventos CRITICAL), condução agressiva (múltiplos WARNING/CRITICAL), viagem com queda (CRASH_DETECTED)
  - Ler `DATABASE_URL` de variável de ambiente
  - Registar no log o número de viagens geradas por categoria
  - _Requirements: 2.8, 2.9_

- [x] 4. Implementar script de treino (`ml/train.py`)
  - [x] 4.1 Ler viagens `status=COMPLETED` da BD PostgreSQL via `psycopg2`
    - Incluir TripEvents e TripStats de cada viagem
    - Registar distribuição de TripSource no log (SIMULATOR / GPX_IMPORTED / DEVICE_REAL)
    - _Requirements: 2.1, 2.2, 2.3, 7.3_
  - [x] 4.2 Recusar treino se Training_Dataset < 10 viagens, com erro descritivo
    - _Requirements: 2.4_
  - [x] 4.3 Treinar Isolation Forest com parâmetros configuráveis via args/env: `n_estimators`, `contamination`, `random_state`
    - Aplicar `StandardScaler` antes do treino
    - _Requirements: 2.5, 1.10_
  - [x] 4.4 Serializar Model_Artifact com `joblib.dump` para `ml/models/isolation_forest.pkl`
    - Incluir metadados: `trained_at`, `n_samples`, `feature_names`, `model_version`
    - Registar no log: nº viagens, parâmetros, caminho do artefacto
    - _Requirements: 2.6, 2.7, 8.1, 8.5_

- [ ] 5. Checkpoint — Validar pipeline Python
  - Garantir que `generate_training_data.py` corre sem erros e insere dados na BD
  - Garantir que `train.py` treina e serializa o modelo com sucesso
  - Garantir que todos os testes Python passam
  - Pedir ao utilizador confirmação antes de continuar.

- [x] 6. Implementar script de inferência (`ml/infer.py`)
  - [x] 6.1 Ler JSON de `stdin` com estrutura `{ trip, events, profile? }`
    - Deserializar Model_Artifact com `joblib.load`
    - Lançar exceção descritiva se `.pkl` corrompido ou versão incompatível
    - _Requirements: 3.2, 8.2, 8.4_
  - [x] 6.2 Calcular ML_Score: converter score Isolation Forest `[-1, 1]` → `[0, 100]`
    - Fórmula: `ml_score = round((raw_score + 1) / 2 * 100)`; 100 = normal, 0 = anómalo
    - _Requirements: 3.2_
  - [x] 6.3 Gerar Feedback_Label com pelo menos uma frase explicativa baseada nas features dominantes
    - Identificar as 3 features com maior desvio do padrão normal
    - _Requirements: 3.4_
  - [x] 6.4 Escrever resultado em `stdout` como JSON: `{ mlScore, feedbackLabel, dominantFactors, inferenceMs }`
    - Registar tempo de inferência no log (stderr)
    - _Requirements: 3.5, 9.5_
  - [ ]* 6.5 Escrever testes de inferência (`ml/tests/test_infer.py`)
    - **Property 4: Round-trip serialização** — serializar e deserializar Model_Artifact produz ML_Score idêntico para o mesmo Feature_Vector
    - **Validates: Requirements 8.3**
    - Testar fallback com `.pkl` corrompido → exceção descritiva (Requirements 8.4)
    - Testar que ML_Score está sempre em [0, 100] (Requirements 3.2)

- [x] 7. Adicionar `ML_ENABLED` à configuração do backend (`app/backend/src/config/env.ts`)
  - Adicionar `ML_ENABLED: process.env.ML_ENABLED === 'true'` ao objeto `env`
  - _Requirements: 9.1_

- [x] 8. Migração Prisma — adicionar campos ML à tabela `trips`
  - [x] 8.1 Adicionar ao modelo `Trip` em `app/prisma/schema.prisma`:
    - `mlScore Float? @map("ml_score")`
    - `mlModelVersion String? @map("ml_model_version")`
    - _Requirements: 4.5_
  - [x] 8.2 Criar migration `add_ml_score_to_trips` com `prisma migrate dev`
    - _Requirements: 4.5_

- [x] 9. Reescrever `trip-ml-pipeline.service.ts`
  - [x] 9.1 Implementar `runMlInference(tripData): Promise<MlInferenceResult>` usando `child_process.spawn` para invocar `ml/infer.py`
    - Passar dados da viagem via `stdin` como JSON
    - Ler resultado de `stdout` como JSON
    - Timeout de 5 segundos; rejeitar com erro se excedido
    - _Requirements: 3.1, 3.5_
  - [x] 9.2 Implementar fallback: se `ML_ENABLED=false` ou Model_Artifact ausente, retornar Heuristic_Score com `mlScore: null`
    - Registar aviso no log com razão da falha
    - _Requirements: 3.3, 5.5, 9.1, 9.2_
  - [x] 9.3 Implementar `buildComparisonReport(heuristicScore, mlScore, dominantFactors): ComparisonReport`
    - Calcular `scoreDelta`, `agreement` (|delta| < 15), nível de concordância: `HIGH` (<10), `MEDIUM` (10–25), `LOW` (>25)
    - Adicionar nota explicativa quando `agreement=false` e `delta < -20`
    - _Requirements: 4.1, 4.2, 4.4_
  - [x] 9.4 Persistir `mlScore` e `mlModelVersion` na tabela `trips` via Prisma após inferência bem-sucedida
    - _Requirements: 4.5_
  - [x] 9.5 Implementar `getMlStatus(): Promise<MlStatusResult>` que retorna `{ enabled, modelLoaded, modelVersion, trainedAt, nSamples }`
    - Ler metadados do Model_Artifact se existir
    - _Requirements: 9.3, 9.4_
  - [ ]* 9.6 Escrever testes do serviço (`trip-ml-pipeline.service.test.ts`)
    - Testar fallback quando `ML_ENABLED=false` → retorna Heuristic_Score, `mlScore: null`
    - Testar `buildComparisonReport` com delta < 10 → `HIGH`, delta 15 → `MEDIUM`, delta 30 → `LOW`
    - Testar nota explicativa quando `delta < -20`
    - _Requirements: 3.3, 4.1, 4.2, 4.4, 9.2_

- [x] 10. Atualizar `trip.controller.ts` e `trip.routes.ts`
  - [x] 10.1 Atualizar `getTripEvaluation` para retornar estrutura completa: `{ score, model, mlScore, mlFeedback, comparisonReport, severityCounts, typeCounts, penalties }`
    - Retornar HTTP 403 se viagem não pertence ao utilizador autenticado
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 10.2 Adicionar handler `getMlStatus` ao controller
    - _Requirements: 9.3_
  - [x] 10.3 Adicionar rota `GET /api/ml/status` em `trip.routes.ts` (protegida por `authMiddleware`)
    - _Requirements: 9.3_

- [ ] 11. Checkpoint — Validar backend Node.js
  - Garantir que todos os testes Node.js passam
  - Testar manualmente `GET /api/trips/:id/evaluation` e `GET /api/ml/status`
  - Pedir ao utilizador confirmação antes de continuar.

- [x] 12. Atualizar frontend — secção ML em `TripDetail.tsx`
  - [x] 12.1 Chamar `GET /api/trips/:id/evaluation` e guardar resultado em estado `evaluation`
    - _Requirements: 6.1_
  - [x] 12.2 Apresentar ML_Score e Heuristic_Score lado a lado num painel "Avaliação de Condução"
    - Quando `mlScore === null`, mostrar apenas Heuristic_Score com nota "Avaliação ML não disponível"
    - _Requirements: 6.1, 6.3_
  - [x] 12.3 Apresentar Comparison_Report com nível de concordância e fatores dominantes
    - Indicador visual por cor: verde (HIGH), amarelo (MEDIUM), vermelho (LOW)
    - _Requirements: 6.2, 6.5_
  - [x] 12.4 Apresentar Feedback_Label de forma legível (sem terminologia técnica interna)
    - _Requirements: 6.4_

- [ ] 13. Checkpoint final — Integração completa
  - Garantir que todos os testes Python e Node.js passam
  - Verificar fluxo completo: gerar dados → treinar modelo → avaliar viagem → ver resultado no frontend
  - Pedir ao utilizador confirmação antes de concluir.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser saltadas para MVP mais rápido
- O script `infer.py` comunica via stdin/stdout JSON para evitar dependências HTTP adicionais
- O fallback heurístico garante que o sistema funciona mesmo sem modelo treinado
- Property tests usam `hypothesis`; adicionar ao `ml/requirements.txt` se opcionais forem implementados
- A migration Prisma deve ser executada manualmente: `cd app && npx prisma migrate dev --name add_ml_score_to_trips`
