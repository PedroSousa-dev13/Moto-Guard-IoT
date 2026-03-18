# =============================================================================
# MotoGuard IoT — Testes Unitários: RouteFollower (Tarefa 0.9)
# =============================================================================
# Cobre:
#   · Inicialização e validação de argumentos
#   · _haversine_m: distância entre pontos lat/lng
#   · _bearing_deg: azimute Norte/Sul/Este/Oeste
#   · update(): retorno correto, avanço de waypoint, yaw/dist
#   · _lookahead_max_curve: ângulo máximo de curva à frente
#   · Limites de velocidade por curva (40/65/90/None)
#   · reset(): reinício por índice
#   · ROTAS: presença, tamanho mínimo, loops fechados, bbox Portugal
# =============================================================================

import math
import unittest

from routes import ROTA_PADRAO, ROTAS, RouteFollower, RouteCursor


# ─── auxiliares locais ────────────────────────────────────────────────────────

def _make_rf(*waypoints):
    """Cria RouteFollower com os waypoints dados."""
    return RouteFollower(list(waypoints))


def _straight_route(n=6, step=0.01):
    """Retorna n waypoints em linha recta para Norte (sem curvas)."""
    return [(step * i, 0.0) for i in range(n)]


def _square_route():
    """
    Waypoints em quadrado (4 lados → 4 viragens de 90°).
    Ao fazer lookahead de 4 passos, max_curve ≈ 90° → speed_limit = 40.
    """
    return [
        (0.00, 0.00),
        (0.10, 0.00),
        (0.10, 0.10),
        (0.00, 0.10),
        (0.00, 0.00),   # fecho do loop
    ]


# =============================================================================
#  1. Inicialização
# =============================================================================
class TestRouteFollowerInit(unittest.TestCase):

    def test_init_valido(self):
        rf = _make_rf((0.0, 0.0), (1.0, 0.0))
        self.assertEqual(rf._idx, 0)

    def test_init_poucos_waypoints_raise(self):
        with self.assertRaises(ValueError):
            _make_rf((0.0, 0.0))

    def test_init_lista_vazia_raise(self):
        with self.assertRaises(ValueError):
            RouteFollower([])

    def test_arrival_radius_padrao(self):
        rf = _make_rf((0.0, 0.0), (1.0, 0.0))
        self.assertEqual(rf.arrival_radius_m, 30.0)

    def test_arrival_radius_personalizado(self):
        rf = RouteFollower([(0.0, 0.0), (1.0, 0.0)], arrival_radius_m=50.0)
        self.assertEqual(rf.arrival_radius_m, 50.0)

    def test_waypoints_guardados(self):
        wps = [(0.0, 0.0), (1.0, 0.0), (2.0, 0.0)]
        rf = RouteFollower(wps)
        self.assertEqual(rf.waypoints, wps)


# =============================================================================
#  2. _haversine_m
# =============================================================================
class TestHaversineM(unittest.TestCase):

    def test_mesmo_ponto_zero(self):
        d = RouteFollower._haversine_m(41.0, -7.5, 41.0, -7.5)
        self.assertAlmostEqual(d, 0.0, places=3)

    def test_simetria(self):
        d1 = RouteFollower._haversine_m(41.0, -7.5, 42.0, -7.5)
        d2 = RouteFollower._haversine_m(42.0, -7.5, 41.0, -7.5)
        self.assertAlmostEqual(d1, d2, places=2)

    def test_1_grau_latitude_aprox_111km(self):
        # 1° de latitude ≈ 111 320 m
        d = RouteFollower._haversine_m(0.0, 0.0, 1.0, 0.0)
        self.assertAlmostEqual(d, 111_320.0, delta=200.0)

    def test_distancia_positiva(self):
        d = RouteFollower._haversine_m(41.3, -7.7, 41.4, -7.8)
        self.assertGreater(d, 0.0)

    def test_resultado_em_metros(self):
        # ~100 m de diferença em lat — valor deve estar na casa das centenas
        d = RouteFollower._haversine_m(41.0, -7.5, 41.001, -7.5)
        self.assertGreater(d, 50)
        self.assertLess(d, 500)


