# Pipeline ML para Viagens GPX

## Visão Geral

O sistema MotoGuard agora suporta dois modelos ML especializados:

1. **Modelo de Telemetria** (`isolation_forest.pkl`) - Para viagens do simulador com 24 features
2. **Modelo GPX** (`gpx_model.pkl`) - Para viagens importadas de ficheiros GPX com 10 features

O script `infer.py` deteta automaticamente o tipo de viagem (via campo `source`) e usa o modelo apropriado.

## Features do Modelo GPX

O modelo GPX extrai 10 features específicas:

### Trip Stats (5)
- `maxSpeedKmh` - Velocidade máxima
- `avgSpeedKmh` - Velocidade média
- `distanceKm` - Distância percorrida
- `durationSeconds` - Duração da viagem
- `maxElevation` - Altitude máxima

### Speed Patterns (3)
- `speed_variance` - Variância de velocidade (indica condução errática)
- `acceleration_events` - Mudanças bruscas de velocidade (> 20 km/h)
- `stop_count` - Número de paragens (velocidade < 2 km/h)

### Elevation Patterns (2)
- `elevation_gain` - Ganho de altitude total
- `elevation_loss` - Perda de altitude total

## Treino do Modelo GPX

### 1. Gerar Dados de Treino

```bash
docker exec motoguard-backend python /ml/generate_gpx_training_data.py --count 30
```

Isto gera 90 viagens GPX sintéticas (30 por categoria):
- **normal**: Condução suave, velocidades 40-80 km/h
- **aggressive**: Condução agressiva, velocidades 80-150 km/h
- **erratic**: Condução errática, muitas paragens

### 2. Treinar o Modelo

```bash
docker exec motoguard-backend python /ml/train_gpx.py
```

Isto cria o ficheiro `ml/models/gpx_model.pkl` com:
- Modelo: Isolation Forest (100 árvores)
- Scaler: StandardScaler
- Metadata: versão, data de treino, número de samples

### 3. Verificar

O modelo está pronto quando:
- Ficheiro `ml/models/gpx_model.pkl` existe
- Log mostra: `[train_gpx] Model_Artifact guardado em: ...`

## Inferência Automática

O script `infer.py` deteta automaticamente o tipo de viagem:

```python
# Se trip.source == "GPX_IMPORTED"
#   → Usa gpx_model.pkl + GpxFeatureExtractor
# Caso contrário
#   → Usa isolation_forest.pkl + FeatureExtractor
```

Não é necessário modificar o backend - a deteção é automática.

## Testar

1. Importar um ficheiro GPX via frontend
2. Abrir o detalhe da viagem
3. Verificar que o Score ML aparece (não "não disponível")
4. Verificar logs do backend: `[infer] Usando modelo GPX: ...`

## Estrutura de Ficheiros

```
ml/
├── features.py              # Extrator para telemetria (24 features)
├── features_gpx.py          # Extrator para GPX (10 features)
├── train.py                 # Treino modelo telemetria
├── train_gpx.py             # Treino modelo GPX
├── infer.py                 # Inferência (deteta tipo automaticamente)
├── generate_training_data.py      # Gera dados telemetria
├── generate_gpx_training_data.py  # Gera dados GPX
└── models/
    ├── isolation_forest.pkl # Modelo telemetria
    └── gpx_model.pkl        # Modelo GPX
```

## Troubleshooting

### "Modelo GPX não disponível"
- Executar: `docker exec motoguard-backend python /ml/train_gpx.py`
- Verificar que `ml/models/gpx_model.pkl` existe

### Score ML sempre igual
- Gerar mais dados de treino com `--count` maior
- Verificar que há viagens de diferentes categorias

### Erro "Training_Dataset insuficiente"
- Executar `generate_gpx_training_data.py` primeiro
- Mínimo: 10 viagens GPX na BD
