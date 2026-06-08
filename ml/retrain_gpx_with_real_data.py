"""
retrain_gpx_with_real_data.py — Retreina o modelo GPX usando APENAS viagens reais

Este script treina o modelo usando apenas as viagens GPX que foram realmente importadas,
ignorando as sintéticas. Isto garante que o modelo aprende os padrões das viagens reais.

Uso:
  docker exec motoguard-backend python /ml/retrain_gpx_with_real_data.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import psycopg2
import psycopg2.extras
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Adicionar o diretório pai ao path
sys.path.insert(0, str(Path(__file__).parent))
from features_gpx import GpxFeatureExtractor, FEATURE_NAMES_GPX

DATABASE_URL = os.environ.get("DATABASE_URL", "")
OUTPUT_PATH = Path(__file__).parent / "models" / "gpx_model.pkl"


def load_real_gpx_trips(conn) -> list[dict]:
    """Lê APENAS viagens GPX reais (não sintéticas)."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT
                t.id,
                t.max_speed_kmh   AS "maxSpeedKmh",
                t.distance_km     AS "distanceKm",
                t.avg_speed_kmh   AS "avgSpeedKmh",
                t.started_at      AS "startedAt",
                t.ended_at        AS "endedAt",
                g.waypoints       AS "waypoints",
                g.filename        AS "filename"
            FROM trips t
            INNER JOIN gpx_data g ON g.trip_id = t.id
            WHERE t.status = 'COMPLETED' 
              AND t.source = 'GPX_IMPORTED'
              AND g.filename NOT LIKE 'synthetic_%'
            ORDER BY t.started_at DESC
        """)
        trips = [dict(r) for r in cur.fetchall()]

    result = []
    for t in trips:
        result.append({
            "trip": {
                "maxSpeedKmh": t["maxSpeedKmh"],
                "avgSpeedKmh": t["avgSpeedKmh"],
                "distanceKm": t["distanceKm"],
                "startedAt": t["startedAt"].isoformat() if t["startedAt"] else None,
                "endedAt": t["endedAt"].isoformat() if t["endedAt"] else None,
            },
            "gpx_waypoints": t["waypoints"],
            "_filename": t["filename"],
        })

    return result


def train_with_real_data() -> None:
    if not DATABASE_URL:
        print("ERRO: DATABASE_URL não definida.", file=sys.stderr)
        sys.exit(1)

    print(f"[retrain_gpx] A ligar à BD...")
    conn = psycopg2.connect(DATABASE_URL)
    trip_data_list = load_real_gpx_trips(conn)
    conn.close()

    n_trips = len(trip_data_list)
    print(f"[retrain_gpx] Viagens GPX REAIS encontradas: {n_trips}")

    if n_trips < 3:
        print(
            f"ERRO: Dados insuficientes ({n_trips} viagens reais). "
            "São necessárias pelo menos 3 viagens GPX reais importadas.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Mostrar amostra
    print(f"[retrain_gpx] Primeiras viagens:")
    for i, td in enumerate(trip_data_list[:3]):
        fname = td.get("_filename", "unknown")
        trip = td["trip"]
        print(f"  {i+1}. {fname} - {trip['distanceKm']:.1f}km, max {trip['maxSpeedKmh']:.0f}km/h")

    # Feature extraction
    extractor = GpxFeatureExtractor()
    X = extractor.extract_batch(trip_data_list)
    print(f"[retrain_gpx] Feature matrix: {X.shape}")

    # Verificar NaN/Inf
    if not np.isfinite(X).all():
        bad = np.where(~np.isfinite(X))
        print(f"AVISO: {len(bad[0])} valores não finitos detetados — substituídos por 0.", file=sys.stderr)
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    # StandardScaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Isolation Forest com contamination mais baixo (assumir que viagens reais são maioritariamente normais)
    contamination = 0.05 if n_trips >= 10 else 0.1
    print(f"[retrain_gpx] A treinar IsolationForest (n_estimators=100, contamination={contamination})...")
    
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    # Serializar Model_Artifact
    model_version = f"gpx-isolation-forest-v2-real-data-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "model": model,
        "scaler": scaler,
        "metadata": {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "n_samples": n_trips,
            "feature_names": FEATURE_NAMES_GPX,
            "model_version": model_version,
            "model_type": "gpx",
            "data_source": "real_gpx_only",
            "n_estimators": 100,
            "contamination": contamination,
            "random_state": 42,
            "sigmoid_midpoint": -0.30,
            "sigmoid_k": 15,
        },
    }
    joblib.dump(artifact, OUTPUT_PATH)

    print(f"[retrain_gpx] Model_Artifact guardado em: {OUTPUT_PATH}")
    print(f"[retrain_gpx] Metadados: n_samples={n_trips}, version={model_version}")
    print(f"[retrain_gpx] ✓ Modelo treinado APENAS com viagens GPX reais!")


if __name__ == "__main__":
    train_with_real_data()
