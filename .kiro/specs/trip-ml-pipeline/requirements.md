# Documento de Requisitos

## Introdução

O MotoGuard IoT já dispõe de um sistema heurístico de avaliação de viagens (`trip-evaluation.service.ts`) que atribui um score 0–100 com base em regras fixas sobre TripEvents e estatísticas da viagem. A tarefa 3.7 da proposta de licenciatura exige a implementação de um **Pipeline ML para avaliação de viagens**, complementando (e eventualmente substituindo) a abordagem heurística com um modelo de machine learning treinável.

Dado que o projeto é académico e não dispõe de dados reais rotulados em quantidade suficiente, a abordagem adotada é:

1. **Feature engineering** a partir dos dados já existentes (TripEvents + stats da viagem)
2. **Anomaly detection não-supervisionado** (Isolation Forest) para detetar viagens com comportamento anómalo
3. **Score ML** derivado da pontuação de anomalia, normalizado para 0–100 e comparável com o score heurístico
4. **Treino com dados do simulador** Python, enriquecido com ficheiros GPX públicos importados
5. **Comparação explícita** entre score ML e score heurístico, com feedback ao utilizador

O pipeline corre em Python (scikit-learn), é invocado pelo backend Node.js via processo filho ou HTTP local, e os resultados são persistidos na base de dados PostgreSQL.

---

## Glossário

- **ML_Pipeline**: Componente Python responsável pelo feature engineering, treino e inferência do modelo ML.
- **Feature_Extractor**: Módulo do ML_Pipeline que transforma dados brutos de uma viagem num vetor de features numéricas.
- **Anomaly_Detector**: Modelo Isolation Forest treinado pelo ML_Pipeline para detetar viagens com comportamento anómalo.
- **ML_Score**: Pontuação 0–100 produzida pelo Anomaly_Detector para uma viagem (100 = condução normal, 0 = altamente anómala).
- **Heuristic_Score**: Pontuação 0–100 já existente, produzida pelo `evaluateTripHeuristic` em `trip-evaluation.service.ts`.
- **Trip_Evaluation_Service**: Serviço Node.js existente (`trip-evaluation.service.ts`) que calcula o Heuristic_Score.
- **ML_Pipeline_Service**: Serviço Node.js (`trip-ml-pipeline.service.ts`) que orquestra a chamada ao ML_Pipeline e agrega os resultados.
- **Training_Dataset**: Conjunto de viagens (TripEvents + stats) usado para treinar o Anomaly_Detector.
- **TripEvent**: Evento de risco registado durante uma viagem (tipo, severidade, dados do sensor).
- **TripStats**: Estatísticas agregadas de uma viagem: `maxSpeedKmh`, `maxRollDeg`, `maxGForce`, `distanceKm`, `avgSpeedKmh`, `durationSeconds`.
- **TripSource**: Origem da viagem — `SIMULATOR`, `GPX_IMPORTED` ou `DEVICE_REAL`.
- **Feature_Vector**: Array de valores numéricos que representa uma viagem para o modelo ML.
- **Model_Artifact**: Ficheiro serializado (`.pkl`) com o modelo treinado e os parâmetros de normalização.
- **Feedback_Label**: Texto explicativo gerado pelo ML_Pipeline que descreve os fatores que mais contribuíram para o ML_Score.
- **Comparison_Report**: Estrutura de dados que contém o Heuristic_Score, o ML_Score e a análise das diferenças entre ambos.

---

## Requisitos

### Requisito 1: Feature Engineering a partir de Dados de Viagem

**User Story:** Como investigador/desenvolvedor, quero que o sistema extraia automaticamente features numéricas de cada viagem, para que o modelo ML possa processar dados heterogéneos (eventos, stats, perfil) de forma uniforme.

#### Critérios de Aceitação

