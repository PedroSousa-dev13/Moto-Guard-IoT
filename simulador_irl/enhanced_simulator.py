import json
import csv
import math
import random
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Carregar perfis de motocicleta
with open('simulador_irl/motorcycle_profiles.json', 'r') as f:
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
    """Calcula RPM baseado na velocidade, marcha e perfil da moto"""
    if speed_kmh <= 0:
        return profile.get('rpm_idle', 1200)

    if profile['transmissao'] == 'CVT':
        # Para CVT, RPM varia continuamente
        rpm_range = profile['rpm_max'] - profile['rpm_idle']
        speed_fraction = min(speed_kmh / profile.get('velocidade_max', 120), 1.0)
        rpm = profile['rpm_idle'] + rpm_range * speed_fraction
        return int(clamp(rpm, profile['rpm_idle'], profile['rpm_max']))

    else:
        # Transmissão manual
        gear_ratios = profile['gear_ratios']
        if str(gear) not in gear_ratios:
            gear = 1  # fallback

        gear_ratio = gear_ratios[str(gear)]
        wheel_circumference = math.pi * profile['wheel_diameter_m']
        final_drive = profile['final_drive_ratio']

        # Velocidade angular da roda em rad/s
        wheel_angular_vel = (speed_kmh * 1000 / 3600) / (wheel_circumference / 2)

        # RPM do motor
        engine_rpm = wheel_angular_vel * gear_ratio * final_drive * 60 / (2 * math.pi)

        return int(clamp(engine_rpm, profile['rpm_idle'], profile['rpm_max']))

def estimate_throttle(speed: float, prev_speed: float, dt: float, profile: Dict) -> float:
    """Estima porcentagem do acelerador baseada na aceleração"""
    if dt <= 0:
        return 0.0

    accel = (speed - prev_speed) / (dt / 3.6)  # m/s²
    max_accel = profile.get('accel_max_kmhs', 12.0) * (1000 / 3600)  # m/s²

    if accel <= 0:
        return 0.0

    throttle = min(accel / max_accel, 1.0) * 100
    return throttle

def simulate_engine_temp(current_temp: float, rpm: int, duration: float, profile: Dict) -> float:
    """Simula temperatura do motor baseada no RPM e duração"""
    ambient_temp = 20.0
    idle_temp = profile['temp_motor_min'] + profile.get('temp_idle_offset', 5.0)

    if rpm <= profile.get('rpm_idle', 1200):
        # Em marcha lenta, temperatura tende para idle_temp
        target_temp = idle_temp
    else:
        # Em funcionamento, temperatura aumenta com RPM
        rpm_factor = (rpm - profile['rpm_idle']) / (profile['rpm_max'] - profile['rpm_idle'])
        target_temp = profile['temp_motor_min'] + rpm_factor * (profile['temp_motor_max'] - profile['temp_motor_min'])

    # LERP suave
    lerp_factor = 0.03 * duration  # Ajustar baseado na duração
    new_temp = current_temp + (target_temp - current_temp) * lerp_factor

    return clamp(new_temp, ambient_temp, profile['temp_motor_max'] + 10)

def simulate_voltage(rpm: int, profile: Dict) -> float:
    """Simula voltagem com variações realistas"""
    base_voltage = profile['voltagem_nominal']

    # Variação baseada no RPM (alternador)
    if rpm < profile.get('rpm_idle', 1200) * 1.2:
        # Baixo RPM, voltagem cai
        voltage = base_voltage * 0.8 + random.uniform(-0.5, 0.5)
    else:
        voltage = base_voltage + random.uniform(-0.2, 0.2)

    return clamp(voltage, profile['voltagem_min'], profile['voltagem_max'])

def estimate_gear(speed: float, rpm: int, profile: Dict) -> int:
    """Estima a marcha baseada na velocidade e RPM (para dados IRL sem gear)"""
    if profile['transmissao'] == 'CVT':
        return 0  # CVT não tem marchas

    # Para manual, estimar marcha baseada na relação RPM/velocidade
    if speed <= 0:
        return 1

    # Calcular marcha teórica
    wheel_circumference = math.pi * profile['wheel_diameter_m']
    final_drive = profile['final_drive_ratio']

    theoretical_rpm = (speed * 1000 / 3600) / wheel_circumference * 60 / (2 * math.pi) * final_drive

    gear_ratios = profile['gear_ratios']
    best_gear = 1
    min_diff = float('inf')

    for g, ratio in gear_ratios.items():
        expected_rpm = theoretical_rpm * ratio
        diff = abs(expected_rpm - rpm)
        if diff < min_diff:
            min_diff = diff
            best_gear = int(g)

    return best_gear

def clamp(value: float, min_val: float, max_val: float) -> float:
    """Limita valor entre min e max"""
    return max(min_val, min(max_val, value))

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