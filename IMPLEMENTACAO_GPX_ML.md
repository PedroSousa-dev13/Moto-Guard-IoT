# Implementação da Pipeline ML para GPX

## ✅ Ficheiros Criados

### 1. `ml/features_gpx.py`
Extrator de features especializado para viagens GPX com 10 features:
- Trip stats: maxSpeedKmh, avgSpeedKmh, distanceKm, durationSeconds, maxElevation
- Speed patterns: speed_variance, acceleration_events, stop_count
- Elevation patterns: elevation_gain, elevation_loss

### 2. `ml/train_gpx.py`
Script de treino do modelo Isolation Forest para viagens GPX:
- Lê viagens GPX COMPLETED da BD
- Treina modelo com 10 features
- Guarda em `ml/models/gpx_model.pkl`

### 3. `ml/generate_gpx_training_data.py`
Gerador de dados sintéticos GPX com 3 categorias:
- **normal**: Condução suave (60 km/h base, poucas paragens)
- **aggressive**: Condução agressiva (110 km/h base, acelerações bruscas)
- **erratic**: Condução errática (50 km/h base, muitas paragens)

### 4. `ml/README_GPX.md`
Documentação completa da pipeline GPX com instruções de uso.

## ✅ Ficheiros Modificados

### 1. `ml/infer.py`
Adicionada deteção automática de tipo de viagem:
- Se `trip.source == "GPX_IMPORTED"` → usa `gpx_model.pkl` + `GpxFeatureExtractor`
- Caso contrário → usa `isolation_forest.pkl` + `FeatureExtractor`
- Adicionadas mensagens de feedback para features GPX
- Adicionado campo `modelType` no output

### 2. `app/backend/src/services/trip-ml-pipeline.service.ts`
Adicionado suporte para viagens GPX:
- Campo `source` incluído no objeto enviado ao Python
- Campo `gpx_waypoints` incluído quando `source == "GPX_IMPORTED"`

## 📋 Próximos Passos (Executar no Docker)

### Passo 1: Gerar Dados de Treino GPX
```bash
docker exec motoguard-backend python /ml/generate_gpx_training_data.py --count 30
```

**Resultado esperado:**
```
[generate_gpx_training_data] A ligar à BD...
[generate_gpx_training_data] Viagens GPX inseridas: 90
  normal      : 30
  aggressive  : 30
  erratic     : 30
```

### Passo 2: Treinar Modelo GPX
```bash
docker exec motoguard-backend python /ml/train_gpx.py
```

**Resultado esperado:**
```
[train_gpx] A ligar à BD...
[train_gpx] Viagens GPX COMPLETED encontradas: 90
[train_gpx] Feature matrix: (90, 10)
[train_gpx] A treinar IsolationForest (n_estimators=100, contamination=0.1)...
[train_gpx] Model_Artifact guardado em: /ml/models/gpx_model.pkl
[train_gpx] Metadados: n_samples=90, version=gpx-isolation-forest-v1
```

### Passo 3: Verificar Ficheiro Criado
```bash
docker exec motoguard-backend ls -lh /ml/models/
```

Deve aparecer `gpx_model.pkl` com tamanho ~50-100 KB.

### Passo 4: Testar com Viagem GPX Existente

1. Abrir o frontend MotoGuard
2. Ir para "Viagens" ou "Histórico"
3. Abrir uma viagem importada de GPX
4. Verificar que o Score ML aparece (não "não disponível")
5. Verificar logs do backend:
   ```bash
   docker logs motoguard-backend --tail 50
   ```
   Deve aparecer: `[infer] Usando modelo GPX: ...`

### Passo 5 (Opcional): Importar Novo Ficheiro GPX

1. Ir para "Importar GPX" no frontend
2. Selecionar um ficheiro .gpx
3. Após importação, abrir o detalhe da viagem
4. Verificar Score ML

## 🔍 Como Funciona

### Fluxo de Inferência

```
Backend recebe pedido de avaliação
    ↓
trip-ml-pipeline.service.ts prepara dados
    ↓
Inclui campo "source" e "gpx_waypoints"
    ↓
Envia JSON para ml/infer.py via stdin
    ↓
infer.py deteta source == "GPX_IMPORTED"
    ↓
Carrega gpx_model.pkl + GpxFeatureExtractor
    ↓
Extrai 10 features dos waypoints
    ↓
Executa inferência com Isolation Forest
    ↓
Retorna mlScore + feedbackLabel
    ↓
Backend guarda na BD e retorna ao frontend
```

### Deteção Automática

O script `infer.py` verifica o campo `source`:

```python
trip_source = trip_data.get("trip", {}).get("source") or trip_data.get("source", "")
is_gpx = trip_source == "GPX_IMPORTED"

if is_gpx:
    model_path = GPX_MODEL_PATH
    extractor = GpxFeatureExtractor()
else:
    model_path = DEFAULT_MODEL_PATH
    extractor = FeatureExtractor()
```

## 🎯 Vantagens da Solução

1. **Dois modelos especializados**: Cada um otimizado para o seu tipo de dados
2. **Deteção automática**: Sem necessidade de configuração manual
3. **Fallback gracioso**: Se modelo GPX não existe, retorna erro claro
4. **Features relevantes**: GPX usa apenas dados disponíveis (sem eventos de telemetria)
5. **Compatibilidade**: Não quebra funcionalidade existente de telemetria

## 📊 Comparação de Features

| Feature | Telemetria | GPX |
|---------|-----------|-----|
| Eventos (HARD_BRAKING, etc.) | ✅ (10) | ❌ |
| Severidades (CRITICAL, etc.) | ✅ (3) | ❌ |
| maxRollDeg | ✅ | ❌ |
| maxGForce | ✅ | ❌ |
| maxSpeedKmh | ✅ | ✅ |
| avgSpeedKmh | ✅ | ✅ |
| distanceKm | ✅ | ✅ |
| durationSeconds | ✅ | ✅ |
| Elevation | ❌ | ✅ (3) |
| Speed patterns | ❌ | ✅ (3) |
| **Total** | **24** | **10** |

## ⚠️ Notas Importantes

1. **Mínimo de dados**: São necessárias pelo menos 10 viagens GPX para treinar o modelo
2. **Qualidade dos waypoints**: GPX com poucos waypoints (< 20) podem ter features imprecisas
3. **Velocidades calculadas**: Se waypoints não têm campo `speedKmh`, são calculadas via distância/tempo
4. **Fallback**: Se modelo GPX não existe, retorna erro "Modelo GPX não disponível"

## 🐛 Troubleshooting

### Erro: "Modelo GPX não disponível"
**Causa**: Ficheiro `ml/models/gpx_model.pkl` não existe  
**Solução**: Executar `docker exec motoguard-backend python /ml/train_gpx.py`

### Erro: "Training_Dataset insuficiente"
**Causa**: Menos de 10 viagens GPX na BD  
**Solução**: Executar `docker exec motoguard-backend python /ml/generate_gpx_training_data.py --count 30`

### Score ML sempre igual para todas as viagens
**Causa**: Modelo treinado com dados pouco variados  
**Solução**: Gerar mais dados com `--count` maior ou importar viagens GPX reais

### Logs mostram "Usando modelo telemetria" para viagem GPX
**Causa**: Campo `source` não está a ser enviado corretamente  
**Solução**: Verificar que `trip.source` na BD é "GPX_IMPORTED"
