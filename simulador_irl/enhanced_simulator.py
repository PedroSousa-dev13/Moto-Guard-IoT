import json
import csv
import math
import random
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import sys
from pathlib import Path

# Adicionar root ao path para importar moto_physics
_THIS_DIR = Path(__file__).parent.resolve()
sys.path.append(str(_THIS_DIR.parent))
from simulador import moto_physics

# Carregar perfis de motocicleta
with open(str(_THIS_DIR / 'motorcycle_profiles.json'), 'r') as f:
    MOTORCYCLE_PROFILES = json.load(f)

class EnhancedRow:
    """Estrutura para dados aprimorados IRL"""
    def __init__(self, original_row, **enhanced_fields):
        # Copiar campos originais
        for key, value in original_row.items():
            setattr(self, key, value)

        # Adicionar campos calculados
        for key, value in enhanced_fields.items():
            setattr(self, key, value)

    def to_dict(self):
        return self.__dict__

def calculate_rpm_from_speed(speed_kmh: float, gear: int, profile: Dict) -> int:
    return moto_physics.calculate_rpm(speed_kmh, gear, profile)

def estimate_throttle(speed: float, prev_speed: float, dt: float, profile: Dict) -> float:
    if dt <= 0: return 0.0
    accel_kmhs = (speed - prev_speed) / dt
    # Lógica de estimativa de throttle simples mantida por ser específica de IRL
    max_accel = profile.get('accel_max_kmhs', 12.0)
    return moto_physics.clamp(accel_kmhs / max_accel * 100, 0, 100)

def simulate_engine_temp(current_temp: float, rpm: int, duration: float, profile: Dict) -> float:
    return moto_physics.simulate_temperature(current_temp, 0.0, rpm, profile, duration)

def simulate_voltage(rpm: int, profile: Dict) -> float:
    # Para IRL o voltagem é estático por tick aqui, mas vamos usar a lógica unificada
    return moto_physics.simulate_voltage(profile.get('voltagem_nominal', 14.2), rpm, profile, 1.0)

def estimate_gear(speed: float, rpm: int, profile: Dict) -> int:
    if profile.get('transmissao') == 'CVT': return 0
    if speed <= 0: return 1
    
    wheel_circ = math.pi * profile.get('wheel_diameter_m', 0.6)
    final_drive = profile.get('final_drive_ratio', 2.8)
    theoretical_rpm_base = (speed * 1000 / 3600) / (wheel_circ / (2 * math.pi)) * 60 / (2 * math.pi) * final_drive
    
    gear_ratios = profile.get('gear_ratios', {})
    best_gear = 1
    min_diff = float('inf')
    for g, ratio in gear_ratios.items():
        expected_rpm = theoretical_rpm_base * ratio
        diff = abs(expected_rpm - rpm)
        if diff < min_diff:
            min_diff = diff
            best_gear = int(g)
    return best_gear

class IRLSimulator:
    """Simulador para aprimorar dados IRL com telemetria de motocicleta"""

    def __init__(self, profile_name: str = "Naked"):
        if profile_name not in MOTORCYCLE_PROFILES:
            raise ValueError(f"Perfil '{profile_name}' não encontrado")
        self.profile = MOTORCYCLE_PROFILES[profile_name]
        self.current_temp = self.profile['temp_motor_min'] + self.profile.get('temp_idle_offset', 5.0)

    def enhance_irl_data(self, csv_path: str) -> List[Dict]:
        """Processa CSV IRL e retorna dados aprimorados"""
        enhanced_data = []
        prev_row = None
        prev_timestamp = None

        with open(csv_path, 'r', encoding='utf-8') as f:
            # Pular cabeçalhos
            for line in f:
                if "COLLECTED DATA" in line:
                    break

            reader = csv.reader(f)
            headers = next(reader)  # Sensor, Timestamp, Valor_X, Valor_Y, Valor_Z

            current_gps = None
            current_ahrs = None
            current_accel = None
            current_gyro = None

            for row in reader:
                if len(row) < 5:
                    continue
                sensor, timestamp_str, x, y, z = row
                timestamp = int(timestamp_str)
                x, y, z = float(x), float(y), float(z)

                # Agrupar dados por timestamp (aproximado)
                if sensor == 'GPS':
                    current_gps = {'lat': x, 'lon': y, 'speed_kmh': z}
                elif sensor == 'AHRS':
                    current_ahrs = {'pitch': x, 'roll': y, 'yaw': z}
                elif sensor == 'ACEL':
                    current_accel = {'accel_x': x, 'accel_y': y, 'accel_z': z}
                elif sensor == 'GYRO':
                    current_gyro = {'gyro_x': x, 'gyro_y': y, 'gyro_z': z}

                # Quando temos todos os sensores para um timestamp, processar
                if current_gps and current_ahrs and current_accel and current_gyro:
                    # Combinar em uma linha
                    combined_row = {
                        'timestamp': timestamp,
                        **current_gps,
                        **current_ahrs,
                        **current_accel,
                        **current_gyro
                    }

                    # Calcular dt
                    dt = 1.0  # default 1s
                    if prev_timestamp:
                        dt = (timestamp - prev_timestamp) / 1000.0

                    # Estimar gear (se não disponível)
                    gear = estimate_gear(combined_row['speed_kmh'],
                                       calculate_rpm_from_speed(combined_row['speed_kmh'], 1, self.profile),
                                       self.profile)

                    # Calcular campos aprimorados
                    rpm = calculate_rpm_from_speed(combined_row['speed_kmh'], gear, self.profile)

                    throttle_pct = 0.0
                    if prev_row:
                        throttle_pct = estimate_throttle(combined_row['speed_kmh'],
                                                       prev_row.get('speed_kmh', 0),
                                                       dt, self.profile)

                    # Simular temperatura
                    self.current_temp = simulate_engine_temp(self.current_temp, rpm, dt, self.profile)

                    # Simular voltagem
                    voltage = simulate_voltage(rpm, self.profile)

                    # Calcular G-force aproximado
                    # Assumindo que ACEL está em m/s² (se o IMU já reportar em g's, remover a divisão por 9.81)
                    g_force = math.sqrt(combined_row['accel_x']**2 +
                                      combined_row['accel_y']**2 +
                                      combined_row['accel_z']**2) / 9.81

                    # Criar linha aprimorada
                    enhanced_row = EnhancedRow(
                        combined_row,
                        rpm=rpm,
                        gear=gear,
                        throttle_pct=throttle_pct,
                        engine_temp=self.current_temp,
                        voltage=voltage,
                        g_force=g_force
                    )

                    enhanced_data.append(enhanced_row.to_dict())
                    prev_row = combined_row
                    prev_timestamp = timestamp

                    # Reset para próximo conjunto
                    current_gps = current_ahrs = current_accel = current_gyro = None

        return enhanced_data

# Função principal para teste
if __name__ == "__main__":
    simulator = IRLSimulator("Naked")
    enhanced = simulator.enhance_irl_data("IRL_DATA/sensor_data_20240927_150526.csv")

    print(f"Processadas {len(enhanced)} linhas aprimoradas")
    if enhanced:
        print("Exemplo de linha aprimorada:")
        print(json.dumps(enhanced[0], indent=2))