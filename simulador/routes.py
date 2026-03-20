# =============================================================================
# MotoGuard IoT — Rotas Pré-Definidas (GPS real para o simulador)
# =============================================================================
# Tarefa 0.9: a mota segue waypoints de estradas reais em vez de random walk.
#
# Cada rota é uma lista de (lat, lng) em loop contínuo.
# O RouteFollower calcula:
#   · bearing para o próximo waypoint → usado como _target_yaw
#   · speed_limit_kmh baseado em lookahead de curvas (trava em curvas fechadas)
#
# Rotas disponíveis (Vila Real, Portugal):
#   "vila_real_urbano"  — circuito urbano ~5 km (Centro → Av. C. Araújo → Sul)
#   "vila_real_estrada" — estrada nacional ~15 km (N2 Sul → Torgueda → Campeã)
# =============================================================================

import math
import os
import json
import urllib.request
import urllib.parse


# =============================================================================
#  RouteFollower — segue waypoints em loop
# =============================================================================
class RouteFollower:
    """
    Segue uma lista pré-definida de (lat, lng) em loop contínuo.

    Integração no simulador:
        route_info = route_follower.update(s.lat, s.lng)
        s._target_yaw = route_info["target_yaw_deg"]
        if route_info["speed_limit_kmh"]:
            s._target_vel = min(s._target_vel, route_info["speed_limit_kmh"])
    """

    def __init__(self, waypoints: list[tuple[float, float]],
                 arrival_radius_m: float = 30.0):
        if len(waypoints) < 2:
            raise ValueError("Rota precisa de pelo menos 2 waypoints.")
        self.waypoints = waypoints
        self.arrival_radius_m = arrival_radius_m
        self._idx = 0   # índice do próximo waypoint a atingir

    # ── Geometria ──────────────────────────────────────────────────────────

    @staticmethod
    def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Distância em metros entre dois pontos lat/lng (fórmula de Haversine)."""
        R = 6_371_000.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = (math.sin(dphi / 2) ** 2
             + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2)
        return 2 * R * math.asin(math.sqrt(a))

    @staticmethod
    def _bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Bearing em graus (0 = Norte, 90 = Este, 180 = Sul, 270 = Oeste)."""
        dlam = math.radians(lon2 - lon1)
        lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
        x = math.sin(dlam) * math.cos(lat2_r)
        y = (math.cos(lat1_r) * math.sin(lat2_r)
             - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlam))
        return (math.degrees(math.atan2(x, y)) + 360) % 360

    def _lookahead_max_curve(self, steps: int = 4) -> float:
        """
        Ângulo máximo de viragem (graus) nos próximos `steps` waypoints.
        Usado para reduzir a velocidade alvo antes de curvas fechadas.
        """
        n = len(self.waypoints)
        bearings = []
        for i in range(steps + 1):
            a = self.waypoints[(self._idx + i) % n]
            b = self.waypoints[(self._idx + i + 1) % n]
            bearings.append(self._bearing_deg(a[0], a[1], b[0], b[1]))
        max_angle = 0.0
        for i in range(len(bearings) - 1):
            diff = abs((bearings[i + 1] - bearings[i] + 180) % 360 - 180)
            max_angle = max(max_angle, diff)
        return max_angle

    # ── Interface pública ───────────────────────────────────────────────────

    def update(self, lat: float, lng: float) -> dict:
        """
        Dado a posição actual, devolve:
          - target_yaw_deg   : bearing para o próximo waypoint
          - speed_limit_kmh  : velocidade máxima recomendada (None = sem limite)
          - dist_to_next_m   : distância ao próximo waypoint (metros)
          - waypoint_idx     : índice do waypoint actual
        """
        wp_lat, wp_lng = self.waypoints[self._idx]
        dist = self._haversine_m(lat, lng, wp_lat, wp_lng)

        # Avançar para o próximo waypoint quando chegamos perto o suficiente
        if dist < self.arrival_radius_m:
            self._idx = (self._idx + 1) % len(self.waypoints)
            wp_lat, wp_lng = self.waypoints[self._idx]
            dist = self._haversine_m(lat, lng, wp_lat, wp_lng)

        target_yaw = self._bearing_deg(lat, lng, wp_lat, wp_lng)

        # Limite de velocidade baseado na curva à frente
        max_curve = self._lookahead_max_curve(steps=4)
        if max_curve > 65:
            speed_limit = 40.0      # curva muito fechada (≥65°)
        elif max_curve > 40:
            speed_limit = 65.0      # curva moderada (40–65°)
        elif max_curve > 22:
            speed_limit = 90.0      # curva suave (22–40°)
        else:
            speed_limit = None      # recta — sem limite extra

        return {
            "target_yaw_deg":  target_yaw,
            "speed_limit_kmh": speed_limit,
            "dist_to_next_m":  dist,
            "waypoint_idx":    self._idx,
        }

    def reset(self, start_idx: int = 0):
        """Reinicia o seguidor no waypoint indicado."""
        self._idx = start_idx % len(self.waypoints)


