"""
features_gpx.py — Feature extractor especializado para viagens GPX

Features extraídas (10 total):
  - Trip stats (5): maxSpeedKmh, avgSpeedKmh, distanceKm, durationSeconds, maxElevation
  - Speed patterns (3): speed_variance, acceleration_events, stop_count
  - Elevation patterns (2): elevation_gain, elevation_loss

Estrutura esperada do trip_data:
{
  "trip": {
    "maxSpeedKmh": float,
    "avgSpeedKmh": float,
    "distanceKm": float,
    "startedAt": str (ISO 8601),
    "endedAt": str (ISO 8601)
  },
  "gpx_waypoints": [
    {"lat": float, "lon": float, "ele": float, "time": str, "speedKmh": float}
  ]
}
"""

from __future__ import annotations

import numpy as np
from datetime import datetime, timezone
from typing import Any

# Feature names (ordem fixa)
FEATURE_NAMES_GPX: list[str] = [
    # Trip stats (5)
    "maxSpeedKmh",
    "avgSpeedKmh",
    "distanceKm",
    "durationSeconds",
    "maxElevation",
    # Speed patterns (3)
    "speed_variance",
    "acceleration_events",
    "stop_count",
    # Elevation patterns (2)
    "elevation_gain",
    "elevation_loss",
]

assert len(FEATURE_NAMES_GPX) == 10, "FEATURE_NAMES_GPX deve ter 10 elementos"


def _duration_seconds(trip: dict[str, Any]) -> float:
    """Calcula duração em segundos."""
    try:
        started = trip.get("startedAt") or trip.get("started_at")
        ended = trip.get("endedAt") or trip.get("ended_at")
        if not started or not ended:
            return 0.0
        t0 = datetime.fromisoformat(started.replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(ended.replace("Z", "+00:00"))
        return max(0.0, (t1 - t0).total_seconds())
    except Exception:
        return 0.0


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula distância em km entre dois pontos GPS."""
    R = 6371  # Raio da Terra em km
    lat1_rad = np.radians(lat1)
    lat2_rad = np.radians(lat2)
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon / 2) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c


class GpxFeatureExtractor:
    """Extrai features específicas de viagens GPX."""
    
    def extract(self, trip_data: dict[str, Any]) -> np.ndarray:
        """
        Extrai features de uma viagem GPX.
        
        Returns:
            np.ndarray de shape (10,) com dtype float64
        """
        trip = trip_data.get("trip") or {}
        waypoints = trip_data.get("gpx_waypoints") or []
        
        # ── Trip stats básicos ────────────────────────────────────────
        max_speed = float(trip.get("maxSpeedKmh") or 0.0)
        avg_speed = float(trip.get("avgSpeedKmh") or 0.0)
        distance_km = float(trip.get("distanceKm") or 0.0)
        duration_sec = _duration_seconds(trip)
        
        # ── Elevation (altitude) ──────────────────────────────────────
        elevations = [w.get("ele") for w in waypoints if w.get("ele") is not None]
        max_elevation = max(elevations) if elevations else 0.0
        
        elevation_gain = 0.0
        elevation_loss = 0.0
        for i in range(1, len(elevations)):
            diff = elevations[i] - elevations[i-1]
            if diff > 0:
                elevation_gain += diff
            else:
                elevation_loss += abs(diff)
        
        # ── Speed patterns ────────────────────────────────────────────
        speeds = []
        for w in waypoints:
            # Tentar obter velocidade do waypoint (se foi calculada)
            speed = w.get("speedKmh")
            if speed is not None and isinstance(speed, (int, float)):
                speeds.append(float(speed))
        
        # Se não há velocidades nos waypoints, calcular a partir de distância/tempo
        if not speeds and len(waypoints) >= 2:
            for i in range(1, len(waypoints)):
                w1 = waypoints[i-1]
                w2 = waypoints[i]
                
                # Calcular distância
                dist_km = _haversine_km(
                    w1.get("lat", 0), w1.get("lon", 0),
                    w2.get("lat", 0), w2.get("lon", 0)
                )
                
                # Calcular tempo
                try:
                    t1 = datetime.fromisoformat(w1.get("time", "").replace("Z", "+00:00"))
                    t2 = datetime.fromisoformat(w2.get("time", "").replace("Z", "+00:00"))
                    dt_sec = (t2 - t1).total_seconds()
                    
                    if dt_sec > 0:
                        speed_kmh = (dist_km / dt_sec) * 3600
                        # Filtrar velocidades irrealistas (GPS drift)
                        if 0 <= speed_kmh <= 300:
                            speeds.append(speed_kmh)
                except Exception:
                    continue
        
        # Variância de velocidade (indica condução errática)
        speed_variance = float(np.var(speeds)) if len(speeds) > 1 else 0.0
        
        # Eventos de aceleração (mudanças bruscas > 20 km/h entre samples)
        acceleration_events = 0
        for i in range(1, len(speeds)):
            if abs(speeds[i] - speeds[i-1]) > 20:
                acceleration_events += 1
        
        # Contagem de paragens (velocidade < 2 km/h)
        stop_count = sum(1 for s in speeds if s < 2.0)
        
        # ── Montar vetor ──────────────────────────────────────────────
        vector = np.array([
            max_speed,
            avg_speed,
            distance_km,
            duration_sec,
            max_elevation,
            speed_variance,
            float(acceleration_events),
            float(stop_count),
            elevation_gain,
            elevation_loss,
        ], dtype=np.float64)
        
        assert vector.shape == (10,), f"Feature vector deve ter 10 elementos, tem {vector.shape}"
        return vector
    
    def extract_batch(self, trip_data_list: list[dict[str, Any]]) -> np.ndarray:
        """Extrai features para múltiplas viagens. Retorna array (N, 10)."""
        return np.vstack([self.extract(td) for td in trip_data_list])
