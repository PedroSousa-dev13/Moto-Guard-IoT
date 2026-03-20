"""
train.py — Treina o Anomaly_Detector (Isolation Forest) com viagens da BD PostgreSQL.

Uso:
  DATABASE_URL=postgresql://... python ml/train.py [opções]

Opções:
  --n-estimators INT     Número de árvores (default: 100)
  --contamination FLOAT  Fração esperada de anomalias (default: 0.1)
  --random-state INT     Seed para reprodutibilidade (default: 42)
  --output PATH          Caminho do .pkl (default: ml/models/isolation_forest.pkl)
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

# Adicionar o diretório pai ao path para importar features.py
sys.path.insert(0, str(Path(__file__).parent))
from features import FeatureExtractor, FEATURE_NAMES

DATABASE_URL = os.environ.get("DATABASE_URL", "")
MODEL_VERSION = "isolation-forest-v1"
DEFAULT_OUTPUT = Path(__file__).parent / "models" / "isolation_forest.pkl"


# ── Leitura da BD ─────────────────────────────────────────────────────────────

def load_trips_from_db(conn) -> list[dict]:
    """Lê viagens COMPLETED com TripEvents e perfil da mota."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Viagens COMPLETED
        cur.execute("""
            SELECT
                t.id, t.source,
                t.max_speed_kmh   AS "maxSpeedKmh",
                t.max_roll_deg    AS "maxRollDeg",
                t.max_gforce      AS "maxGForce",
                t.distance_km     AS "distanceKm",
                t.avg_speed_kmh   AS "avgSpeedKmh",
                t.started_at      AS "startedAt",
                t.ended_at        AS "endedAt",
                mp.max_speed_kmh  AS "profile_maxSpeedKmh",
                mp.typical_max_roll_deg AS "profile_typicalMaxRollDeg",
                mp.crash_roll_threshold AS "profile_crashRollThreshold",
                mp.crash_g_force  AS "profile_crashGForce"
            FROM trips t
            LEFT JOIN motorcycles m ON m.id = t.motorcycle_id
            LEFT JOIN motorcycle_profiles mp ON mp.id = m.profile_id
            WHERE t.status = 'COMPLETED'
            ORDER BY t.started_at DESC
        """)
        trips = [dict(r) for r in cur.fetchall()]

        if not trips:
            return []

        # TripEvents por viagem
        trip_ids = [t["id"] for t in trips]
        cur.execute("""
            SELECT trip_id, type, severity
            FROM trip_events
            WHERE trip_id = ANY(%s)
        """, (trip_ids,))
        events_raw = cur.fetchall()

    events_by_trip: dict[str, list[dict]] = {}
    for ev in events_raw:
        tid = ev["trip_id"]
        events_by_trip.setdefault(tid, []).append({"type": ev["type"], "severity": ev["severity"]})

    # Montar trip_data no formato esperado pelo FeatureExtractor
    result = []
    for t in trips:
        profile = None
        if t.get("profile_maxSpeedKmh"):
            profile = {
                "maxSpeedKmh": t["profile_maxSpeedKmh"],
                "typicalMaxRollDeg": t["profile_typicalMaxRollDeg"],
                "crashRollThreshold": t["profile_crashRollThreshold"],
                "crashGForce": t["profile_crashGForce"],
            }
        result.append({
            "trip": {
                "maxSpeedKmh": t["maxSpeedKmh"],
                "maxRollDeg": t["maxRollDeg"],
                "maxGForce": t["maxGForce"],
                "distanceKm": t["distanceKm"],
                "avgSpeedKmh": t["avgSpeedKmh"],
                "startedAt": t["startedAt"].isoformat() if t["startedAt"] else None,
                "endedAt": t["endedAt"].isoformat() if t["endedAt"] else None,
            },
            "events": events_by_trip.get(t["id"], []),
            "profile": profile,
            "_source": t.get("source", "UNKNOWN"),
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

    print(f"[train] A ligar à BD...")
    conn = psycopg2.connect(DATABASE_URL)
    trip_data_list = load_trips_from_db(conn)
    conn.close()

    n_trips = len(trip_data_list)
    print(f"[train] Viagens COMPLETED encontradas: {n_trips}")

    if n_trips < 10:
        print(
            f"ERRO: Training_Dataset insuficiente ({n_trips} viagens). "
            "São necessárias pelo menos 10 viagens COMPLETED. "
            "Corre generate_training_data.py primeiro.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Distribuição por TripSource
    source_counts = Counter(td.get("_source", "UNKNOWN") for td in trip_data_list)
    print("[train] Distribuição por TripSource:")
    for src, cnt in sorted(source_counts.items()):
        print(f"  {src}: {cnt}")

    # Feature extraction
    extractor = FeatureExtractor()
    X = extractor.extract_batch(trip_data_list)
    print(f"[train] Feature matrix: {X.shape}")

    # Verificar NaN/Inf
    if not np.isfinite(X).all():
        bad = np.where(~np.isfinite(X))
        print(f"AVISO: {len(bad[0])} valores não finitos detetados — substituídos por 0.", file=sys.stderr)
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    # StandardScaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Isolation Forest
    print(f"[train] A treinar IsolationForest (n_estimators={n_estimators}, contamination={contamination})...")
    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    # Serializar Model_Artifact
    output_path.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "model": model,
        "scaler": scaler,
        "metadata": {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "n_samples": n_trips,
            "feature_names": FEATURE_NAMES,
            "model_version": MODEL_VERSION,
            "n_estimators": n_estimators,
            "contamination": contamination,
            "random_state": random_state,
        },
    }
    joblib.dump(artifact, output_path)

    print(f"[train] Model_Artifact guardado em: {output_path}")
    print(f"[train] Metadados: n_samples={n_trips}, version={MODEL_VERSION}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Treina o Isolation Forest para avaliação de viagens")
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
