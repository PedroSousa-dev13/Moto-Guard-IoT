# =============================================================================
# MotoGuard IoT — Testes Unitários para a Etapa 0.8
# =============================================================================
# Valida a coerência dos perfis de mota definidos em config.py:
#   · Todos os campos obrigatórios presentes em todos os perfis
#   · Pressões de óleo dentro de limites físicos reais
#   · Pressões de pneus dentro de limites físicos reais
#   · Relações físicas entre perfis (scooter < desportiva, cruiser < motocross…)
#   · Thresholds de queda coerentes com o peso da mota
#   · Temperaturas e RPM coerentes com a classe
#
# Execução:
#   python -m pytest test_profiles.py -v
#   python test_profiles.py            (unittest directo)
# =============================================================================

import sys
import os
import unittest

# Garantir que config.py é importado a partir da mesma pasta
sys.path.insert(0, os.path.dirname(__file__))
from config import PERFIS_MOTO


# Nomes dos 8 perfis esperados
PERFIS_ESPERADOS = {
    "Scooter", "Naked", "Desportiva", "Trail / Adventure",
    "Custom / Cruiser", "Motocross / Enduro", "Touring", "Supermotard",
}

# Campos obrigatórios em cada perfil (incluindo os novos da 0.8)
CAMPOS_OBRIGATORIOS = [
    "velocidade_max", "rpm_max",
    "temp_motor_min", "temp_motor_max",
    "voltagem_min", "voltagem_max",
    "roll_tipico_max", "peso_medio",
    "queda_roll_threshold", "queda_pitch_threshold",
    "queda_g_force", "queda_confirmacao_seg",
    "rpm_critico", "temp_critica", "voltagem_critica",
    # novos campos 0.8
    "oil_pressure_idle_bar", "oil_pressure_max_bar",
    "tire_pressure_front_bar", "tire_pressure_rear_bar",
]


class TestPerfisPresentes(unittest.TestCase):
    """Verifica que todos os perfis existem e têm os campos obrigatórios."""

    def test_todos_os_perfis_presentes(self):
        self.assertEqual(set(PERFIS_MOTO.keys()), PERFIS_ESPERADOS)

    def test_campos_obrigatorios_em_todos_os_perfis(self):
        for nome, perfil in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                for campo in CAMPOS_OBRIGATORIOS:
                    self.assertIn(campo, perfil,
                                  f"Campo '{campo}' em falta no perfil '{nome}'")


class TestPressaoOleo(unittest.TestCase):
    """Valida pressões de óleo por perfil."""

    def test_idle_positiva(self):
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreater(p["oil_pressure_idle_bar"], 0,
                                   f"{nome}: pressão idle deve ser > 0")

    def test_max_superior_a_idle(self):
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreater(p["oil_pressure_max_bar"],
                                   p["oil_pressure_idle_bar"],
                                   f"{nome}: pressão máx deve ser > idle")

    def test_idle_realista(self):
        """Pressão idle: 0.5–2.5 bar (especificações de fábrica reais)."""
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreaterEqual(p["oil_pressure_idle_bar"], 0.5,
                                        f"{nome}: idle demasiado baixa")
                self.assertLessEqual(p["oil_pressure_idle_bar"], 2.5,
                                     f"{nome}: idle irrealista para motos de rua")

    def test_max_realista(self):
        """Pressão máxima: 2.0–6.5 bar (limites físicos de bombas de óleo)."""
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreaterEqual(p["oil_pressure_max_bar"], 2.0,
                                        f"{nome}: pressão máx demasiado baixa")
                self.assertLessEqual(p["oil_pressure_max_bar"], 6.5,
                                     f"{nome}: pressão máx irrealista")

    def test_scooter_menor_que_desportiva(self):
        """Scooter (motor CVT/pequeno) deve ter pressão inferior à Desportiva."""
        sc = PERFIS_MOTO["Scooter"]
        ds = PERFIS_MOTO["Desportiva"]
        self.assertLess(sc["oil_pressure_idle_bar"], ds["oil_pressure_idle_bar"],
                        "Scooter deve ter pressão idle inferior à Desportiva")
        self.assertLess(sc["oil_pressure_max_bar"], ds["oil_pressure_max_bar"],
                        "Scooter deve ter pressão máx inferior à Desportiva")

    def test_cruiser_inferior_naked(self):
        """Cruiser (V-twin a ar) tipicamente tem menor pressão que Naked (inline)."""
        cr = PERFIS_MOTO["Custom / Cruiser"]
        nk = PERFIS_MOTO["Naked"]
        self.assertLess(cr["oil_pressure_idle_bar"], nk["oil_pressure_idle_bar"],
                        "Cruiser (V-twin a ar) deve ter pressão idle inferior a Naked")


class TestPressaoPneus(unittest.TestCase):
    """Valida pressões de pneus por perfil."""

    def test_pressao_positiva(self):
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreater(p["tire_pressure_front_bar"], 0)
                self.assertGreater(p["tire_pressure_rear_bar"], 0)

    def test_limites_fisicos(self):
        """Pressão de pneu: 0.8–3.5 bar (off-road mínimo; touring máximo)."""
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreaterEqual(p["tire_pressure_front_bar"], 0.8,
                                        f"{nome}: dianteiro demasiado baixo")
                self.assertLessEqual(p["tire_pressure_front_bar"], 3.5,
                                     f"{nome}: dianteiro demasiado alto")
                self.assertGreaterEqual(p["tire_pressure_rear_bar"], 0.8,
                                        f"{nome}: traseiro demasiado baixo")
                self.assertLessEqual(p["tire_pressure_rear_bar"], 3.5,
                                     f"{nome}: traseiro demasiado alto")

    def test_offroad_inferior_estrada(self):
        """Motocross/Enduro deve ter pressão de pneu muito inferior à Desportiva."""
        mx = PERFIS_MOTO["Motocross / Enduro"]
        ds = PERFIS_MOTO["Desportiva"]
        self.assertLess(mx["tire_pressure_front_bar"], ds["tire_pressure_front_bar"],
                        "Motocross (off-road) deve ter menor pressão que Desportiva (slick)")
        self.assertLess(mx["tire_pressure_rear_bar"], ds["tire_pressure_rear_bar"])

    def test_touring_traseiro_elevado(self):
        """Touring com bagagens tem pressão traseira superior à maioria."""
        tr = PERFIS_MOTO["Touring"]
        sk = PERFIS_MOTO["Scooter"]
        self.assertGreater(tr["tire_pressure_rear_bar"], sk["tire_pressure_rear_bar"],
                           "Touring (350 kg + bagagens) deve ter maior pressão traseira")


