"""
generate_training_data.py — Gera viagens sintéticas e insere na BD PostgreSQL.

Categorias geradas:
  - normal:     condução suave, sem eventos CRITICAL
  - aggressive: condução agressiva, múltiplos WARNING/CRITICAL
  - crash:      viagem com CRASH_DETECTED

Uso:
  DATABASE_URL=postgresql://user:pass@host/db python ml/generate_training_data.py [--count 30]
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
from psycopg2.extras import execute_values

# ── Configuração ──────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Perfis de mota disponíveis (IDs reais da BD — serão resolvidos em runtime)
PROFILE_NAMES = ["Naked", "Sport", "Trail", "Touring", "Scooter", "Cruiser", "Motocross", "Supermotard"]

# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _rand_float(lo: float, hi: float, decimals: int = 1) -> float:
    return round(random.uniform(lo, hi), decimals)


def _make_trip_row(
    user_id: str,
    motorcycle_id: str,
    category: str,
    started_at: datetime,
    ended_at: datetime,
) -> dict:
    """Gera stats de viagem de acordo com a categoria."""
    if category == "normal":
        max_speed = _rand_float(60, 110)
        max_roll = _rand_float(5, 25)
        max_gforce = _rand_float(1.0, 1.8)
        distance_km = _rand_float(10, 80)
        avg_speed = _rand_float(40, 80)
    elif category == "aggressive":
        max_speed = _rand_float(130, 200)
        max_roll = _rand_float(30, 55)
        max_gforce = _rand_float(2.0, 3.2)
        distance_km = _rand_float(20, 100)
        avg_speed = _rand_float(70, 130)
    else:  # crash
        max_speed = _rand_float(80, 160)
        max_roll = _rand_float(50, 75)
        max_gforce = _rand_float(3.0, 5.0)
        distance_km = _rand_float(5, 40)
        avg_speed = _rand_float(30, 80)

    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "motorcycle_id": motorcycle_id,
        "source": "SIMULATOR",
        "status": "COMPLETED",
        "started_at": started_at,
        "ended_at": ended_at,
        "max_speed_kmh": max_speed,
        "max_roll_deg": max_roll,
        "max_g_force": max_gforce,
        "distance_km": distance_km,
        "avg_speed_kmh": avg_speed,
    }


def _make_events(trip_id: str, category: str) -> list[dict]:
    """Gera TripEvents de acordo com a categoria."""
    events: list[dict] = []

    def add(ev_type: str, severity: str, msg: str) -> None:
        events.append({
            "id": str(uuid.uuid4()),
            "trip_id": trip_id,
            "type": ev_type,
            "severity": severity,
            "message": msg,
            "latitude": _rand_float(38.0, 42.0, 6),
            "longitude": _rand_float(-9.0, -6.0, 6),
            "speed_kmh": _rand_float(20, 150),
            "roll_deg": _rand_float(0, 60),
            "g_force": _rand_float(1.0, 4.0),
            "occurred_at": _now_utc(),
        })

    if category == "normal":
        # Poucos eventos, todos INFO
        n = random.randint(0, 3)
        for _ in range(n):
            add("HARD_BRAKING", "INFO", "Travagem suave")
        if random.random() < 0.3:
            add("OVERHEAT", "INFO", "Tendência de temperatura")

    elif category == "aggressive":
        # Muitos WARNING e CRITICAL
        for _ in range(random.randint(2, 5)):
            add("HARD_BRAKING", random.choice(["WARNING", "CRITICAL"]), "Travagem brusca")
        for _ in range(random.randint(1, 3)):
            add("RAPID_ACCELERATION", "WARNING", "Aceleração brusca")
        for _ in range(random.randint(1, 4)):
            add("SPEEDING", random.choice(["WARNING", "CRITICAL"]), "Excesso de velocidade")
        if random.random() < 0.5:
            add("EXCESSIVE_LEAN", "CRITICAL", "Inclinação elevada")
        if random.random() < 0.4:
            add("OVERHEAT", "WARNING", "Sobreaquecimento")

    else:  # crash
        # Eventos de queda + contexto
        add("CRASH_DETECTED", "CRITICAL", "Queda confirmada")
        for _ in range(random.randint(1, 3)):
            add("HARD_BRAKING", "CRITICAL", "Travagem de emergência")
        if random.random() < 0.7:
            add("EXCESSIVE_LEAN", "CRITICAL", "Inclinação extrema")
        if random.random() < 0.5:
            add("HIGH_VIBRATION", "CRITICAL", "Impacto")

    return events


# ── Inserção na BD ────────────────────────────────────────────────────────────

def _get_or_create_test_user(cur) -> str:
    """Retorna o ID do primeiro utilizador da BD (para dados de treino)."""
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
        (moto_id, user_id, "Mota de Treino ML", "Simulator", 2024),
    )
    return moto_id


def insert_trips(conn, trips: list[dict], events_by_trip: dict[str, list[dict]]) -> None:
    """Insere viagens e eventos na BD."""
    with conn.cursor() as cur:
        # Inserir viagens
        trip_rows = [
            (
                t["id"], t["user_id"], t["motorcycle_id"],
                t["source"], t["status"],
                t["started_at"], t["ended_at"],
                t["max_speed_kmh"], t["max_roll_deg"], t["max_g_force"],
                t["distance_km"], t["avg_speed_kmh"],
            )
            for t in trips
        ]
        execute_values(
            cur,
            """INSERT INTO trips
               (id, user_id, motorcycle_id, source, status,
                started_at, ended_at,
                max_speed_kmh, max_roll_deg, max_g_force,
                distance_km, avg_speed_kmh)
               VALUES %s
               ON CONFLICT (id) DO NOTHING""",
            trip_rows,
        )

        # Inserir eventos
        all_events = []
        for trip_id, evs in events_by_trip.items():
            for ev in evs:
                all_events.append((
                    ev["id"], ev["trip_id"], ev["type"], ev["severity"],
                    ev["message"], ev["latitude"], ev["longitude"],
                    ev["speed_kmh"], ev["roll_deg"], ev["g_force"], ev["occurred_at"],
                ))
        if all_events:
            execute_values(
                cur,
                """INSERT INTO trip_events
                   (id, trip_id, type, severity, message,
                    latitude, longitude, speed_kmh, roll_deg, g_force, occurred_at)
                   VALUES %s
                   ON CONFLICT (id) DO NOTHING""",
                all_events,
            )
    conn.commit()


# ── Main ──────────────────────────────────────────────────────────────────────

def generate(count_per_category: int = 20) -> None:
    if not DATABASE_URL:
        print("ERRO: variável de ambiente DATABASE_URL não definida.", file=sys.stderr)
        sys.exit(1)

    print(f"[generate_training_data] A ligar à BD...")
    conn = psycopg2.connect(DATABASE_URL)

    with conn.cursor() as cur:
        user_id = _get_or_create_test_user(cur)
        motorcycle_id = _get_or_create_motorcycle(cur, user_id)
    conn.commit()

    categories = ["normal", "aggressive", "crash"]
    all_trips: list[dict] = []
    events_by_trip: dict[str, list[dict]] = {}
    counts: dict[str, int] = {}

    base_time = _now_utc() - timedelta(days=90)

    for cat in categories:
        n = count_per_category if cat != "crash" else max(5, count_per_category // 4)
        counts[cat] = n
        for i in range(n):
            started_at = base_time + timedelta(days=random.randint(0, 80), hours=random.randint(6, 20))
            duration_min = random.randint(15, 120)
            ended_at = started_at + timedelta(minutes=duration_min)

            trip = _make_trip_row(user_id, motorcycle_id, cat, started_at, ended_at)
            all_trips.append(trip)
            events_by_trip[trip["id"]] = _make_events(trip["id"], cat)

    insert_trips(conn, all_trips, events_by_trip)
    conn.close()

    total = sum(counts.values())
    print(f"[generate_training_data] Viagens inseridas: {total}")
    for cat, n in counts.items():
        print(f"  {cat:12s}: {n}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gera dados de treino sintéticos para o ML_Pipeline")
    parser.add_argument("--count", type=int, default=20, help="Viagens por categoria (normal/aggressive)")
    args = parser.parse_args()
    generate(count_per_category=args.count)
