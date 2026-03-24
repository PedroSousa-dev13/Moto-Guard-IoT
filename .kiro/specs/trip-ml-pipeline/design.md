# Design Técnico — Pipeline ML para Avaliação de Viagens

## Visão Geral

O ML_Pipeline é um componente Python independente que corre dentro do container do backend (ou num container separado). O backend Node.js invoca-o via `child_process.spawn`, passando dados de entrada por stdin (JSON) e recebendo resultados por stdout (JSON). O modelo Isolation Forest é treinado offline com dados do simulador e persistido como `.pkl`.

---

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│  Backend Node.js                                            │
│                                                             │
│  trip.controller.ts                                         │
│    GET /api/trips/:id/evaluation ──► trip-ml-pipeline.service.ts
│    GET /api/ml/status            ──► trip-ml-pipeline.service.ts
│                                         │                   │
│                                   (heuristic)         (ml enabled?)
│                                         │                   │
│                              trip-evaluation.service.ts   spawn()
│                                         │                   │
└─────────────────────────────────────────┼───────────────────┼─
                                          │                   │
                                          │            ┌──────▼──────┐
                                          │            │  ml/infer.py │
                                          │            │  stdin: JSON │
                                          │            │  stdout: JSON│
                                          │            └──────┬──────┘
                                          │                   │
                                          │            ┌──────▼──────┐
                                          │            │  features.py │
                                          │            │  model.pkl   │
                                          │            └─────────────┘
                                          │
                              ┌───────────▼───────────┐
                              │  Comparison_Report     │
                              │  + persist mlScore     │
                              └───────────────────────┘
```

---

## Fluxo de Treino

```
1. python ml/train.py
2. Lê viagens COMPLETED da BD PostgreSQL (via psycopg2 + DATABASE_URL)
3. Para cada viagem: features.py extrai Feature_Vector (24 features)
4. StandardScaler.fit_transform(X)
5. IsolationForest.fit(X_scaled)
6. joblib.dump({ model, scaler, metadata }, ml/models/model.pkl)
```

## Fluxo de Inferência (por viagem)

```
1. Node.js: trip-ml-pipeline.service.ts recebe tripId + userId
2. Carrega dados da viagem (trip + events + profile) do PostgreSQL
3. Serializa para JSON → stdin do processo ml/infer.py
4. infer.py: carrega model.pkl, extrai features, calcula anomaly_score
5. Converte score [-1,1] → ML_Score [0,100]
6. Gera Feedback_Label com features dominantes
7. Retorna JSON por stdout
8. Node.js: agrega Heuristic_Score + ML_Score → Comparison_Report
9. Persiste mlScore + mlModelVersion na tabela trips
```

---

## Feature_Vector (24 features, ordem fixa)

| # | Nome | Fonte |
|---|------|-------|
| 0 | count_HARD_BRAKING | TripEvents |
| 1 | count_EXCESSIVE_LEAN | TripEvents |
| 2 | count_HIGH_VIBRATION | TripEvents |
| 3 | count_OVERHEAT | TripEvents |
| 4 | count_LOW_VOLTAGE | TripEvents |
| 5 | count_CRASH_DETECTED | TripEvents |
| 6 | count_RAPID_ACCELERATION | TripEvents |
| 7 | count_TIRE_PRESSURE_LOW | TripEvents |
| 8 | count_OIL_PRESSURE_LOW | TripEvents |
| 9 | count_SPEEDING | TripEvents |
| 10 | count_INFO | TripEvents |
| 11 | count_WARNING | TripEvents |
| 12 | count_CRITICAL | TripEvents |
| 13 | maxSpeedKmh | TripStats |
| 14 | maxRollDeg | TripStats |
| 15 | maxGForce | TripStats |
| 16 | distanceKm | TripStats |
| 17 | avgSpeedKmh | TripStats |
| 18 | durationSeconds | TripStats |
| 19 | speed_ratio | maxSpeedKmh / profile.maxSpeedKmh (0 se sem perfil) |
| 20 | roll_ratio | maxRollDeg / profile.typicalMaxRollDeg (0 se sem perfil) |
| 21 | gforce_ratio | maxGForce / profile.crashGForce (0 se sem perfil) |
| 22 | events_per_km | total_events / distanceKm (0 se distanceKm=0) |
| 23 | critical_ratio | count_CRITICAL / total_events (0 se sem eventos) |

---

## Interface JSON stdin/stdout (Node.js ↔ Python)

### Input (stdin → infer.py)
```json
{
  "trip": {
    "id": "uuid",
    "maxSpeedKmh": 120.5,
    "maxRollDeg": 35.2,
    "maxGForce": 1.8,
    "distanceKm": 45.3,
    "avgSpeedKmh": 78.1,
    "startedAt": "2026-01-01T10:00:00Z",
    "endedAt": "2026-01-01T10:35:00Z"
  },
  "events": [
    { "type": "HARD_BRAKING", "severity": "WARNING" }
  ],
  "profile": {
    "maxSpeedKmh": 200,
    "typicalMaxRollDeg": 45,
    "crashRollThreshold": 60,
    "crashGForce": 3.5
  }
}
```

### Output (stdout ← infer.py)
```json
{
  "mlScore": 82,
  "anomalyScore": 0.12,
  "feedbackLabel": "Condução dentro dos padrões normais. Ligeira tendência para travagens bruscas.",
  "dominantFeatures": ["count_HARD_BRAKING", "maxSpeedKmh"],
  "modelVersion": "isolation-forest-v1",
  "inferenceMs": 45
}
```

### Output de erro
```json
{
  "error": "Model artifact not found: ml/models/model.pkl",
  "mlScore": null
}
```

---

## Alterações ao Schema Prisma

```prisma
model Trip {
  // ... campos existentes ...
  mlScore          Float?   @map("ml_score")
  mlModelVersion   String?  @map("ml_model_version")
}
```

Nova migration: `add_ml_score_to_trips`

---

## Endpoints REST

### GET /api/trips/:id/evaluation
Protegido por JWT. Retorna avaliação completa.

**Response 200:**
```json
{
  "score": 75,
  "model": "heuristic-v1",
  "mlScore": 82,
  "mlFeedback": "Condução dentro dos padrões normais.",
  "comparisonReport": {
    "heuristicScore": 75,
    "mlScore": 82,
    "scoreDelta": 7,
    "agreement": true,
    "agreementLevel": "HIGH",
    "dominantFactors": ["count_HARD_BRAKING"],
    "note": null
  },
  "severityCounts": { "INFO": 2, "WARNING": 1, "CRITICAL": 0 },
  "typeCounts": { "HARD_BRAKING": 1 },
  "penalties": []
}
```

**Response quando ML indisponível:**
```json
{
  "score": 75,
  "model": "heuristic-v1",
  "mlScore": null,
  "mlFeedback": "Modelo ML não disponível",
  "comparisonReport": null,
  ...
}
```

### GET /api/ml/status
Público (ou protegido por JWT, a decidir na implementação).

**Response 200:**
```json
{
  "enabled": true,
  "modelLoaded": true,
  "modelVersion": "isolation-forest-v1",
  "trainedAt": "2026-03-20T10:00:00Z",
  "nSamples": 42
}
```

---

## Estrutura de Ficheiros

```
ml/
├── features.py              # Feature_Extractor
├── train.py                 # Script de treino (lê BD, treina, guarda .pkl)
├── infer.py                 # Script de inferência (stdin/stdout JSON)
├── generate_training_data.py # Geração de dados sintéticos
├── requirements.txt         # scikit-learn, psycopg2-binary, joblib, numpy
└── models/
    └── .gitkeep

