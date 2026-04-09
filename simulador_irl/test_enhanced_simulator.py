import json
from simulador_irl.enhanced_simulator import IRLSimulator

def test_enhanced_simulator():
    """Teste do simulador IRL aprimorado"""
    print("=== Teste do Simulador IRL Aprimorado ===")

    # Testar com diferentes perfis
    for profile in ["Scooter", "Naked", "Desportiva"]:
        print(f"\nTestando perfil: {profile}")
        simulator = IRLSimulator(profile)

        enhanced_data = simulator.enhance_irl_data("IRL_DATA/sensor_data_20240927_150526.csv")

        print(f"  Linhas processadas: {len(enhanced_data)}")

        if enhanced_data:
            sample = enhanced_data[0]
            print(f"  Campos originais: {len([k for k in sample.keys() if k in ['lat', 'lon', 'speed_kmh', 'pitch', 'roll', 'yaw', 'accel_x', 'accel_y', 'accel_z', 'gyro_x', 'gyro_y', 'gyro_z']])}")
            print(f"  Campos adicionados: {len([k for k in sample.keys() if k not in ['lat', 'lon', 'speed_kmh', 'pitch', 'roll', 'yaw', 'accel_x', 'accel_y', 'accel_z', 'gyro_x', 'gyro_y', 'gyro_z']])}")

            # Estatísticas básicas
            rpms = [row['rpm'] for row in enhanced_data]
            temps = [row['engine_temp'] for row in enhanced_data]
            voltages = [row['voltage'] for row in enhanced_data]

            print(f"  RPM: min={min(rpms)}, max={max(rpms)}, avg={sum(rpms)/len(rpms):.0f}")
            print(f"  Temp: min={min(temps):.1f}, max={max(temps):.1f}, avg={sum(temps)/len(temps):.1f}")
            print(f"  Voltage: min={min(voltages):.2f}, max={max(voltages):.2f}, avg={sum(voltages)/len(voltages):.2f}")

    print("\n=== Teste Concluído ===")

if __name__ == "__main__":
    test_enhanced_simulator()