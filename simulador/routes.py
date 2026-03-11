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