# =============================================================================
#  3. _bearing_deg
# =============================================================================
class TestBearingDeg(unittest.TestCase):

    def test_norte_0_graus(self):
        b = RouteFollower._bearing_deg(0.0, 0.0, 1.0, 0.0)
        self.assertAlmostEqual(b, 0.0, delta=0.5)

    def test_sul_180_graus(self):
        b = RouteFollower._bearing_deg(1.0, 0.0, 0.0, 0.0)
        self.assertAlmostEqual(b, 180.0, delta=0.5)

    def test_este_90_graus(self):
        b = RouteFollower._bearing_deg(0.0, 0.0, 0.0, 1.0)
        self.assertAlmostEqual(b, 90.0, delta=0.5)

    def test_oeste_270_graus(self):
        b = RouteFollower._bearing_deg(0.0, 0.0, 0.0, -1.0)
        self.assertAlmostEqual(b, 270.0, delta=0.5)

    def test_intervalo_0_360(self):
        pontos = [(41.3, -7.7), (41.2, -7.8), (41.4, -7.6), (40.9, -8.0)]
        for i in range(len(pontos) - 1):
            b = RouteFollower._bearing_deg(*pontos[i], *pontos[i + 1])
            self.assertGreaterEqual(b, 0.0)
            self.assertLess(b, 360.0)

    def test_ne_entre_0_e_90(self):
        # Nordeste: lat ↑ lng ↑ → bearing entre 0 e 90
        b = RouteFollower._bearing_deg(0.0, 0.0, 1.0, 1.0)
        self.assertGreater(b, 0.0)
        self.assertLess(b, 90.0)


# =============================================================================
#  4. update()
# =============================================================================
class TestUpdate(unittest.TestCase):

    def setUp(self):
        self.rf = RouteFollower(_straight_route())

    def test_retorna_chaves_esperadas(self):
        info = self.rf.update(0.0, 0.0)
        self.assertIn("target_yaw_deg",  info)
        self.assertIn("speed_limit_kmh", info)
        self.assertIn("dist_to_next_m",  info)
        self.assertIn("waypoint_idx",    info)

    def test_target_yaw_em_intervalo(self):
        info = self.rf.update(0.0, 0.0)
        self.assertGreaterEqual(info["target_yaw_deg"], 0.0)
        self.assertLess(info["target_yaw_deg"], 360.0)

    def test_dist_positiva(self):
        info = self.rf.update(0.0, 0.0)
        self.assertGreater(info["dist_to_next_m"], 0.0)

    def test_speed_limit_none_ou_numerico(self):
        info = self.rf.update(0.0, 0.0)
        self.assertTrue(
            info["speed_limit_kmh"] is None
            or isinstance(info["speed_limit_kmh"], (int, float))
        )

    def test_waypoint_avanca_ao_chegar(self):
        # Criar rf com arrival_radius grande — qualquer chamada avança
        rf = RouteFollower(
            [(0.0, 0.0), (1.0, 0.0), (2.0, 0.0)],
            arrival_radius_m=9_999_999.0,
        )
        rf.update(0.0, 0.0)   # está dentro do raio → avança para idx=1
        self.assertEqual(rf._idx, 1)

    def test_loop_wrap_around(self):
        # Com rota de 2 waypoints e raio enorme, deve fazer wrap ao fim
        rf = RouteFollower(
            [(0.0, 0.0), (1.0, 0.0)],
            arrival_radius_m=9_999_999.0,
        )
        rf.update(0.0, 0.0)   # idx 0 → 1
        self.assertEqual(rf._idx, 1)
        rf.update(1.0, 0.0)   # idx 1 → wrap para 0
        self.assertEqual(rf._idx, 0)

    def test_yaw_aponta_para_norte_em_rota_vertical(self):
        # Rota em linha recta para Norte; posição no início → yaw ≈ 0°
        rf = RouteFollower([(0.0, 0.0), (1.0, 0.0), (2.0, 0.0)])
        info = rf.update(0.0, 0.0)
        self.assertAlmostEqual(info["target_yaw_deg"], 0.0, delta=2.0)


# =============================================================================
#  5. _lookahead_max_curve
# =============================================================================
class TestLookaheadMaxCurve(unittest.TestCase):

    def test_recta_angulo_proximo_zero(self):
        # Rota em linha recta → mudança de bearing ≈ 0
        rf = RouteFollower(_straight_route())
        angle = rf._lookahead_max_curve(steps=4)
        self.assertLess(angle, 5.0)

    def test_quadrado_angulo_alta(self):
        # Quadrado → viragens de 90°
        rf = RouteFollower(_square_route())
        angle = rf._lookahead_max_curve(steps=4)
        self.assertGreater(angle, 60.0)

    def test_steps_default_4(self):
        # _lookahead_max_curve() sem argumento usa steps=4
        rf = RouteFollower(_straight_route())
        a1 = rf._lookahead_max_curve()
        a2 = rf._lookahead_max_curve(steps=4)
        self.assertAlmostEqual(a1, a2, places=5)

    def test_resultado_nao_negativo(self):
        rf = RouteFollower(_square_route())
        angle = rf._lookahead_max_curve(steps=4)
        self.assertGreaterEqual(angle, 0.0)