1. THE Feature_Extractor SHALL produzir um Feature_Vector com dimensão fixa para qualquer viagem, independentemente do número de TripEvents.
2. WHEN uma viagem não tem TripEvents, THE Feature_Extractor SHALL preencher as features de contagem de eventos com o valor zero.
3. THE Feature_Extractor SHALL incluir no Feature_Vector as seguintes features de contagem de eventos por tipo: `count_HARD_BRAKING`, `count_EXCESSIVE_LEAN`, `count_HIGH_VIBRATION`, `count_OVERHEAT`, `count_LOW_VOLTAGE`, `count_CRASH_DETECTED`, `count_RAPID_ACCELERATION`, `count_TIRE_PRESSURE_LOW`, `count_OIL_PRESSURE_LOW`, `count_SPEEDING`.
4. THE Feature_Extractor SHALL incluir no Feature_Vector as seguintes features de severidade: `count_INFO`, `count_WARNING`, `count_CRITICAL`.
5. THE Feature_Extractor SHALL incluir no Feature_Vector as seguintes TripStats normalizadas: `maxSpeedKmh`, `maxRollDeg`, `maxGForce`, `distanceKm`, `avgSpeedKmh`, `durationSeconds`.
6. WHERE o perfil da mota está disponível, THE Feature_Extractor SHALL incluir features relativas ao perfil: `speed_ratio` (maxSpeedKmh / profile.maxSpeedKmh), `roll_ratio` (maxRollDeg / profile.typicalMaxRollDeg), `gforce_ratio` (maxGForce / profile.crashGForce).
7. IF o perfil da mota não está disponível, THEN THE Feature_Extractor SHALL substituir as features relativas ao perfil pelo valor zero.
8. THE Feature_Extractor SHALL incluir no Feature_Vector a feature `events_per_km` (total de eventos / distanceKm), com valor zero quando distanceKm é zero.
9. THE Feature_Extractor SHALL incluir no Feature_Vector a feature `critical_ratio` (count_CRITICAL / total_events), com valor zero quando não há eventos.
10. THE Feature_Extractor SHALL normalizar todas as features numéricas contínuas com StandardScaler antes de as passar ao Anomaly_Detector.

---

### Requisito 2: Treino do Modelo de Anomaly Detection

**User Story:** Como desenvolvedor, quero treinar um modelo Isolation Forest com dados do simulador e GPX importados, para que o sistema aprenda o padrão de condução "normal" e consiga identificar viagens anómalas.

#### Critérios de Aceitação

1. THE ML_Pipeline SHALL implementar um script de treino (`train.py`) que lê viagens da base de dados PostgreSQL e treina o Anomaly_Detector.
2. WHEN o script de treino é executado, THE ML_Pipeline SHALL usar apenas viagens com `status = COMPLETED` para construir o Training_Dataset.
3. THE ML_Pipeline SHALL aceitar viagens de qualquer TripSource (`SIMULATOR`, `GPX_IMPORTED`, `DEVICE_REAL`) no Training_Dataset.
4. WHEN o Training_Dataset contém menos de 10 viagens, THE ML_Pipeline SHALL registar um aviso e recusar o treino, retornando um erro descritivo.
5. THE ML_Pipeline SHALL usar o algoritmo Isolation Forest (scikit-learn) com parâmetros configuráveis: `n_estimators`, `contamination`, `random_state`.
6. WHEN o treino é concluído com sucesso, THE ML_Pipeline SHALL serializar o Model_Artifact (modelo + StandardScaler) para um ficheiro `.pkl` no diretório `ml/models/`.
7. THE ML_Pipeline SHALL registar no log: número de viagens usadas no treino, parâmetros do modelo, e caminho do Model_Artifact gerado.
8. THE ML_Pipeline SHALL incluir um script de geração de dados de treino sintéticos (`generate_training_data.py`) que usa o simulador Python para produzir viagens com diferentes perfis de condução (normal, agressivo, anómalo).
9. WHEN o script de geração de dados sintéticos é executado, THE ML_Pipeline SHALL gerar pelo menos 3 categorias de viagens: condução normal, condução agressiva (muitos eventos WARNING/CRITICAL), e viagem com queda (CRASH_DETECTED).

---

### Requisito 3: Inferência e Cálculo do ML_Score

**User Story:** Como sistema, quero calcular um ML_Score para uma viagem concluída, para que o utilizador receba uma avaliação complementar à heurística.

