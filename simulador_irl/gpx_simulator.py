"""
MotoGuard IoT — GPX Simulator
==============================
Parses GPX route files (lat/lon/ele/time), derives speed & acceleration
from GPS coordinates, and enriches with synthetic motorcycle telemetry
using the same physics profiles as the IRL simulator.

Data coherence guarantees:
 - Speed is smoothed (EMA) to eliminate GPS jitter
 - Gear transitions are gradual (max ±1 per step)
 - Engine temp ramps naturally from cold start
 - Throttle includes cruise component for constant-speed riding
 - Voltage uses smooth deterministic variation (sine wave, not random)
 - Data is capped at MAX_DURATION_SEC (10 min) for performance

Key advantage over IRL: elevation data enables slope-aware throttle/RPM.
"""

import json
import math
from datetime import datetime
from typing import Dict, List
from xml.etree import ElementTree as ET

# Carregar perfis de motocicleta (mesmo ficheiro do IRL simulator)
with open('simulador_irl/motorcycle_profiles.json', 'r') as f:
    MOTORCYCLE_PROFILES = json.load(f)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_DURATION_SEC = 600    # 10 minutos — dados GPX são cortados após este limite
SPEED_SMOOTH_ALPHA = 0.3  # EMA alpha para suavização de velocidade (0 = sem, 1 = raw)