app/backend/src/
├── services/
│   └── trip-ml-pipeline.service.ts  # Reescrever stub
├── controllers/
│   └── trip.controller.ts           # Adicionar /evaluation endpoint
└── routes/
    └── trip.routes.ts               # Adicionar rota GET /:id/evaluation

app/prisma/
└── schema.prisma                    # Adicionar mlScore, mlModelVersion

app/frontend/src/pages/
└── TripDetail.tsx                   # Adicionar secção ML Score
```

---

## Correctness Properties

1. **Feature_Vector_Dimension**: Para qualquer viagem válida, `len(extract_features(trip)) == 24`
2. **Feature_Vector_No_NaN**: Nenhum elemento do Feature_Vector é NaN ou Inf
3. **ML_Score_Range**: `0 <= mlScore <= 100` para qualquer input válido
4. **Score_Monotonicity**: Viagem com CRASH_DETECTED tem mlScore ≤ viagem sem eventos (mesmas stats)
5. **Fallback_On_Missing_Model**: Se model.pkl não existe, mlScore é null e heuristicScore é retornado
6. **Round_Trip_Serialization**: `joblib.load(joblib.dump(model))` produz scores idênticos
7. **Zero_Events_Vector**: Viagem sem eventos → features 0–12 são todas zero
8. **Profile_Ratio_Zero_Without_Profile**: Sem perfil → features 19–21 são zero
9. **Events_Per_Km_Zero_Division**: distanceKm=0 → events_per_km=0 (sem divisão por zero)
10. **Critical_Ratio_Zero_No_Events**: Sem eventos → critical_ratio=0
11. **Comparison_Agreement_HIGH**: |mlScore - heuristicScore| < 10 → agreementLevel == "HIGH"
12. **Comparison_Note_On_Large_Delta**: mlScore - heuristicScore < -20 → note != null
13. **Training_Minimum_Samples**: Training_Dataset < 10 viagens → treino recusado com erro

---

## Estratégia de Testes

### Python (pytest + Hypothesis)
- `test_features.py`: property tests para Feature_Vector (dimensão, sem NaN, zero-division)
- `test_infer.py`: testes de integração com model.pkl mock
- `test_train.py`: treino com dataset sintético mínimo (10 viagens)

### Node.js (Vitest)
- `trip-ml-pipeline.service.test.ts`: mock do child_process, testar fallback, Comparison_Report
- Testar agreementLevel para diferentes deltas
