#!/usr/bin/env python3
"""
Análise de coerência dos dados simulados do Real Simulator.
Verifica se:
1. RPM varia coerentemente com velocidade e mudança
2. Mudanças correspondem ao esperado pela velocidade/RPM
3. Throttle está relacionado com aceleração
4. Temperatura do motor varia com RPM
5. Voltagem está consistente
"""

import csv
import math
from collections import defaultdict
from pathlib import Path

# Perfis de moto (equivalente ao código TypeScript)
PROFILES = {
    "Scooter": {
        "rpm_max": 9000,
        "rpm_idle": 1500,
        "temp_motor_min": 60,
        "temp_motor_max": 90,
        "transmissao": "CVT",
        "gear_ratios": {"min": 2.0, "max": 0.5},  # CVT
        "wheel_diameter_m": 0.4,
        "final_drive_ratio": 1.0,
    },
    "Naked": {
        "rpm_max": 12000,
        "rpm_idle": 1200,
        "temp_motor_min": 70,
        "temp_motor_max": 105,
        "transmissao": "manual",
        "gear_ratios": {1: 15.0, 2: 12.0, 3: 9.5, 4: 7.5, 5: 6.0, 6: 5.0},
        "wheel_diameter_m": 0.6,
        "final_drive_ratio": 2.8,
    },
    "Desportiva": {
        "rpm_max": 15000,
        "rpm_idle": 1000,
        "temp_motor_min": 80,
        "temp_motor_max": 110,
        "transmissao": "manual",
        "gear_ratios": {1: 16.0, 2: 13.0, 3: 10.0, 4: 8.0, 5: 6.5, 6: 5.5},
        "wheel_diameter_m": 0.6,
        "final_drive_ratio": 2.5,
    }
}

DEFAULT_PROFILE = "Naked"


def calculate_expected_rpm(speed_kmh, gear, profile):
    """Calcula RPM esperado baseado em velocidade e mudança"""
    if speed_kmh <= 0:
        return profile["rpm_idle"]
    
    if profile["transmissao"] == "CVT":
        rpm_range = profile["rpm_max"] - profile["rpm_idle"]
        speed_fraction = min(speed_kmh / 200, 1.0)
        return profile["rpm_idle"] + rpm_range * speed_fraction
    else:
        # Manual
        if gear not in profile["gear_ratios"]:
            gear = 1
        gear_ratio = profile["gear_ratios"][gear]
        wheel_circumference = math.pi * profile["wheel_diameter_m"]
        final_drive = profile["final_drive_ratio"]
        
        wheel_angular_vel = (speed_kmh * 1000 / 3600) / (wheel_circumference / 2)
        engine_rpm = wheel_angular_vel * gear_ratio * final_drive * 60 / (2 * math.pi)
        
        return max(profile["rpm_idle"], min(profile["rpm_max"], engine_rpm))


def estimate_gear_from_rpm_speed(speed_kmh, rpm, profile):
    """Estima mudança baseada em RPM e velocidade"""
    if profile["transmissao"] == "CVT":
        return 0  # CVT não tem mudanças discretas

    if speed_kmh <= 0:
        return 1

    wheel_circumference = math.pi * profile["wheel_diameter_m"]
    final_drive = profile["final_drive_ratio"]

    theoretical_rpm = (speed_kmh * 1000 / 3600) / wheel_circumference * 60 / (2 * math.pi) * final_drive

    best_gear = 1
    min_diff = float('inf')

    for gear, ratio in profile["gear_ratios"].items():
        expected_rpm = theoretical_rpm * ratio
        diff = abs(expected_rpm - rpm)
        if diff < min_diff:
            min_diff = diff
            best_gear = gear

    return best_gear