#### Critérios de Aceitação

1. WHEN uma viagem é concluída (`status = COMPLETED`), THE ML_Pipeline_Service SHALL invocar o ML_Pipeline para calcular o ML_Score dessa viagem.
2. THE ML_Pipeline SHALL converter a pontuação de anomalia do Isolation Forest (intervalo [-1, 1]) num ML_Score no intervalo [0, 100], onde 100 representa condução completamente normal e 0 representa comportamento altamente anómalo.
3. IF o Model_Artifact não existe ou está corrompido, THEN THE ML_Pipeline_Service SHALL retornar o Heuristic_Score como score final e registar um aviso no log com a razão da falha.
4. THE ML_Pipeline SHALL produzir um Feedback_Label com pelo menos uma frase explicativa sobre os fatores que mais contribuíram para o ML_Score (ex: "Número elevado de travagens bruscas", "Inclinação acima do padrão normal").
5. THE ML_Pipeline SHALL completar a inferência para uma viagem em menos de 5 segundos.
6. THE ML_Pipeline_Service SHALL expor o ML_Score e o Feedback_Label através do endpoint `GET /api/trips/:id/evaluation`.

---

### Requisito 4: Comparação entre Score ML e Score Heurístico

**User Story:** Como utilizador e como investigador, quero ver a comparação entre o score ML e o score heurístico, para que possa entender as diferenças entre as duas abordagens e validar o modelo.

#### Critérios de Aceitação

1. THE ML_Pipeline_Service SHALL produzir um Comparison_Report que contém: `heuristicScore`, `mlScore`, `scoreDelta` (mlScore - heuristicScore), `agreement` (booleano: diferença < 15 pontos), e `dominantFactors` (lista de features com maior peso na decisão ML).
2. WHEN o Comparison_Report é gerado, THE ML_Pipeline_Service SHALL classificar o nível de concordância: `HIGH` (delta < 10), `MEDIUM` (delta 10–25), `LOW` (delta > 25).
3. THE ML_Pipeline_Service SHALL incluir o Comparison_Report na resposta do endpoint `GET /api/trips/:id/evaluation`.
4. WHEN o `agreement` é falso e o `mlScore` é significativamente inferior ao `heuristicScore` (delta < -20), THE ML_Pipeline_Service SHALL incluir no Comparison_Report uma nota explicativa de que o modelo ML detetou padrões anómalos não capturados pelas regras heurísticas.
5. THE ML_Pipeline_Service SHALL persistir o ML_Score e o modelo usado (`ml_model_version`) na tabela `trips` da base de dados PostgreSQL.

---

### Requisito 5: API de Avaliação de Viagem

**User Story:** Como frontend, quero aceder à avaliação completa de uma viagem (heurística + ML) através de um único endpoint, para que possa apresentar os resultados ao utilizador de forma integrada.

#### Critérios de Aceitação

1. THE ML_Pipeline_Service SHALL expor o endpoint `GET /api/trips/:id/evaluation` protegido por autenticação JWT.
2. WHEN o endpoint é chamado, THE ML_Pipeline_Service SHALL retornar uma resposta JSON com a estrutura: `{ score, model, mlScore, mlFeedback, comparisonReport, severityCounts, typeCounts, penalties }`.
3. IF a viagem não pertence ao utilizador autenticado, THEN THE ML_Pipeline_Service SHALL retornar HTTP 403.
4. IF a viagem não existe, THEN THE ML_Pipeline_Service SHALL retornar HTTP 404.
5. WHEN o ML_Pipeline não está disponível (ml.enabled = false ou Model_Artifact ausente), THE ML_Pipeline_Service SHALL retornar a avaliação heurística com `mlScore: null` e `mlFeedback: "Modelo ML não disponível"`.
6. THE ML_Pipeline_Service SHALL responder ao endpoint em menos de 10 segundos, incluindo o tempo de inferência ML.

---

### Requisito 6: Integração com o Frontend

**User Story:** Como utilizador, quero ver o ML_Score e o Comparison_Report na página de detalhe de viagem, para que possa compreender a avaliação da minha condução.

