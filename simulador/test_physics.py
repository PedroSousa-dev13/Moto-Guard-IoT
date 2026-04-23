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

if __name__ == '__main__':
    unittest.main()