class TestThresholdsQueda(unittest.TestCase):
    """Verifica que os thresholds de queda fazem sentido físico."""

    def test_touring_cai_antes_de_motocross(self):
        """Touring (350 kg) tem thresholds muito mais baixos que Motocross (110 kg)."""
        tr = PERFIS_MOTO["Touring"]
        mx = PERFIS_MOTO["Motocross / Enduro"]
        self.assertLess(tr["queda_roll_threshold"], mx["queda_roll_threshold"],
                        "Touring (350 kg) deve ter roll_threshold inferior a Motocross")
        self.assertLess(tr["queda_g_force"], mx["queda_g_force"],
                        "Touring precisa de menos G para confirmar queda que Motocross")

    def test_desportiva_roll_superior(self):
        """Desportiva inclina até ~85° sem cair; Cruiser cai a ~50°."""
        ds = PERFIS_MOTO["Desportiva"]
        cr = PERFIS_MOTO["Custom / Cruiser"]
        self.assertGreater(ds["queda_roll_threshold"], cr["queda_roll_threshold"],
                           "Desportiva deve suportar mais roll que Cruiser")

    def test_roll_threshold_positivo(self):
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreater(p["queda_roll_threshold"], 0)
                self.assertLessEqual(p["queda_roll_threshold"], 90)

    def test_g_force_positiva_e_realista(self):
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreater(p["queda_g_force"], 0)
                self.assertLessEqual(p["queda_g_force"], 6.0,
                                     f"{nome}: g_force de queda irrealista")

    def test_confirmacao_minima(self):
        """Tempo de confirmação deve ser pelo menos 1 segundo."""
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreaterEqual(p["queda_confirmacao_seg"], 1)

    def test_offroad_confirmacao_maior(self):
        """Trail e Motocross têm confirmação de 3s (inclinações breves normais)."""
        self.assertEqual(PERFIS_MOTO["Trail / Adventure"]["queda_confirmacao_seg"], 3)
        self.assertEqual(PERFIS_MOTO["Motocross / Enduro"]["queda_confirmacao_seg"], 3)


class TestTemperaturaERPM(unittest.TestCase):
    """Verifica coerência de temperaturas e RPM entre classes."""

    def test_temp_critica_acima_de_temp_max(self):
        """Temperatura crítica deve ser sempre superior à temperatura máxima normal."""
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreater(p["temp_critica"], p["temp_motor_max"],
                                   f"{nome}: temp_critica <= temp_motor_max")

    def test_temp_min_inferio_a_max(self):
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertLess(p["temp_motor_min"], p["temp_motor_max"])

    def test_desportiva_tolera_mais_temp(self):
        """Motor de alta performance tolera mais temperatura que scooter."""
        ds = PERFIS_MOTO["Desportiva"]
        sc = PERFIS_MOTO["Scooter"]
        self.assertGreater(ds["temp_motor_max"], sc["temp_motor_max"])
        self.assertGreater(ds["temp_critica"], sc["temp_critica"])

    def test_rpm_critico_inferior_a_rpm_max(self):
        """Zona vermelha deve estar abaixo do RPM máximo absoluto."""
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertLess(p["rpm_critico"], p["rpm_max"],
                                f"{nome}: rpm_critico >= rpm_max")

    def test_desportiva_rpm_superior_a_cruiser(self):
        ds = PERFIS_MOTO["Desportiva"]
        cr = PERFIS_MOTO["Custom / Cruiser"]
        self.assertGreater(ds["rpm_max"], cr["rpm_max"])
        self.assertGreater(ds["rpm_critico"], cr["rpm_critico"])


class TestVelocidadeERoll(unittest.TestCase):
    """Verifica coerência de velocidade máxima e roll típico por classe."""

    def test_desportiva_velocidade_maxima(self):
        ds = PERFIS_MOTO["Desportiva"]
        sc = PERFIS_MOTO["Scooter"]
        self.assertGreater(ds["velocidade_max"], sc["velocidade_max"])

    def test_desportiva_roll_superior(self):
        """Desportiva inclina mais em curva que Touring ou Cruiser."""
        ds = PERFIS_MOTO["Desportiva"]
        tr = PERFIS_MOTO["Touring"]
        cr = PERFIS_MOTO["Custom / Cruiser"]
        self.assertGreater(ds["roll_tipico_max"], tr["roll_tipico_max"])
        self.assertGreater(ds["roll_tipico_max"], cr["roll_tipico_max"])

    def test_roll_tipico_positivo(self):
        for nome, p in PERFIS_MOTO.items():
            with self.subTest(perfil=nome):
                self.assertGreater(p["roll_tipico_max"], 0)
                self.assertLessEqual(p["roll_tipico_max"], 90)


if __name__ == "__main__":
    unittest.main(verbosity=2)