class RouteCursor:
    def __init__(self, waypoints: list[tuple[float, float]], close_loop: bool = True):
        pts: list[tuple[float, float]] = []
        for p in waypoints:
            if not pts or p != pts[-1]:
                pts.append(p)
        if len(pts) < 2:
            raise ValueError("Rota precisa de pelo menos 2 waypoints.")
        self._close_loop = bool(close_loop)
        if self._close_loop and pts[0] != pts[-1]:
            pts.append(pts[0])
        self.waypoints = pts
        self._idx = 0
        self._seg_pos_m = 0.0
        self._finished = False

    @property
    def segment_index(self) -> int:
        return self._idx

    @property
    def finished(self) -> bool:
        return self._finished

    def reset(self, start_idx: int = 0):
        n_segments = max(1, len(self.waypoints) - 1)
        self._idx = start_idx % n_segments
        self._seg_pos_m = 0.0
        self._finished = False

    def bearing_deg(self) -> float:
        n_segments = len(self.waypoints) - 1
        if n_segments <= 0:
            return 0.0
        idx = self._idx
        if not self._close_loop:
            idx = max(0, min(idx, n_segments - 1))
        a = self.waypoints[idx]
        b = self.waypoints[idx + 1]
        return RouteFollower._bearing_deg(a[0], a[1], b[0], b[1])

    def _segment_len_m(self, idx: int) -> float:
        a = self.waypoints[idx]
        b = self.waypoints[idx + 1]
        return RouteFollower._haversine_m(a[0], a[1], b[0], b[1])

    def max_curve_deg(self, steps: int = 8) -> float:
        n_segments = len(self.waypoints) - 1
        if n_segments <= 1:
            return 0.0
        steps = max(1, int(steps))
        bearings: list[float] = []
        for i in range(steps + 1):
            if self._close_loop:
                idx = (self._idx + i) % n_segments
            else:
                idx = min(self._idx + i, n_segments - 1)
            a = self.waypoints[idx]
            b = self.waypoints[idx + 1]
            bearings.append(RouteFollower._bearing_deg(a[0], a[1], b[0], b[1]))
        max_angle = 0.0
        for i in range(len(bearings) - 1):
            diff = abs((bearings[i + 1] - bearings[i] + 180) % 360 - 180)
            max_angle = max(max_angle, diff)
        return max_angle

    def speed_limit_kmh(self, steps: int = 8) -> float | None:
        max_curve = self.max_curve_deg(steps=steps)
        # Thresholds mais altos para não travar em rotas OSRM (waypoints densos)
        if max_curve > 90:
            return 40.0   # curva muito fechada (quase inversão)
        if max_curve > 65:
            return 65.0   # curva fechada
        if max_curve > 45:
            return 90.0   # curva moderada
        return None       # recta ou curva suave — sem limite extra

    def legal_speed_limit_kmh(self) -> float:
        """
        Limite de velocidade legal da via actual.
        Combina distância média entre waypoints com a velocidade máxima observada
        na rota para classificar o tipo de via com mais precisão.

          · urbano       → 50 km/h   (waypoints densos, avg < 80m)
          · suburbano    → 50 km/h   (avg 80-200m mas rota curta)
          · estrada      → 90 km/h   (avg 200-500m)
          · auto-estrada → 120 km/h  (avg > 500m)
        """
        n = len(self.waypoints) - 1
        if n <= 0:
            return 50.0
        total_m = sum(self._segment_len_m(i) for i in range(n))
        avg_seg_m = total_m / n

        # Waypoints muito próximos → via urbana
        if avg_seg_m < 80:
            return 50.0
        # Rota curta (< 3km total) com waypoints moderados → ainda urbana/suburbana
        if total_m < 3000 and avg_seg_m < 250:
            return 50.0
        # Waypoints muito espaçados → auto-estrada
        if avg_seg_m > 500:
            return 120.0
        # Caso geral → estrada nacional
        return 90.0

    def distance_to_end_m(self) -> float | None:
        """
        Distância restante (metros) até ao destino final quando a rota não é loop.
        Retorna None para rotas em loop.
        """
        if self._close_loop:
            return None

        n_segments = len(self.waypoints) - 1
        if n_segments <= 0:
            return 0.0
        if self._finished:
            return 0.0

        idx = max(0, min(self._idx, n_segments - 1))
        current_seg_len = self._segment_len_m(idx)
        remaining = max(0.0, current_seg_len - self._seg_pos_m)

        for seg_idx in range(idx + 1, n_segments):
            remaining += self._segment_len_m(seg_idx)

        return float(max(0.0, remaining))

    def step(self, distance_m: float) -> tuple[float, float, float]:
        n_segments = len(self.waypoints) - 1
        if n_segments <= 0:
            p = self.waypoints[0]
            return p[0], p[1], 0.0

        if self._finished and not self._close_loop:
            a = self.waypoints[n_segments - 1]
            b = self.waypoints[n_segments]
            bearing = RouteFollower._bearing_deg(a[0], a[1], b[0], b[1])
            return float(b[0]), float(b[1]), float(bearing)

        remaining = float(distance_m)
        if remaining < 0:
            remaining = 0.0

        guard = 0
        while remaining > 0 and guard < (n_segments + 5):
            guard += 1
            seg_len = self._segment_len_m(self._idx)
            if seg_len <= 0.001:
                if self._close_loop:
                    self._idx = (self._idx + 1) % n_segments
                    self._seg_pos_m = 0.0
                    continue
                if self._idx >= n_segments - 1:
                    self._seg_pos_m = 0.0
                    self._finished = True
                    remaining = 0.0
                    break
                self._idx += 1
                self._seg_pos_m = 0.0
                continue

            seg_remaining = seg_len - self._seg_pos_m
            if remaining >= seg_remaining:
                remaining -= seg_remaining
                if self._close_loop:
                    self._idx = (self._idx + 1) % n_segments
                    self._seg_pos_m = 0.0
                    continue
                if self._idx >= n_segments - 1:
                    self._seg_pos_m = seg_len
                    self._finished = True
                    remaining = 0.0
                    break
                self._idx += 1
                self._seg_pos_m = 0.0
                continue

            self._seg_pos_m += remaining
            remaining = 0.0

        a = self.waypoints[self._idx]
        b = self.waypoints[self._idx + 1]
        seg_len = self._segment_len_m(self._idx)
        t = (self._seg_pos_m / seg_len) if seg_len > 0 else 0.0
        lat = a[0] + (b[0] - a[0]) * t
        lng = a[1] + (b[1] - a[1]) * t
        bearing = RouteFollower._bearing_deg(a[0], a[1], b[0], b[1])
        return float(lat), float(lng), float(bearing)


