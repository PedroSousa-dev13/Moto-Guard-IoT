"""
clustering.py — Agrupamento de viagens por padrão de condução usando K-means.

Input (stdin):
  [ { "trip": {...}, "events": [...], "profile": {...} }, ... ]

Output (stdout):
  [ { "tripId": str, "drivingStyle": "AGGRESSIVE" | "DEFENSIVE" | "ECONOMY", "clusterId": int }, ... ]
"""

import json
import sys
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from pathlib import Path

# Adicionar o diretório pai ao path para importar FeatureExtractor
sys.path.insert(0, str(Path(__file__).parent))
from features import FeatureExtractor, FEATURE_NAMES

def label_clusters(kmeans, scaler, feature_names):
    """
    Atribui labels semânticos aos clusters baseando-se nos centroides.
    """
    centroids = kmeans.cluster_centers_
    # Inverter o scaling para analisar os valores reais
    real_centroids = scaler.inverse_transform(centroids)
    
    # Índices das features relevantes para a decisão
    idx_hard_braking = feature_names.index("count_HARD_BRAKING")
    idx_rapid_accel = feature_names.index("count_RAPID_ACCELERATION")
    idx_avg_speed = feature_names.index("avgSpeedKmh")
    idx_max_speed = feature_names.index("maxSpeedKmh")
    
    labels = {}
    
    # Calcular um "score de agressividade" para cada cluster
    # Baseado em travagens, acelerações e velocidade
    scores = []
    for i, center in enumerate(real_centroids):
        # Normalização simplificada para comparação entre os 3 clusters
        agg_score = (center[idx_hard_braking] * 2.0 + 
                     center[idx_rapid_accel] * 1.5 + 
                     center[idx_max_speed] * 0.5)
        scores.append((i, agg_score, center[idx_avg_speed]))
    
    # Ordenar por score de agressividade decrescente
    scores.sort(key=lambda x: x[1], reverse=True)
    
    # O com maior score é AGGRESSIVE
    labels[scores[0][0]] = "AGGRESSIVE"
    
    # Entre os outros dois, o que tiver menor velocidade média costuma ser ECONOMY
    # (ou o que sobrou é DEFENSIVE)
    remaining = scores[1:]
    remaining.sort(key=lambda x: x[2]) # ordenar por velocidade média
    
    labels[remaining[0][0]] = "ECONOMY"
    labels[remaining[1][0]] = "DEFENSIVE"
    
    return labels

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            return
        
        trips_data = json.loads(raw_input)
        if not isinstance(trips_data, list) or len(trips_data) < 3:
            # Se tivermos menos de 3 viagens, não conseguimos fazer clusters significativos
            # Retornar fallback ou erro
            results = []
            for t in trips_data:
                results.append({
                    "tripId": t.get("trip", {}).get("id"),
                    "drivingStyle": "DEFENSIVE", # Fallback default
                    "clusterId": -1
                })
            print(json.dumps(results))
            return

        extractor = FeatureExtractor()
        X = extractor.extract_batch(trips_data)
        
        # 1. Normalizar dados
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # 2. Executar K-means (K=3 conforme o plano)
        n_clusters = 3
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_ids = kmeans.fit_predict(X_scaled)
        
        # 3. Mapear clusters para labels semânticos
        cluster_mapping = label_clusters(kmeans, scaler, FEATURE_NAMES)
        
        # 4. Formatar output
        results = []
        for i, trip_data in enumerate(trips_data):
            c_id = int(cluster_ids[i])
            results.append({
                "tripId": trip_data.get("trip", {}).get("id"),
                "drivingStyle": cluster_mapping[c_id],
                "clusterId": c_id
            })
            
        print(json.dumps(results))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