#### Critérios de Aceitação

1. THE Frontend SHALL apresentar o ML_Score e o Heuristic_Score lado a lado na página de detalhe de viagem (`/trips/:id`).
2. WHEN o ML_Score está disponível, THE Frontend SHALL apresentar o Comparison_Report com o nível de concordância e os fatores dominantes.
3. WHEN o ML_Score não está disponível (`mlScore: null`), THE Frontend SHALL apresentar apenas o Heuristic_Score com uma nota "Avaliação ML não disponível".
4. THE Frontend SHALL apresentar o Feedback_Label do ML_Pipeline de forma legível ao utilizador, sem expor terminologia técnica interna.
5. THE Frontend SHALL apresentar um indicador visual (cor/ícone) para o nível de concordância: verde (HIGH), amarelo (MEDIUM), vermelho (LOW).

---

### Requisito 7: Treino com Dados GPX Públicos

**User Story:** Como investigador, quero enriquecer o Training_Dataset com ficheiros GPX públicos importados, para que o modelo ML tenha maior diversidade de padrões de condução.

#### Critérios de Aceitação

1. THE ML_Pipeline SHALL aceitar viagens com `source = GPX_IMPORTED` no Training_Dataset, usando as TripStats disponíveis (distanceKm, avgSpeedKmh, maxSpeedKmh) e os TripEvents gerados pelo sistema heurístico durante a importação GPX.
2. WHEN uma viagem GPX_IMPORTED não tem TripEvents (importação sem análise heurística), THE Feature_Extractor SHALL usar apenas as TripStats disponíveis, preenchendo as features de eventos com zero.
3. THE ML_Pipeline SHALL incluir no log de treino a distribuição de TripSource no Training_Dataset (quantas viagens SIMULATOR, GPX_IMPORTED, DEVICE_REAL).

---

### Requisito 8: Serialização e Deserialização do Model_Artifact

**User Story:** Como sistema, quero que o Model_Artifact seja serializável e deserializável de forma fiável, para que o modelo treinado possa ser carregado em qualquer momento sem perda de informação.

#### Critérios de Aceitação

1. THE ML_Pipeline SHALL serializar o Model_Artifact usando `joblib.dump` para o formato `.pkl`.
2. THE ML_Pipeline SHALL deserializar o Model_Artifact usando `joblib.load` antes de cada inferência.
3. FOR ALL Model_Artifacts válidos, serializar e depois deserializar o modelo SHALL produzir resultados de inferência idênticos para o mesmo Feature_Vector (propriedade de round-trip).
4. WHEN o ficheiro `.pkl` está corrompido ou tem versão incompatível, THE ML_Pipeline SHALL lançar uma exceção descritiva e não produzir um ML_Score silenciosamente errado.
5. THE ML_Pipeline SHALL incluir no Model_Artifact os metadados: `trained_at` (timestamp ISO 8601), `n_samples`, `feature_names`, `model_version`.

---

### Requisito 9: Configuração e Observabilidade

**User Story:** Como desenvolvedor, quero controlar o pipeline ML através de configuração e ter visibilidade sobre o seu estado, para que possa ativar/desativar o modelo sem alterar código.

#### Critérios de Aceitação

1. THE ML_Pipeline_Service SHALL ler a variável de ambiente `ML_ENABLED` (valores: `true`/`false`) para ativar ou desativar o pipeline ML em runtime.
2. WHEN `ML_ENABLED=false`, THE ML_Pipeline_Service SHALL usar exclusivamente o Heuristic_Score e registar no log que o pipeline ML está desativado.
3. THE ML_Pipeline_Service SHALL expor o endpoint `GET /api/ml/status` que retorna: `{ enabled, modelLoaded, modelVersion, trainedAt, nSamples }`.
4. IF o Model_Artifact não foi treinado ainda, THEN o endpoint `GET /api/ml/status` SHALL retornar `{ enabled: true, modelLoaded: false }`.
5. THE ML_Pipeline SHALL registar no log o tempo de inferência para cada viagem avaliada.