# =============================================================================
#  ROTAS PRÉ-DEFINIDAS (estradas reais de Vila Real, Portugal)
# =============================================================================
# Coordenadas aproximadas de estradas reais.
# Cada ponto é (latitude, longitude). As rotas formam loops fechados.
# =============================================================================

ROTAS: dict[str, list[tuple[float, float]]] = {

    # ── Circuito Urbano de Vila Real (~5 km) ─────────────────────────────
    # Percurso: Rotunda Norte → Av. Carvalho Araújo → Centro → Av. 1.º Maio
    #           → Zona Sul → EN322 → Pontão → volta ao início
    "vila_real_urbano": [
        (41.3008, -7.7425),   # Rotunda Av. Carvalho Araújo (início)
        (41.3025, -7.7400),   # Av. Carvalho Araújo Norte
        (41.3045, -7.7388),
        (41.3062, -7.7410),
        (41.3068, -7.7452),   # Topo Norte
        (41.3058, -7.7502),
        (41.3040, -7.7555),
        (41.3012, -7.7592),
        (41.2980, -7.7622),   # Zona Oeste
        (41.2948, -7.7618),
        (41.2918, -7.7590),
        (41.2893, -7.7552),
        (41.2878, -7.7505),   # Sul
        (41.2876, -7.7450),
        (41.2892, -7.7402),
        (41.2918, -7.7378),
        (41.2948, -7.7368),
        (41.2972, -7.7378),
        (41.2993, -7.7398),
        (41.3008, -7.7425),   # Fecho do loop
    ],

    # ── Estrada Nacional Vila Real (~15 km) ──────────────────────────────
    # Percurso: Centro → EN2 Sul → Torgueda → Campeã → EN313 Norte → Centro
    # Segue aproximadamente a EN2 a sul de Vila Real e retorna pela EN313
    "vila_real_estrada": [
        (41.2951, -7.7463),   # Vila Real centro (início)
        (41.2912, -7.7448),
        (41.2872, -7.7432),
        (41.2832, -7.7418),
        (41.2792, -7.7402),
        (41.2752, -7.7388),
        (41.2712, -7.7372),
        (41.2678, -7.7355),   # Direcção Torgueda
        (41.2648, -7.7332),
        (41.2628, -7.7300),
        (41.2618, -7.7258),
        (41.2622, -7.7212),
        (41.2638, -7.7165),   # Torgueda
        (41.2668, -7.7118),
        (41.2708, -7.7080),
        (41.2760, -7.7062),
        (41.2812, -7.7068),   # Campeã área
        (41.2862, -7.7082),
        (41.2912, -7.7112),
        (41.2962, -7.7152),
        (41.3002, -7.7205),
        (41.3032, -7.7262),
        (41.3042, -7.7318),   # EN313 a entrar em Vila Real
        (41.3030, -7.7365),
        (41.3010, -7.7402),
        (41.2978, -7.7435),
        (41.2951, -7.7463),   # Fecho do loop
    ],
}

