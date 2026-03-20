"""
Feature_Extractor — transforma dados brutos de uma viagem num Feature_Vector de 24 features.

Estrutura do trip_data esperado:
{
  "trip": {
    "maxSpeedKmh": float,
    "maxRollDeg": float,
    "maxGForce": float,
    "distanceKm": float,
    "avgSpeedKmh": float,
    "startedAt": str (ISO 8601),
    "endedAt": str (ISO 8601, opcional)
  },
  "events": [
    { "type": str, "severity": str }
  ],
  "profile": {  # opcional
    "maxSpeedKmh": float,
    "typicalMaxRollDeg": float,
    "crashRollThreshold": float,
    "crashGForce": float
  }
}
"""

from __future__ import annotations

import numpy as np
from datetime import datetime, timezone
from typing import Any

# ── Feature names (ordem fixa — NÃO alterar sem versionar o modelo) ──────────

FEATURE_NAMES: list[str] = [
    # Contagem por tipo de evento (10)
    "count_HARD_BRAKING",
    "count_EXCESSIVE_LEAN",
    "count_HIGH_VIBRATION",
    "count_OVERHEAT",
    "count_LOW_VOLTAGE",
    "count_CRASH_DETECTED",
    "count_RAPID_ACCELERATION",
    "count_TIRE_PRESSURE_LOW",
    "count_OIL_PRESSURE_LOW",
    "count_SPEEDING",
    # Contagem por severidade (3)
    "count_INFO",
    "count_WARNING",
    "count_CRITICAL",
    # TripStats (6)
    "maxSpeedKmh",
    "maxRollDeg",
    "maxGForce",
    "distanceKm",
    "avgSpeedKmh",
    "durationSeconds",
    # Ratios relativos ao perfil (3)
    "speed_ratio",
    "roll_ratio",
    "gforce_ratio",
    # Features derivadas (2)
    "events_per_km",
    "critical_ratio",
]

assert len(FEATURE_NAMES) == 24, "FEATURE_NAMES deve ter exatamente 24 elementos"

_EVENT_TYPES = [
    "HARD_BRAKING",
    "EXCESSIVE_LEAN",
    "HIGH_VIBRATION",
    "OVERHEAT",
    "LOW_VOLTAGE",
    "CRASH_DETECTED",
    "RAPID_ACCELERATION",
    "TIRE_PRESSURE_LOW",
    "OIL_PRESSURE_LOW",
    "SPEEDING",
]

_SEVERITIES = ["INFO", "WARNING", "CRITICAL"]


def _duration_seconds(trip: dict[str, Any]) -> float:
    """Calcula duração em segundos a partir de startedAt/endedAt."""
    try:
        started = trip.get("startedAt") or trip.get("started_at")
        ended = trip.get("endedAt") or trip.get("ended_at")
        if not started or not ended:
            return 0.0
        fmt = "%Y-%m-%dT%H:%M:%SZ"
        t0 = datetime.strptime(started[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
        t1 = datetime.strptime(ended[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
        return max(0.0, (t1 - t0).total_seconds())
    except Exception:
        return 0.0


class FeatureExtractor:
    """Extrai um Feature_Vector de dimensão fixa (24) a partir de dados de uma viagem."""

    def extract(self, trip_data: dict[str, Any]) -> np.ndarray:
        """
        Parâmetros
        ----------
        trip_data : dict com chaves 'trip', 'events' (lista), 'profile' (opcional)

        Retorna
        -------
        np.ndarray de shape (24,) com dtype float64
        """
        trip = trip_data.get("trip") or {}
        events: list[dict] = trip_data.get("events") or []
        profile = trip_data.get("profile")  # pode ser None

        # ── Contagem por tipo de evento ───────────────────────────────────
        type_counts: dict[str, int] = {t: 0 for t in _EVENT_TYPES}
        sev_counts: dict[str, int] = {s: 0 for s in _SEVERITIES}

        for ev in events:
            ev_type = (ev.get("type") or "").upper()
            ev_sev = (ev.get("severity") or "").upper()
            if ev_type in type_counts:
                type_counts[ev_type] += 1
            if ev_sev in sev_counts:
                sev_counts[ev_sev] += 1

        # ── TripStats ─────────────────────────────────────────────────────
        max_speed = float(trip.get("maxSpeedKmh") or 0.0)
        max_roll = float(trip.get("maxRollDeg") or 0.0)
        max_gforce = float(trip.get("maxGForce") or 0.0)
        distance_km = float(trip.get("distanceKm") or 0.0)
        avg_speed = float(trip.get("avgSpeedKmh") or 0.0)
        duration_sec = _duration_seconds(trip)

        # ── Ratios relativos ao perfil ────────────────────────────────────
        if profile:
            p_max_speed = float(profile.get("maxSpeedKmh") or 1.0) or 1.0
            p_max_roll = float(profile.get("typicalMaxRollDeg") or 1.0) or 1.0
            p_crash_g = float(profile.get("crashGForce") or 1.0) or 1.0
            speed_ratio = max_speed / p_max_speed
            roll_ratio = max_roll / p_max_roll
            gforce_ratio = max_gforce / p_crash_g
        else:
            speed_ratio = 0.0
            roll_ratio = 0.0
            gforce_ratio = 0.0

        # ── Features derivadas ────────────────────────────────────────────
        total_events = len(events)
        events_per_km = total_events / distance_km if distance_km > 0 else 0.0
        critical_ratio = sev_counts["CRITICAL"] / total_events if total_events > 0 else 0.0

        # ── Montar vetor (ordem fixa = FEATURE_NAMES) ─────────────────────
        vector = np.array([
            float(type_counts["HARD_BRAKING"]),
            float(type_counts["EXCESSIVE_LEAN"]),
            float(type_counts["HIGH_VIBRATION"]),
            float(type_counts["OVERHEAT"]),
            float(type_counts["LOW_VOLTAGE"]),
            float(type_counts["CRASH_DETECTED"]),
            float(type_counts["RAPID_ACCELERATION"]),
            float(type_counts["TIRE_PRESSURE_LOW"]),
            float(type_counts["OIL_PRESSURE_LOW"]),
            float(type_counts["SPEEDING"]),
            float(sev_counts["INFO"]),
            float(sev_counts["WARNING"]),
            float(sev_counts["CRITICAL"]),
            max_speed,
            max_roll,
            max_gforce,
            distance_km,
            avg_speed,
            duration_sec,
            speed_ratio,
            roll_ratio,
            gforce_ratio,
            events_per_km,
            critical_ratio,
        ], dtype=np.float64)

        assert vector.shape == (24,), f"Feature_Vector deve ter 24 elementos, tem {vector.shape}"
        return vector

    def extract_batch(self, trip_data_list: list[dict[str, Any]]) -> np.ndarray:
        """Extrai features para uma lista de viagens. Retorna array (N, 24)."""
        return np.vstack([self.extract(td) for td in trip_data_list])
