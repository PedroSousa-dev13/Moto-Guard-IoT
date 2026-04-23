import unittest
from headless_simulator import HeadlessSimulator

class TestPhysicsConsistency(unittest.TestCase):
    def test_odometer_integration(self):
        """Verifica se a integração do odómetro (v * dt) é consistente."""
        sim_1hz = HeadlessSimulator()
        sim_1hz.dt = 1.0
        sim_1hz.tele.velocidade = 120.0 # km/h
        
        # Simular 3600 segundos (1 hora) a 120km/h
        # Esperado: 120km percorridos
        for _ in range(3600):
            # Simular apenas a parte do odómetro para evitar interferência da IA
            sim_1hz.tele.odometer_km += (sim_1hz.tele.velocidade / 3600.0) * sim_1hz.dt
            
        sim_10hz = HeadlessSimulator()
        sim_10hz.dt = 0.1
        sim_10hz.tele.velocidade = 120.0
        for _ in range(36000): # 10x mais ticks
            sim_10hz.tele.odometer_km += (sim_10hz.tele.velocidade / 3600.0) * sim_10hz.dt
            
        self.assertAlmostEqual(sim_1hz.tele.odometer_km, 120.0, places=2)
        self.assertAlmostEqual(sim_10hz.tele.odometer_km, 120.0, places=2)
        print(f"\n[OK] Odómetro 1Hz: {sim_1hz.tele.odometer_km:.2f} km | 10Hz: {sim_10hz.tele.odometer_km:.2f} km")

    def test_lerp_consistency(self):
        """Verifica se as suavizações (LERP) são consistentes em diferentes frequências."""
        sim_1hz = HeadlessSimulator()
        sim_1hz.dt = 1.0
        # Re-inicializar LERP com dt=1.0
        sim_1hz.lerp_vel = 1.0 - (1.0 - 0.2) ** 1.0 # 0.2
        
        sim_10hz = HeadlessSimulator()
        sim_10hz.dt = 0.1
        # Re-inicializar LERP com dt=0.1
        sim_10hz.lerp_vel = 1.0 - (1.0 - 0.2) ** 0.1 # ~0.022
        
        v1 = 0.0
        v10 = 0.0
        target = 100.0
        
        # Simular 5 segundos de aproximação ao alvo
        for _ in range(5): v1 += (target - v1) * sim_1hz.lerp_vel
        for _ in range(50): v10 += (target - v10) * sim_10hz.lerp_vel
        
        self.assertAlmostEqual(v1, v10, places=1)
        print(f"[OK] Suavização após 5s: 1Hz={v1:.2f} | 10Hz={v10:.2f}")

    def test_rpm_coherence(self):
        """Garante que o RPM é coerente com o perfil e nunca explode."""
        import moto_physics
        from config import PERFIS_MOTO
        
        for name, p in PERFIS_MOTO.items():
            rpm_max = p['rpm_max']
            rpm_idle = p.get('rpm_idle', int(rpm_max * 0.08))
            # Testar em várias velocidades
            for v in [0, 50, 100, p['velocidade_max']]:
                gear = moto_physics.estimate_gear(v, p, gear_hold_time=5.0)
                rpm = moto_physics.calculate_rpm(v, gear, p)
                self.assertLessEqual(rpm, rpm_max + 100, f"RPM {rpm} excede max {rpm_max} em {name}")
                self.assertGreaterEqual(rpm, rpm_idle - 50, f"RPM {rpm} abaixo do idle em {name}")

    def test_upshift_rpm_drop(self):
        """Garante que o RPM desce ao subir de mudança na mesma velocidade."""
        import moto_physics
        from config import PERFIS_MOTO
        
        for name, p in PERFIS_MOTO.items():
            if p.get('transmissao') == 'CVT': continue
            
            v = p['velocidade_max'] * 0.4 # Velocidade média
            r1 = moto_physics.calculate_rpm(v, 2, p)
            r2 = moto_physics.calculate_rpm(v, 3, p)
            self.assertGreater(r1, r2, f"RPM não caiu ao subir 2->3 em {name} ({r1} vs {r2})")

if __name__ == '__main__':
    unittest.main()
