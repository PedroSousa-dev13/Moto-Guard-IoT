"""
train_gpx.py — Treina o Anomaly_Detector especializado para viagens GPX.

Uso:
  DATABASE_URL=postgresql://... python ml/train_gpx.py [opções]

Opções:
  --n-estimators INT     Número de árvores (default: 100)
  --contamination FLOAT  Fração esperada de anomalias (default: 0.1)
  --random-state INT     Seed para reprodutibilidade (default: 42)
  --output PATH          Caminho do .pkl (default: ml/models/gpx_model.pkl)
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import psycopg2
import psycopg2.extras
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Adicionar o diretório pai ao path para importar features_gpx.py
sys.path.insert(0, str(Path(__file__).parent))
from features_gpx import GpxFeatureExtractor, FEATURE_NAMES_GPX

DATABASE_URL = os.environ.get("DATABASE_URL", "")
DEFAULT_OUTPUT = Path(__file__).parent / "models" / "gpx_model.pkl"


# ── Leitura da BD ─────────────────────────────────────────────────────────────

def load_gpx_trips_from_db(conn) -> list[dict]:
    """Lê viagens GPX COMPLETED com waypoints da tabela gpx_data."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Viagens GPX COMPLETED com dados GPX
        cur.execute("""
            SELECT
                t.id,
                t.max_speed_kmh   AS "maxSpeedKmh",
                t.distance_km     AS "distanceKm",
                t.avg_speed_kmh   AS "avgSpeedKmh",
                t.started_at      AS "startedAt",
                t.ended_at        AS "endedAt",
                g.waypoints       AS "waypoints"
            FROM trips t
            INNER JOIN gpx_data g ON g.trip_id = t.id
            WHERE t.status = 'COMPLETED' AND t.source = 'GPX_IMPORTED'
            ORDER BY t.started_at DESC
        """)
        trips = [dict(r) for r in cur.fetchall()]

    # Montar trip_data no formato esperado pelo GpxFeatureExtractor
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
            "gpx_waypoints": t["waypoints"],  # Já é JSON/dict do PostgreSQL
        })

    return result


# ── Treino ────────────────────────────────────────────────────────────────────

def train(
    n_estimators: int = 100,
    contamination: float = 0.1,
    random_state: int = 42,
    output_path: Path = DEFAULT_OUTPUT,
) -> None:
    if not DATABASE_URL:
        print("ERRO: DATABASE_URL não definida.", file=sys.stderr)
        sys.exit(1)

    print(f"[train_gpx] A ligar à BD...")
    conn = psycopg2.connect(DATABASE_URL)
    trip_data_list = load_gpx_trips_from_db(conn)
    conn.close()

    n_trips = len(trip_data_list)
    print(f"[train_gpx] Viagens GPX COMPLETED encontradas: {n_trips}")

    if n_trips < 10:
        print(
            f"ERRO: Training_Dataset insuficiente ({n_trips} viagens GPX). "
            "São necessárias pelo menos 10 viagens GPX COMPLETED. "
            "Corre generate_gpx_training_data.py primeiro.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Feature extraction
    extractor = GpxFeatureExtractor()
    X = extractor.extract_batch(trip_data_list)
    print(f"[train_gpx] Feature matrix: {X.shape}")

    # Verificar NaN/Inf
    if not np.isfinite(X).all():
        bad = np.where(~np.isfinite(X))
        print(f"AVISO: {len(bad[0])} valores não finitos detetados — substituídos por 0.", file=sys.stderr)
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    # StandardScaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Isolation Forest
    print(f"[train_gpx] A treinar IsolationForest (n_estimators={n_estimators}, contamination={contamination})...")
    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    # Serializar Model_Artifact
    model_version = f"gpx-isolation-forest-v1-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "model": model,
        "scaler": scaler,
        "metadata": {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "n_samples": n_trips,
            "feature_names": FEATURE_NAMES_GPX,
            "model_version": model_version,
            "model_type": "gpx",
            "n_estimators": n_estimators,
            "contamination": contamination,
            "random_state": random_state,
            "sigmoid_midpoint": -0.30,
            "sigmoid_k": 15,
        },
    }
    joblib.dump(artifact, output_path)

    print(f"[train_gpx] Model_Artifact guardado em: {output_path}")
    print(f"[train_gpx] Metadados: n_samples={n_trips}, version={model_version}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Treina o Isolation Forest especializado para viagens GPX")
    parser.add_argument("--n-estimators", type=int, default=100)
    parser.add_argument("--contamination", type=float, default=0.1)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    train(
        n_estimators=args.n_estimators,
        contamination=args.contamination,
        random_state=args.random_state,
        output_path=args.output,
    )
