import math
import random
from typing import Dict, Optional

# =============================================================================
#  Utilitários Matemáticos
# =============================================================================

def lerp(current: float, target: float, factor: float) -> float:
    return current + (target - current) * factor

def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))

def lerp_angle_deg(current: float, target: float, factor: float) -> float:
    diff = (target - current + 180) % 360 - 180
    return (current + diff * factor) % 360

# =============================================================================
#  Lógica de Telemetria Coerente
# =============================================================================

def calculate_rpm(speed_kmh: float, gear: int, profile: Dict, clutch_engaged: bool = False, throttle_pct: float = 0.0) -> int:
    """Calcula RPM de forma coerente com velocidade, mudança e perfil."""
    rpm_max = profile.get('rpm_max', 12000)
    rpm_idle = profile.get('rpm_idle', int(rpm_max * 0.08)) # Fallback 8% do max
    
    if speed_kmh < 1 or gear <= 0:
        # Marcha lenta ou neutro: RPM base + contribuição do acelerador
        target_rpm = rpm_idle + throttle_pct * 6
        return int(clamp(target_rpm, 0, rpm_max))

    if profile.get('transmissao') == 'CVT':
        rpm_range = rpm_max - rpm_idle
        speed_fraction = min(speed_kmh / profile.get('velocidade_max', 120), 1.0)
        target_rpm = rpm_idle + rpm_range * speed_fraction
    else:
        # Transmissão manual: usa relações de mudança se disponíveis, senão usa bandas genéricas
        gear_ratios = profile.get('gear_ratios')
        if gear_ratios and str(gear) in gear_ratios:
            # Cálculo preciso baseado em relações (usado no IRL/GPX)
            gear_ratio = gear_ratios[str(gear)]
            wheel_circ = math.pi * profile.get('wheel_diameter_m', 0.6)
            final_drive = profile.get('final_drive_ratio', 2.8)
            
            wheel_angular_vel = (speed_kmh * 1000 / 3600) / (wheel_circ / 2)
            target_rpm = wheel_angular_vel * gear_ratio * final_drive * 60 / (2 * math.pi)
        else:
            # Cálculo por bandas (usado no Headless)
            redline_speeds = { 1: 0.20, 2: 0.34, 3: 0.52, 4: 0.70, 5: 0.86, 6: 1.00 }
            red_speed = max(1.0, profile.get('velocidade_max', 200) * redline_speeds.get(gear, 1.0))
            ratio = clamp(speed_kmh / red_speed, 0.0, 1.0)
            rpm_range = rpm_max * 0.82 - rpm_idle
            target_rpm = rpm_idle + rpm_range * (ratio ** 1.8)

    if clutch_engaged:
        target_rpm = max(rpm_idle, target_rpm - 800)
        
    return int(clamp(target_rpm, 0, rpm_max))

def estimate_gear(speed_kmh: float, profile: Dict, prev_gear: int = 1, dt: float = 1.0, gear_hold_time: float = 0.0) -> int:
    """Estima a mudança ideal com histerese para evitar oscilações."""
    if profile.get('transmissao') == 'CVT':
        return 0
    if speed_kmh < 1:
        return 0
    
    v_max = profile.get('velocidade_max', 200)
    
    # Bandas de velocidade com sobreposição (histerese)
    thresholds = {
        1: [0.0, v_max * 0.20],
        2: [v_max * 0.15, v_max * 0.38],
        3: [v_max * 0.33, v_max * 0.58],
        4: [v_max * 0.53, v_max * 0.73],
        5: [v_max * 0.68, v_max * 0.88],
        6: [v_max * 0.83, v_max * 1.5],
    }
    
    # Só muda se estiver fora da banda atual e passou algum tempo na mudança anterior
    min_v, max_v = thresholds.get(prev_gear or 1, [0.0, 1000.0])
    can_shift = gear_hold_time > 1.5 # segundos mínimos na mesma mudança
    
    if speed_kmh > max_v and prev_gear < 6 and (can_shift or speed_kmh > max_v * 1.2):
        return prev_gear + 1
    if speed_kmh < min_v and prev_gear > 1 and (can_shift or speed_kmh < min_v * 0.8):
        return prev_gear - 1
        
    # Fallback para velocidade pura se prev_gear for inválido (0 ou None)
    if not prev_gear:
        for g, (low, high) in thresholds.items():
            if low <= speed_kmh <= high:
                return g
    
    return prev_gear

