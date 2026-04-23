import sys
import os

# Adicionar o diretório atual ao path para importar config e moto_physics
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import PERFIS_MOTO
import moto_physics

def verify_shifting(name, p):
    print(f"\n--- Analisando Mudanças: {name} ---")
    vel_max = p["velocidade_max"]
    
    for mode, throttle in [("ECO (20%)", 20.0), ("SPORT (90%)", 90.0)]:
        print(f"\nModo {mode}:")
        current_gear = 1
        results = []
        for v in range(0, int(vel_max * 1.1), 1):
            new_gear = moto_physics.estimate_gear(v, p, prev_gear=current_gear, gear_hold_time=5.0, throttle_pct=throttle)
            if new_gear != current_gear:
                rpm = moto_physics.calculate_rpm(v, current_gear, p, throttle_pct=throttle)
                print(f"  [Shift] {current_gear} -> {new_gear} a {v} km/h ({rpm:.0f} RPM)")
                current_gear = new_gear

if __name__ == "__main__":
    # Testar num perfil manual (ex: Naked)
    verify_shifting("Naked", PERFIS_MOTO["Naked"])
    verify_shifting("Desportiva", PERFIS_MOTO["Desportiva"])