# ---------------------------------------------------------------------------
# Haversine & Bearing utilities
# ---------------------------------------------------------------------------

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula distância em metros entre dois pontos GPS (Haversine)."""
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula o bearing (direção) em graus entre dois pontos GPS."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dlam = math.radians(lon2 - lon1)

    x = math.sin(dlam) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam)

    bearing = math.atan2(x, y)
    return (math.degrees(bearing) + 360) % 360


# ---------------------------------------------------------------------------
# Physics functions
# ---------------------------------------------------------------------------

def clamp(value: float, min_val: float, max_val: float) -> float:
    """Limita valor entre min e max."""
    return max(min_val, min(max_val, value))


def calculate_rpm_from_speed(speed_kmh: float, gear: int, profile: Dict) -> int:
    """Calcula RPM baseado na velocidade, marcha e perfil da moto."""
    if speed_kmh <= 0:
        return profile.get('rpm_idle', 1200)

    if profile['transmissao'] == 'CVT':
        rpm_range = profile['rpm_max'] - profile['rpm_idle']
        speed_fraction = min(speed_kmh / profile.get('velocidade_max', 120), 1.0)
        rpm = profile['rpm_idle'] + rpm_range * speed_fraction
        return int(clamp(rpm, profile['rpm_idle'], profile['rpm_max']))
    else:
        gear_ratios = profile['gear_ratios']
        if str(gear) not in gear_ratios:
            gear = 1

        gear_ratio = gear_ratios[str(gear)]
        wheel_circumference = math.pi * profile['wheel_diameter_m']
        final_drive = profile['final_drive_ratio']

        wheel_angular_vel = (speed_kmh * 1000 / 3600) / (wheel_circumference / 2)
        engine_rpm = wheel_angular_vel * gear_ratio * final_drive * 60 / (2 * math.pi)

        return int(clamp(engine_rpm, profile['rpm_idle'], profile['rpm_max']))


def estimate_throttle(speed: float, prev_speed: float, dt: float,
                      slope_deg: float) -> float:
    """
    Estima porcentagem do acelerador com coerência.
    Inclui componente de cruzeiro para velocidade constante.
    """
    if dt <= 0:
        return 0.0

    accel_kmhs = (speed - prev_speed) / dt  # km/h por segundo
    slope_factor = math.sin(math.radians(slope_deg)) * 9.81

    # Throttle de cruzeiro: velocidade constante requer algum throttle
    cruise_throttle = clamp(15 + (speed / 200) * 25, 10, 40) if speed > 3 else 0
    slope_bonus = clamp(slope_factor * 5, -20, 30)

    if accel_kmhs > 0.5:
        # Aceleração
        accel_component = clamp((accel_kmhs / 15) * 60, 0, 60)
        return clamp(cruise_throttle + accel_component + slope_bonus, 0, 100)
    elif accel_kmhs < -1.0:
        # Travagem
        return clamp(slope_bonus, 0, 15)
    else:
        # Cruzeiro
        return clamp(cruise_throttle + slope_bonus, 0, 60)


def simulate_engine_temp(current_temp: float, rpm: int, duration: float, profile: Dict) -> float:
    """Simula temperatura do motor com ramp-up natural do frio."""
    idle_temp = profile['temp_motor_min'] + profile.get('temp_idle_offset', 5.0)

    if rpm <= profile.get('rpm_idle', 1200) * 1.2:
        target_temp = idle_temp
    else:
        rpm_factor = (rpm - profile['rpm_idle']) / (profile['rpm_max'] - profile['rpm_idle'])
        target_temp = profile['temp_motor_min'] + rpm_factor * (profile['temp_motor_max'] - profile['temp_motor_min'])

    # Lerp lento para ramp-up natural
    lerp_factor = 0.02 * duration
    new_temp = current_temp + (target_temp - current_temp) * lerp_factor

    return clamp(new_temp, 20.0, profile['temp_motor_max'] + 10)


def simulate_voltage(rpm: int, timestamp_sec: float, profile: Dict) -> float:
    """Simula voltagem com variação determinística suave (sine wave)."""
    base_voltage = profile['voltagem_nominal']

    # Variação suave baseada em sine wave (em vez de random)
    wave = math.sin(timestamp_sec * 0.3) * 0.15 + math.sin(timestamp_sec * 0.7) * 0.05

    if rpm < profile.get('rpm_idle', 1200) * 1.2:
        voltage = base_voltage * 0.85 + wave
    else:
        voltage = base_voltage + wave

    return clamp(voltage, profile['voltagem_min'], profile['voltagem_max'])


def estimate_gear_from_speed(speed: float, profile: Dict) -> int:
    """Estima a marcha alvo baseada na velocidade."""
    if profile['transmissao'] == 'CVT':
        return 0

    if speed <= 0:
        return 1

    if profile['rpm_max'] >= 15000:
        vel_max = 280
    elif profile['rpm_max'] >= 12000:
        vel_max = 200
    else:
        vel_max = 120

    speed_pct = speed / vel_max

    if speed_pct <= 0.15:
        return 1
    elif speed_pct <= 0.35:
        return 2
    elif speed_pct <= 0.60:
        return 3
    elif speed_pct <= 0.75:
        return 4
    elif speed_pct <= 0.90:
        return 5
    return 6


# ---------------------------------------------------------------------------
# GPX Parser
# ---------------------------------------------------------------------------

def parse_gpx(gpx_path: str) -> List[Dict]:
    """
    Faz parsing de um ficheiro GPX e retorna lista de trackpoints.
    Cada ponto: { lat, lon, ele, time (datetime), time_str }
    """
    tree = ET.parse(gpx_path)
    root = tree.getroot()

    ns = ''
    if root.tag.startswith('{'):
        ns = root.tag.split('}')[0] + '}'

    trackpoints = []

    for trkpt in root.iter(f'{ns}trkpt'):
        lat = float(trkpt.get('lat', 0))
        lon = float(trkpt.get('lon', 0))

        ele_elem = trkpt.find(f'{ns}ele')
        ele = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0.0

        time_elem = trkpt.find(f'{ns}time')
        time_str = time_elem.text if time_elem is not None and time_elem.text else None

        timestamp = None
        if time_str:
            try:
                timestamp = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
            except ValueError:
                try:
                    timestamp = datetime.strptime(time_str, '%Y-%m-%dT%H:%M:%S.%fZ')
                except ValueError:
                    timestamp = datetime.strptime(time_str, '%Y-%m-%dT%H:%M:%SZ')

        trackpoints.append({
            'lat': lat,
            'lon': lon,
            'ele': ele,
            'time': timestamp,
            'time_str': time_str
        })

    return trackpoints


# ---------------------------------------------------------------------------
# GPX Simulator
# ---------------------------------------------------------------------------

class GPXSimulator:
    """Simulador para enriquecer dados GPX com telemetria coerente de motocicleta."""

    def __init__(self, profile_name: str = "Naked", max_duration_sec: int = MAX_DURATION_SEC):
        if profile_name not in MOTORCYCLE_PROFILES:
            raise ValueError(f"Perfil '{profile_name}' não encontrado. "
                           f"Disponíveis: {list(MOTORCYCLE_PROFILES.keys())}")
        self.profile = MOTORCYCLE_PROFILES[profile_name]
        self.profile_name = profile_name
        self.max_duration_sec = max_duration_sec
        # Start cold (below idle temp) for natural warm-up
        self.current_temp = self.profile['temp_motor_min'] - 10.0

    def enhance_gpx_data(self, gpx_path: str) -> List[Dict]:
        """Processa ficheiro GPX e retorna dados enriquecidos com telemetria coerente."""
        all_trackpoints = parse_gpx(gpx_path)

        if len(all_trackpoints) < 2:
            print(f"⚠️  GPX com apenas {len(all_trackpoints)} pontos, mínimo 2 necessários")
            return []

        # --- 10-minute cap ---
        base_time = all_trackpoints[0]['time']
        original_count = len(all_trackpoints)

        if base_time:
            trackpoints = [
                pt for pt in all_trackpoints
                if pt['time'] and (pt['time'] - base_time).total_seconds() <= self.max_duration_sec
            ]
        else:
            trackpoints = all_trackpoints[:self.max_duration_sec]  # fallback: 1pt/s

        trimmed = len(trackpoints) < original_count
        if trimmed:
            print(f"[TRIM] Cortado de {original_count} para {len(trackpoints)} pontos "
                  f"({self.max_duration_sec // 60} min)")

        if len(trackpoints) < 2:
            print(f"[WARN] Apos corte, apenas {len(trackpoints)} pontos restantes")
            return []

        # ---------------------------------------------------------------
        # Pass 1: Derive raw speeds
        # ---------------------------------------------------------------

        raw_data = []
        prev_bearing = 0.0

        for i in range(len(trackpoints)):
            pt = trackpoints[i]

            if pt['time'] and base_time:
                timestamp_sec = (pt['time'] - base_time).total_seconds()
            else:
                timestamp_sec = i * 1.0

            if i > 0:
                prev_pt = trackpoints[i - 1]
                distance_m = haversine_distance(prev_pt['lat'], prev_pt['lon'],
                                                pt['lat'], pt['lon'])

                if pt['time'] and prev_pt['time']:
                    dt = max((pt['time'] - prev_pt['time']).total_seconds(), 0.1)
                else:
                    dt = 1.0

                raw_speed = min((distance_m / dt) * 3.6, 300.0)

                ele_diff = pt['ele'] - prev_pt['ele']
                slope_deg = math.degrees(math.atan2(ele_diff, distance_m)) if distance_m > 0 else 0.0

                bearing = calculate_bearing(prev_pt['lat'], prev_pt['lon'],
                                          pt['lat'], pt['lon'])
                bearing_change = bearing - prev_bearing
                if bearing_change > 180:
                    bearing_change -= 360
                elif bearing_change < -180:
                    bearing_change += 360
            else:
                distance_m = 0.0
                raw_speed = 0.0
                slope_deg = 0.0
                bearing = 0.0
                bearing_change = 0.0
                dt = 1.0
                ele_diff = 0.0

            raw_data.append({
                'pt': pt,
                'timestamp_sec': timestamp_sec,
                'raw_speed': raw_speed,
                'distance_m': distance_m,
                'slope_deg': slope_deg,
                'bearing': bearing,
                'bearing_change': bearing_change,
                'dt': dt,
                'ele_diff': ele_diff,
            })
            prev_bearing = bearing

        # ---------------------------------------------------------------
        # Pass 2: Smooth speeds (EMA) and build coherent telemetry
        # ---------------------------------------------------------------

        enhanced_data = []
        smoothed_speed = 0.0
        prev_smoothed_speed = 0.0
        prev_gear = 1

        for j, rp in enumerate(raw_data):
            # Exponential Moving Average for speed smoothing
            if j == 0:
                smoothed_speed = rp['raw_speed']
            else:
                smoothed_speed = SPEED_SMOOTH_ALPHA * rp['raw_speed'] + (1 - SPEED_SMOOTH_ALPHA) * smoothed_speed

            # Clamp micro-speeds (< 2 km/h is GPS drift noise)
            if smoothed_speed < 2:
                smoothed_speed = 0.0

            # --- Coherent gear: max ±1 change per step ---
            target_gear = estimate_gear_from_speed(smoothed_speed, self.profile)
            if self.profile['transmissao'] == 'CVT':
                gear = 0
            elif target_gear > prev_gear:
                gear = prev_gear + 1
            elif target_gear < prev_gear:
                gear = prev_gear - 1
            else:
                gear = prev_gear
            gear = int(clamp(gear, 1, 6))

            # RPM from smoothed speed + coherent gear
            rpm = calculate_rpm_from_speed(smoothed_speed, gear, self.profile)

            # Throttle from smoothed speed delta (coherent)
            throttle_pct = estimate_throttle(
                smoothed_speed, prev_smoothed_speed, rp['dt'], rp['slope_deg']
            )

            # Engine temp: natural ramp-up
            self.current_temp = simulate_engine_temp(self.current_temp, rpm, rp['dt'], self.profile)

            # Voltage: smooth deterministic variation
            voltage = simulate_voltage(rpm, rp['timestamp_sec'], self.profile)

            # Acceleration (from smoothed speed)
            accel_ms2 = (smoothed_speed - prev_smoothed_speed) / 3.6 / max(rp['dt'], 0.1) if j > 0 else 0.0

            # G-Force
            g_force = math.sqrt(accel_ms2 ** 2 + 9.81 ** 2) / 9.81

            # Sintetizar pitch e roll
            pitch_deg = clamp(rp['slope_deg'], -45, 45)
            if smoothed_speed > 5 and abs(rp['bearing_change']) > 0.5:
                roll_deg = clamp(rp['bearing_change'] * smoothed_speed / 200, -45, 45)
            else:
                roll_deg = 0.0

            pt = rp['pt']
            enhanced_row = {
                'timestamp_sec': round(rp['timestamp_sec'], 3),
                'lat': pt['lat'],
                'lon': pt['lon'],
                'ele': pt['ele'],
                'speed_kmh': round(smoothed_speed, 2),
                'distance_m': round(rp['distance_m'], 2),
                'slope_deg': round(rp['slope_deg'], 2),
                'bearing': round(rp['bearing'], 2),
                'rpm': rpm,
                'gear': gear,
                'throttle_pct': round(throttle_pct, 1),
                'engine_temp': round(self.current_temp, 1),
                'voltage': round(voltage, 2),
                'g_force': round(g_force, 3),
                'pitch_deg': round(pitch_deg, 2),
                'roll_deg': round(roll_deg, 2),
                'yaw_deg': round(rp['bearing'], 2),
                'accel_ms2': round(accel_ms2, 3),
            }

            enhanced_data.append(enhanced_row)
            prev_smoothed_speed = smoothed_speed
            prev_gear = gear

        return enhanced_data


# ---------------------------------------------------------------------------
# Função principal para teste
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    gpx_file = sys.argv[1] if len(sys.argv) > 1 else "gpx_files/2022-dolomiti-2-best-mountain-passes-ride.gpx"
    profile = sys.argv[2] if len(sys.argv) > 2 else "Naked"

    print(f"[GPX Simulator] Perfil: {profile}")
    print(f"[Ficheiro] {gpx_file}")
    print(f"[Limite] {MAX_DURATION_SEC // 60} minutos")
    print()

    simulator = GPXSimulator(profile)
    enhanced = simulator.enhance_gpx_data(gpx_file)

    print(f"[OK] Processados {len(enhanced)} pontos enriquecidos")

    if enhanced:
        speeds = [r['speed_kmh'] for r in enhanced]
        elevations = [r['ele'] for r in enhanced]
        total_time = enhanced[-1]['timestamp_sec']
        total_dist = sum(r['distance_m'] for r in enhanced) / 1000

        print(f"\n[Estatisticas] (primeiros {MAX_DURATION_SEC // 60} min):")
        print(f"   Duracao: {total_time / 60:.1f} min ({total_time:.0f}s)")
        print(f"   Distancia: {total_dist:.1f} km")
        print(f"   Vel. media: {sum(speeds) / len(speeds):.1f} km/h")
        print(f"   Vel. maxima: {max(speeds):.1f} km/h")
        print(f"   Elevacao: {min(elevations):.0f}m - {max(elevations):.0f}m")

        # Mostrar coerencia: primeiros 10 pontos de gear/rpm/throttle
        print(f"\n[Coerencia] (primeiros 10 pontos):")
        print(f"   {'t(s)':>6} {'vel':>6} {'gear':>4} {'rpm':>5} {'thr%':>5} {'temp':>5} {'volt':>5}")
        for r in enhanced[:10]:
            print(f"   {r['timestamp_sec']:6.1f} {r['speed_kmh']:6.1f} "
                  f"{r['gear']:4d} {r['rpm']:5d} {r['throttle_pct']:5.1f} "
                  f"{r['engine_temp']:5.1f} {r['voltage']:5.2f}")