def calculate_g_force(accel_kmhs: float, roll_deg: float) -> float:
    """Calcula a força G resultante (física real)."""
    # G lateral: em equilíbrio numa curva tan(roll) = G_lateral
    g_lateral = abs(math.tan(math.radians(clamp(roll_deg, -80, 80))))
    
    # G longitudinal: derivado da aceleração/travagem (m/s² -> G)
    accel_ms2 = accel_kmhs / 3.6
    g_longitudinal = abs(accel_ms2) / 9.81
    
    # Resultante vetorial (1.0 é a gravidade vertical constante)
    g_combined = math.sqrt(1.0 + g_lateral**2 + g_longitudinal**2)
    return round(clamp(g_combined, 0.95, 8.0), 2)

def simulate_temperature(current_temp: float, speed_kmh: float, rpm: int, profile: Dict, dt: float = 1.0) -> float:
    """Simula a dinâmica térmica do motor."""
    t_min = profile.get('temp_motor_min', 70.0)
    t_max = profile.get('temp_motor_max', 105.0)
    t_idle_off = profile.get('temp_idle_offset', 8.0)
    v_max = profile.get('velocidade_max', 200)
    
    temp_idle = t_min + t_idle_off
    # Alvo térmico sobe com RPM/Velocidade
    target_temp = temp_idle + (t_max - temp_idle) * (speed_kmh / v_max) * 0.9
    
    lerp_factor = 0.03 * dt
    new_temp = lerp(current_temp, target_temp, lerp_factor)
    return clamp(new_temp, t_min - 10, t_max + 30)

def simulate_voltage(current_volt: float, rpm: int, profile: Dict, dt: float = 1.0, alternator_fail: bool = False) -> float:
    """Simula a voltagem do sistema elétrico."""
    v_nominal = 14.2
    v_critica = profile.get('voltagem_critica', 11.0)
    
    if alternator_fail:
        # Descarga da bateria
        target_volt = 9.0
        lerp_factor = 0.05 * dt
    else:
        # Alternador a carregar (mais eficiente a RPMs médios)
        target_volt = v_nominal + random.uniform(-0.05, 0.05)
        if rpm < profile.get('rpm_max', 10000) * 0.15:
            target_volt -= 0.5 # carga fraca em marcha lenta
        lerp_factor = 0.08 * dt
        
    new_volt = lerp(current_volt, target_volt, lerp_factor)
    return clamp(new_volt, 9.0, 15.0)

def calculate_roll_pitch(speed_kmh: float, accel_kmhs: float, yaw_diff: float, profile: Dict) -> tuple[float, float]:
    """Calcula Roll e Pitch baseados na dinâmica de condução."""
    # Pitch: frente afunda na travagem, sobe na aceleração
    target_pitch = clamp(accel_kmhs * 0.8, -12, 12)
    
    # Roll: inclinação em curva baseada em velocidade e raio (simplificado por yaw_diff)
    roll_tipico = profile.get('roll_tipico_max', 40.0)
    speed_factor = clamp(speed_kmh / 60.0, 0.1, 2.0)
    target_roll = clamp(yaw_diff * speed_factor * 0.5, -roll_tipico, roll_tipico)
    
    return target_roll, target_pitch

def simulate_pressures(rpm: int, temp_motor: float, profile: Dict) -> tuple[float, float, float]:
    """Simula pressão de óleo e pneus."""
    rpm_max = profile.get('rpm_max', 10000)
    
    # Óleo segue RPM
    o_idle = profile.get('oil_pressure_idle_bar', 1.5)
    o_max = profile.get('oil_pressure_max_bar', 5.0)
    oil = o_idle + (rpm / rpm_max) * (o_max - o_idle)
    
    # Pneus seguem temperatura do motor (calor radiante/asfalto)
    p_f_base = profile.get('tire_pressure_front_bar', 2.3)
    p_r_base = profile.get('tire_pressure_rear_bar', 2.6)
    
    t_min = profile.get('temp_motor_min', 70.0)
    t_max = profile.get('temp_motor_max', 105.0)
    temp_factor = (temp_motor - t_min) / max(1, t_max - t_min)
    
    tire_f = p_f_base + temp_factor * p_f_base * 0.08
    tire_r = p_r_base + temp_factor * p_r_base * 0.10
    
    return oil, tire_f, tire_r