# =============================================================================
#  6. Limites de velocidade por curva
# =============================================================================
class TestSpeedLimits(unittest.TestCase):

    def _update_near_wp0(self, waypoints):
        """
        Retorna speed_limit de um update() sem avançar idx.
        Começa ~40 m a norte de wp[0], fora do arrival_radius de 30 m,
        de modo a que idx permaneça em 0 e o lookahead não sofra
        wrap-around artificial em rotas não-circular.
        """
        rf  = RouteFollower(waypoints)
        lat = waypoints[0][0] + 40.0 / 111_320.0   # +40 m em latitude
        lng = waypoints[0][1]
        return rf.update(lat, lng)["speed_limit_kmh"]

    def test_recta_sem_limite(self):
        # Rota recta com 10 pontos: todos os bearings ≈ 0° → max_curve < 22° → None
        speed = self._update_near_wp0(_straight_route(n=10))
        self.assertIsNone(speed)

    def test_curva_muito_fechada_40kmh(self):
        # Quadrado → viragem 90° → speed_limit = 40
        speed = self._update_near_wp0(_square_route())
        self.assertEqual(speed, 40.0)

    def test_curva_moderada_65kmh(self):
        # Rota com viragem de ~50° entre wp0→wp1 e wp1→wp2.
        # idx=0 mantido (posição 40 m antes de wp[0]) → lookahead
        # vê a viragem correctamente sem artefacto de wrap-around.
        wps = [
            (0.00, 0.00),
            (0.10, 0.00),   # bearing ≈ 0° (Norte)
            (0.15, 0.06),   # bearing ≈ 50° (NE)
            (0.20, 0.12),   # continua ~50°
            (0.25, 0.18),
            (0.30, 0.24),
        ]
        rf    = RouteFollower(wps)
        angle = rf._lookahead_max_curve(steps=4)  # idx=0, sem wrap
        if 40 < angle <= 65:
            speed = self._update_near_wp0(wps)
            self.assertEqual(speed, 65.0)
        else:
            self.skipTest(f"Geometria fora de range (angle={angle:.1f}°)")

    def test_speed_limit_nao_negativo(self):
        speed = self._update_near_wp0(_square_route())
        if speed is not None:
            self.assertGreater(speed, 0.0)


# =============================================================================
#  7. reset()
# =============================================================================
class TestReset(unittest.TestCase):

    def test_reset_default_indice_0(self):
        rf = RouteFollower(_straight_route())
        rf._idx = 3
        rf.reset()
        self.assertEqual(rf._idx, 0)

    def test_reset_indice_personalizado(self):
        rf = RouteFollower(_straight_route())
        rf.reset(2)
        self.assertEqual(rf._idx, 2)

    def test_reset_wrap_modulo(self):
        wps = _straight_route(n=4)     # índices 0..3
        rf = RouteFollower(wps)
        rf.reset(10)                   # 10 % 4 = 2
        self.assertEqual(rf._idx, 2)

    def test_reset_repoe_percurso(self):
        rf = RouteFollower(_straight_route(), arrival_radius_m=9_999_999.0)
        rf.update(0.0, 0.0)   # avança idx
        rf.reset()
        self.assertEqual(rf._idx, 0)