# Rota padrão
ROTA_PADRAO = "vila_real_estrada"


def get_route(name: str) -> list[tuple[float, float]]:
    base = ROTAS.get(name, ROTAS[ROTA_PADRAO])
    snap = os.environ.get("ROUTE_SNAP_TO_ROADS", "true").strip().lower() in ("1", "true", "yes", "y", "on")
    if not snap:
        return base
    osrm_url = os.environ.get("OSRM_URL", "https://router.project-osrm.org").strip().rstrip("/")
    snapped = _osrm_route(base, osrm_url, timeout_s=12)
    if not snapped and osrm_url.startswith("https://"):
        snapped = _osrm_route(base, "http://" + osrm_url[len("https://"):], timeout_s=12)
    return snapped if snapped else base


def get_route_between(
    start: tuple[float, float],
    end: tuple[float, float],
) -> list[tuple[float, float]]:
    snap = os.environ.get("ROUTE_SNAP_TO_ROADS", "true").strip().lower() in ("1", "true", "yes", "y", "on")
    if not snap:
        return [start, end]
    osrm_url = os.environ.get("OSRM_URL", "https://router.project-osrm.org").strip().rstrip("/")

    start_snapped = _osrm_nearest(start, osrm_url, timeout_s=8)
    end_snapped = _osrm_nearest(end, osrm_url, timeout_s=8)
    if not start_snapped and osrm_url.startswith("https://"):
        start_snapped = _osrm_nearest(start, "http://" + osrm_url[len("https://"):], timeout_s=8)
    if not end_snapped and osrm_url.startswith("https://"):
        end_snapped = _osrm_nearest(end, "http://" + osrm_url[len("https://"):], timeout_s=8)

    s = start_snapped if start_snapped else start
    e = end_snapped if end_snapped else end

    snapped = _osrm_route([s, e], osrm_url, timeout_s=12)
    if not snapped and osrm_url.startswith("https://"):
        snapped = _osrm_route([s, e], "http://" + osrm_url[len("https://"):], timeout_s=12)
    return snapped if snapped else [s, e]


def _osrm_nearest(
    point: tuple[float, float],
    osrm_url: str,
    timeout_s: float = 8,
) -> tuple[float, float] | None:
    try:
        lat, lng = point
        url = f"{osrm_url}/nearest/v1/driving/{lng},{lat}?" + urllib.parse.urlencode({
            "number": "1",
        })
        req = urllib.request.Request(url, headers={"User-Agent": "MotoGuard-IoT/1.0"})
        with urllib.request.urlopen(req, timeout=timeout_s) as res:
            raw = res.read().decode("utf-8")
        data = json.loads(raw)
        if data.get("code") != "Ok":
            return None
        wps = data.get("waypoints") or []
        if not wps:
            return None
        loc = (wps[0] or {}).get("location") or []
        if not isinstance(loc, list) or len(loc) < 2:
            return None
        lng2, lat2 = float(loc[0]), float(loc[1])
        return (lat2, lng2)
    except Exception:
        return None


def _osrm_route(
    waypoints: list[tuple[float, float]],
    osrm_url: str,
    timeout_s: float = 8,
) -> list[tuple[float, float]] | None:
    try:
        coords = ";".join([f"{lng},{lat}" for (lat, lng) in waypoints])
        url = f"{osrm_url}/route/v1/driving/{coords}?" + urllib.parse.urlencode({
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
        })
        req = urllib.request.Request(url, headers={"User-Agent": "MotoGuard-IoT/1.0"})
        with urllib.request.urlopen(req, timeout=timeout_s) as res:
            raw = res.read().decode("utf-8")
        data = json.loads(raw)
        if data.get("code") != "Ok":
            return None
        routes = data.get("routes") or []
        if not routes:
            return None
        geom = routes[0].get("geometry") or {}
        coords_out = geom.get("coordinates") or []
        if len(coords_out) < 2:
            return None
        snapped = [(float(lat), float(lng)) for (lng, lat) in coords_out]
        if snapped[0] != snapped[-1] and waypoints and waypoints[0] == waypoints[-1]:
            snapped.append(snapped[0])
        return snapped
    except Exception:
        return None