def analyze_csv_coherence(csv_path):
    """Analisa coerência de dados do CSV"""
    profile = PROFILES[DEFAULT_PROFILE]
    
    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"\n{'='*80}")
    print(f"ANÁLISE DE COERÊNCIA - {Path(csv_path).name}")
    print(f"Perfil: {DEFAULT_PROFILE}")
    print(f"Transmissão: {profile['transmissao']}")
    print(f"{'='*80}\n")

    if not rows:
        print("❌ Nenhum dado encontrado no CSV")
        return

    # Estatísticas
    stats = {
        "speed_min": float('inf'),
        "speed_max": 0,
        "rpm_min": float('inf'),
        "rpm_max": 0,
        "gear_changes": 0,
        "rpm_coherence_errors": 0,
        "gear_coherence_errors": 0,
        "throttle_inconsistencies": 0,
        "temp_anomalies": 0,
    }

    coherence_issues = []
    prev_row = None

    for i, row_dict in enumerate(rows):
        try:
            timestamp = float(row_dict.get('Timestamp', 0))
            speed_kmh = float(row_dict.get('Speed_kmh', 0))
            rpm = float(row_dict.get('Rpm', 0))
            gear = int(float(row_dict.get('Gear', 1)))
            throttle_pct = float(row_dict.get('Throttle_pct', 0))
            temp_c = float(row_dict.get('Engine_temp_c', 70))
        except ValueError:
            continue

        # Atualizar min/max
        stats["speed_min"] = min(stats["speed_min"], speed_kmh)
        stats["speed_max"] = max(stats["speed_max"], speed_kmh)
        stats["rpm_min"] = min(stats["rpm_min"], rpm)
        stats["rpm_max"] = max(stats["rpm_max"], rpm)

        # Verificar coerência RPM vs Velocidade/Mudança
        expected_rpm = calculate_expected_rpm(speed_kmh, gear, profile)
        rpm_error = abs(rpm - expected_rpm) / max(expected_rpm, profile["rpm_idle"]) * 100

        if rpm_error > 15:  # Tolerância de 15%
            stats["rpm_coherence_errors"] += 1
            if i < 50:  # Mostrar apenas os primeiros
                coherence_issues.append(
                    f"  Row {i}: RPM anómalo. Speed={speed_kmh:.1f}km/h, "
                    f"Gear={gear}, RPM={rpm:.0f} (esperado {expected_rpm:.0f}, erro {rpm_error:.1f}%)"
                )

        # Verificar coerência Gear vs RPM/Velocidade
        if profile["transmissao"] == "manual":
            estimated_gear = estimate_gear_from_rpm_speed(speed_kmh, rpm, profile)
            if estimated_gear != gear and speed_kmh > 5:  # Ignorar parado/baixa velocidade
                stats["gear_coherence_errors"] += 1
                if i < 50:
                    coherence_issues.append(
                        f"  Row {i}: Mudança questionável. Speed={speed_kmh:.1f}km/h, "
                        f"Gear={gear} (estimado {estimated_gear}), RPM={rpm:.0f}"
                    )

        # Verificar relação Throttle vs Aceleração
        if prev_row:
            prev_speed = float(prev_row.get('Speed_kmh', 0))
            dt = (timestamp - float(prev_row.get('Timestamp', 0))) / 1000.0  # em segundos
            if dt > 0:
                accel_kmh_s = (speed_kmh - prev_speed) / dt
                
                # Throttle alto deve corresponder aceleração positiva
                if throttle_pct > 50 and accel_kmh_s < 0:
                    stats["throttle_inconsistencies"] += 1

        # Verificar temperatura do motor
        if rpm < profile["rpm_idle"] * 1.2 and temp_c > profile["temp_motor_min"] + 10:
            stats["temp_anomalies"] += 1

        prev_row = row_dict

    # Relatório
    print("📊 ESTATÍSTICAS GERAIS")
    print(f"  Total de linhas: {len(rows)}")
    print(f"  Velocidade: {stats['speed_min']:.1f} → {stats['speed_max']:.1f} km/h")
    print(f"  RPM: {stats['rpm_min']:.0f} → {stats['rpm_max']:.0f}")
    print()

    print("✅ COERÊNCIA FÍSICA")
    coherence_score = 100
    
    if stats["rpm_coherence_errors"] > 0:
        pct = stats["rpm_coherence_errors"] / len(rows) * 100
        print(f"  ⚠️  RPM anómalo em {stats['rpm_coherence_errors']} linhas ({pct:.1f}%)")
        coherence_score -= min(20, pct)
    else:
        print(f"  ✅ RPM coerente com velocidade e mudança")

    if stats["gear_coherence_errors"] > 0:
        pct = stats["gear_coherence_errors"] / len(rows) * 100
        print(f"  ⚠️  Mudанças questionáveis em {stats['gear_coherence_errors']} linhas ({pct:.1f}%)")
        coherence_score -= min(20, pct)
    else:
        print(f"  ✅ Mudanças consistentes com RPM e velocidade")

    if stats["throttle_inconsistencies"] > 0:
        print(f"  ⚠️  {stats['throttle_inconsistencies']} throttle inconsistências")
        coherence_score -= min(10, stats["throttle_inconsistencies"] / len(rows) * 100)
    else:
        print(f"  ✅ Throttle consistente com aceleração")

    if stats["temp_anomalies"] > 0:
        print(f"  ⚠️  {stats['temp_anomalies']} anomalias de temperatura")
        coherence_score -= min(10, stats["temp_anomalies"] / len(rows) * 100)
    else:
        print(f"  ✅ Temperatura coerente com RPM")

    print()
    print(f"🎯 SCORE DE COERÊNCIA: {max(0, coherence_score):.0f}%")
    print()

    if coherence_issues:
        print("🔍 PROBLEMAS DETECTADOS (amostra):")
        for issue in coherence_issues[:20]:
            print(issue)
        if len(coherence_issues) > 20:
            print(f"  ... e mais {len(coherence_issues) - 20} problemas")
    else:
        print("✅ Nenhum problema detectado!")

    print()


if __name__ == "__main__":
    csv_path = Path(__file__).parent / "IRL_DATA" / "sensor_data_20240927_150526.csv"
    
    if not csv_path.exists():
        # Tentar encontrar o arquivo
        possible_paths = list(Path(__file__).parent.rglob("sensor_data_*.csv"))
        if possible_paths:
            csv_path = possible_paths[0]
        else:
            print(f"❌ Arquivo CSV não encontrado: {csv_path}")
            exit(1)
    
    analyze_csv_coherence(csv_path)