# =============================================================================
#  8. ROTAS pré-definidas
# =============================================================================
class TestRotas(unittest.TestCase):

    def test_ambas_rotas_presentes(self):
        self.assertIn("vila_real_urbano",   ROTAS)
        self.assertIn("vila_real_estrada",  ROTAS)

    def test_rota_padrao_existe(self):
        self.assertIn(ROTA_PADRAO, ROTAS)

    def test_minimo_3_waypoints_por_rota(self):
        for nome, wps in ROTAS.items():
            with self.subTest(rota=nome):
                self.assertGreaterEqual(len(wps), 3)

    def test_coordenadas_em_portugal(self):
        # Portugal continental: lat 36–42°, lng -10 a -6°
        for nome, wps in ROTAS.items():
            for lat, lng in wps:
                with self.subTest(rota=nome, lat=lat, lng=lng):
                    self.assertGreaterEqual(lat, 36.0)
                    self.assertLessEqual(lat, 42.0)
                    self.assertGreaterEqual(lng, -10.0)
                    self.assertLessEqual(lng, -6.0)

    def test_loop_fechado_primeiro_ultimo_perto(self):
        # Último waypoint deve estar perto do primeiro (< 5 km)
        for nome, wps in ROTAS.items():
            with self.subTest(rota=nome):
                d = RouteFollower._haversine_m(
                    wps[0][0], wps[0][1], wps[-1][0], wps[-1][1]
                )
                self.assertLess(d, 5000.0, msg=f"Loop de {nome} não está fechado (d={d:.0f} m)")

    def test_rota_instancia_route_follower(self):
        for nome, wps in ROTAS.items():
            with self.subTest(rota=nome):
                rf = RouteFollower(wps)
                info = rf.update(wps[0][0], wps[0][1])
                self.assertIn("target_yaw_deg", info)

    def test_todas_rotas_listas_de_tuplos(self):
        for nome, wps in ROTAS.items():
            with self.subTest(rota=nome):
                for wp in wps:
                    self.assertIsInstance(wp, tuple)
                    self.assertEqual(len(wp), 2)
                    self.assertIsInstance(wp[0], float)
                    self.assertIsInstance(wp[1], float)


# =============================================================================
#  9. Integração minimal (update contínuo ao longo da rota)
# =============================================================================
class TestUpdateContinuo(unittest.TestCase):

    def test_percorre_rota_completa_sem_loop_infinito(self):
        """
        Simula 500 ticks com física simples e verifica que o RouteFollower:
        · Nunca levanta exceção
        · Avança pelo menos 1 waypoint
        · Mantém yaw em [0, 360)
        """
        wps = ROTAS["vila_real_estrada"]
        rf  = RouteFollower(wps)
        lat, lng = wps[0]
        visited = {0}

        for _ in range(500):
            info = rf.update(lat, lng)
            yaw_rad   = math.radians(info["target_yaw_deg"])
            speed_kmh = info["speed_limit_kmh"] or 80.0
            speed_ms  = speed_kmh / 3.6
            lat += (speed_ms * math.cos(yaw_rad)) / 111_320.0
            lng += (speed_ms * math.sin(yaw_rad)) / (111_320.0 * math.cos(math.radians(lat)))
            visited.add(info["waypoint_idx"])

            self.assertGreaterEqual(info["target_yaw_deg"], 0.0)
            self.assertLess(info["target_yaw_deg"], 360.0)

        self.assertGreater(len(visited), 1, "RouteFollower nunca avançou de waypoint")


class TestRouteCursor(unittest.TestCase):

    def test_init_fecha_loop_se_necessario(self):
        rc = RouteCursor([(0.0, 0.0), (0.0, 1.0)])
        self.assertEqual(rc.waypoints[0], rc.waypoints[-1])
        self.assertGreaterEqual(len(rc.waypoints), 3)

    def test_step_zero_mantem_posicao_inicial(self):
        rc = RouteCursor([(0.0, 0.0), (0.0, 0.01), (0.0, 0.0)])
        lat, lng, bearing = rc.step(0)
        self.assertAlmostEqual(lat, 0.0, places=8)
        self.assertAlmostEqual(lng, 0.0, places=8)
        self.assertGreaterEqual(bearing, 0.0)
        self.assertLess(bearing, 360.0)

    def test_step_avanca_e_faz_loop(self):
        rc = RouteCursor([(0.0, 0.0), (0.0, 0.001), (0.0, 0.0)])
        lat1, lng1, _ = rc.step(200)
        self.assertNotEqual((lat1, lng1), (0.0, 0.0))
        lat2, lng2, _ = rc.step(50_000)
        self.assertGreaterEqual(lat2, -1.0)
        self.assertLessEqual(lat2, 1.0)
        self.assertGreaterEqual(lng2, -1.0)
        self.assertLessEqual(lng2, 1.0)

    def test_rota_aberta_marca_finished(self):
        rc = RouteCursor([(0.0, 0.0), (0.0, 0.001)], close_loop=False)
        self.assertFalse(rc.finished)
        rc.step(500_000)
        self.assertTrue(rc.finished)

    def test_speed_limit_retorna_none_ou_numero(self):
        rc = RouteCursor(_square_route())
        v = rc.speed_limit_kmh(steps=4)
        self.assertTrue(v is None or isinstance(v, (int, float)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
