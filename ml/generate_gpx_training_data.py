"""
generate_gpx_training_data.py — Gera viagens GPX sintéticas e insere na BD PostgreSQL.

Categorias geradas:
  - normal:     condução suave, velocidades moderadas, poucas paragens
  - aggressive: condução agressiva, velocidades altas, acelerações bruscas
  - erratic:    condução errática, muitas paragens, velocidades inconsistentes

Uso:
  DATABASE_URL=postgresql://user:pass@host/db python ml/generate_gpx_training_data.py [--count 30]
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2

# ── Configuração ──────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Coordenadas base (Lisboa, Portugal)
BASE_LAT = 38.7223
BASE_LON = -9.1393

# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _rand_float(lo: float, hi: float, decimals: int = 1) -> float:
    return round(random.uniform(lo, hi), decimals)


def _generate_waypoints(category: str, n_points: int = 100) -> list[dict]:
    """Gera waypoints GPX sintéticos de acordo com a categoria."""
    waypoints = []
    current_lat = BASE_LAT
    current_lon = BASE_LON
    current_ele = _rand_float(50, 200)
    current_time = _now_utc() - timedelta(hours=2)
    
    if category == "normal":
        # Condução suave: velocidades 40-80 km/h, poucas paragens
        base_speed = 60
        speed_variance = 15
        stop_probability = 0.05
        acceleration_variance = 5
    elif category == "aggressive":
        # Condução agressiva: velocidades 80-150 km/h, acelerações bruscas
        base_speed = 110
        speed_variance = 30
        stop_probability = 0.02
        acceleration_variance = 25
    else:  # erratic
        # Condução errática: velocidades inconsistentes, muitas paragens
        base_speed = 50
        speed_variance = 35
        stop_probability = 0.15
        acceleration_variance = 20
    
    current_speed = base_speed
    
    for i in range(n_points):
        # Simular paragem
        if random.random() < stop_probability:
            current_speed = 0
        else:
            # Variar velocidade
            speed_change = random.gauss(0, acceleration_variance)
            current_speed = max(0, min(200, current_speed + speed_change))
            if current_speed < 5:
                current_speed = random.uniform(base_speed - speed_variance, base_speed + speed_variance)
        
        # Calcular deslocamento (aproximação simples)
        # 1 grau lat ≈ 111 km, 1 grau lon ≈ 111 km * cos(lat)
        time_step_sec = random.uniform(3, 8)  # 3-8 segundos entre pontos
        distance_km = (current_speed / 3600) * time_step_sec
        
        # Direção aleatória com tendência
        angle = random.uniform(0, 2 * 3.14159)
        lat_change = (distance_km / 111) * random.choice([1, -1]) * abs(random.gauss(0.5, 0.3))
        lon_change = (distance_km / (111 * 0.7)) * random.choice([1, -1]) * abs(random.gauss(0.5, 0.3))
        
        current_lat += lat_change
        current_lon += lon_change
        
        # Variar elevação
        ele_change = random.gauss(0, 5)
        current_ele = max(0, current_ele + ele_change)
        
        current_time += timedelta(seconds=time_step_sec)
        
        waypoints.append({
            "lat": round(current_lat, 6),
            "lon": round(current_lon, 6),
            "ele": round(current_ele, 1),
            "time": current_time.isoformat(),
            "speedKmh": round(current_speed, 1),
        })
    
    return waypoints


def _calculate_trip_stats(waypoints: list[dict]) -> dict:
    """Calcula estatísticas da viagem a partir dos waypoints."""
    if not waypoints:
        return {
            "maxSpeedKmh": 0,
            "avgSpeedKmh": 0,
            "distanceKm": 0,
            "startedAt": _now_utc(),
            "endedAt": _now_utc(),
        }
    
    speeds = [w["speedKmh"] for w in waypoints if w.get("speedKmh", 0) > 0]
    max_speed = max(speeds) if speeds else 0
    avg_speed = sum(speeds) / len(speeds) if speeds else 0
    
    # Calcular distância (aproximação simples)
    distance_km = 0
    for i in range(1, len(waypoints)):
        w1 = waypoints[i-1]
        w2 = waypoints[i]
        lat_diff = abs(w2["lat"] - w1["lat"]) * 111
        lon_diff = abs(w2["lon"] - w1["lon"]) * 111 * 0.7
        distance_km += (lat_diff**2 + lon_diff**2)**0.5
    
    started_at = datetime.fromisoformat(waypoints[0]["time"])
    ended_at = datetime.fromisoformat(waypoints[-1]["time"])
    
    return {
        "maxSpeedKmh": round(max_speed, 1),
        "avgSpeedKmh": round(avg_speed, 1),
        "distanceKm": round(distance_km, 2),
        "startedAt": started_at,
        "endedAt": ended_at,
    }


def _make_gpx_trip(user_id: str, motorcycle_id: str, category: str) -> dict:
    """Gera uma viagem GPX completa."""
    waypoints = _generate_waypoints(category, n_points=random.randint(80, 150))
    stats = _calculate_trip_stats(waypoints)
    
    # Calcular bounds
    lats = [w["lat"] for w in waypoints]
    lons = [w["lon"] for w in waypoints]
    bounds = {
        "minLat": min(lats),
        "maxLat": max(lats),
        "minLon": min(lons),
        "maxLon": max(lons),
    }
    
    gpx_data = {
        "waypoints": waypoints,
        "bounds": bounds,
    }
    
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "motorcycle_id": motorcycle_id,
        "source": "GPX_IMPORTED",
        "status": "COMPLETED",
        "started_at": stats["startedAt"],
        "ended_at": stats["endedAt"],
        "max_speed_kmh": stats["maxSpeedKmh"],
        "distance_km": stats["distanceKm"],
        "avg_speed_kmh": stats["avgSpeedKmh"],
        "gpx_data": gpx_data,
    }


# ── Inserção na BD ────────────────────────────────────────────────────────────

def _get_or_create_test_user(cur) -> str:
    """Retorna o ID do primeiro utilizador da BD."""
    cur.execute("SELECT id FROM users LIMIT 1")
    row = cur.fetchone()
    if not row:
        raise RuntimeError("Nenhum utilizador encontrado na BD. Cria um utilizador primeiro.")
    return row[0]


def _get_or_create_motorcycle(cur, user_id: str) -> str:
    """Retorna o ID da primeira mota do utilizador, ou cria uma."""
    cur.execute("SELECT id FROM motorcycles WHERE user_id = %s LIMIT 1", (user_id,))
    row = cur.fetchone()
    if row:
        return row[0]
    # Criar mota de treino
    moto_id = str(uuid.uuid4())
    cur.execute(
        """INSERT INTO motorcycles (id, user_id, name, brand, year, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, NOW(), NOW())""",
        (moto_id, user_id, "Mota GPX Treino ML", "GPX", 2024),
    )
    return moto_id


def insert_gpx_trips(conn, trips: list[dict]) -> None:
    """Insere viagens GPX na BD."""
    with conn.cursor() as cur:
        for t in trips:
            # Inserir viagem
            cur.execute(
                """INSERT INTO trips
                   (id, user_id, motorcycle_id, source, status,
                    started_at, ended_at,
                    max_speed_kmh, distance_km, avg_speed_kmh)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO NOTHING""",
                (
                    t["id"], t["user_id"], t["motorcycle_id"],
                    t["source"], t["status"],
                    t["started_at"], t["ended_at"],
                    t["max_speed_kmh"], t["distance_km"], t["avg_speed_kmh"],
                ),
            )
            
            # Inserir dados GPX na tabela separada
            gpx_data_id = str(uuid.uuid4())
            cur.execute(
                """INSERT INTO gpx_data
                   (id, trip_id, filename, file_size, waypoints, bounds, total_time)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (trip_id) DO NOTHING""",
                (
                    gpx_data_id,
                    t["id"],
                    f"synthetic_{t['id'][:8]}.gpx",
                    len(json.dumps(t["gpx_data"]["waypoints"])),
                    json.dumps(t["gpx_data"]["waypoints"]),
                    json.dumps(t["gpx_data"]["bounds"]),
                    int((t["ended_at"] - t["started_at"]).total_seconds()),
                ),
            )
    conn.commit()


# ── Main ──────────────────────────────────────────────────────────────────────

def generate(count_per_category: int = 20) -> None:
    if not DATABASE_URL:
        print("ERRO: variável de ambiente DATABASE_URL não definida.", file=sys.stderr)
        sys.exit(1)

    print(f"[generate_gpx_training_data] A ligar à BD...")
    conn = psycopg2.connect(DATABASE_URL)

    with conn.cursor() as cur:
        user_id = _get_or_create_test_user(cur)
        motorcycle_id = _get_or_create_motorcycle(cur, user_id)
    conn.commit()

    categories = ["normal", "aggressive", "erratic"]
    all_trips: list[dict] = []
    counts: dict[str, int] = {}

    for cat in categories:
        n = count_per_category
        counts[cat] = n
        for i in range(n):
            trip = _make_gpx_trip(user_id, motorcycle_id, cat)
            all_trips.append(trip)

    insert_gpx_trips(conn, all_trips)
    conn.close()

    total = sum(counts.values())
    print(f"[generate_gpx_training_data] Viagens GPX inseridas: {total}")
    for cat, n in counts.items():
        print(f"  {cat:12s}: {n}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gera dados de treino GPX sintéticos para o ML_Pipeline")
    parser.add_argument("--count", type=int, default=20, help="Viagens por categoria")
    args = parser.parse_args()
    generate(count_per_category=args.count)
