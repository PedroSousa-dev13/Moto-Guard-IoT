import csv
import os
from collections import defaultdict

def analyze_irl_csv(file_path):
    """
    Analyze IRL sensor data CSV to understand available fields and data structure.
    """
    sensor_counts = defaultdict(int)
    timestamps = []
    data_samples = defaultdict(list)

    with open(file_path, 'r', encoding='utf-8') as f:
        # Skip header lines until "COLLECTED DATA"
        for line in f:
            if "COLLECTED DATA" in line:
                break

        # Read CSV data
        reader = csv.reader(f)
        headers = next(reader)  # Sensor, Timestamp, Valor_X, Valor_Y, Valor_Z

        for row in reader:
            if len(row) < 5:
                continue
            sensor, timestamp, x, y, z = row[0], int(row[1]), float(row[2]), float(row[3]), float(row[4])

            sensor_counts[sensor] += 1
            timestamps.append(timestamp)

            if sensor == 'GPS':
                data_samples['lat'].append(x)
                data_samples['lon'].append(y)
                data_samples['speed_kmh'].append(z)
            elif sensor == 'AHRS':
                data_samples['pitch'].append(x)
                data_samples['roll'].append(y)
                data_samples['yaw'].append(z)
            elif sensor == 'ACEL':
                data_samples['accel_x'].append(x)
                data_samples['accel_y'].append(y)
                data_samples['accel_z'].append(z)
            elif sensor == 'GYRO':
                data_samples['gyro_x'].append(x)
                data_samples['gyro_y'].append(y)
                data_samples['gyro_z'].append(z)

    # Summary
    print("=== Análise de Dados IRL ===")
    print(f"Arquivo: {file_path}")
    print(f"Total de registros: {sum(sensor_counts.values())}")
    print(f"Duração aproximada: {(max(timestamps) - min(timestamps)) / 1000:.1f} segundos")
    print()

    print("Contagem por sensor:")
    for sensor, count in sensor_counts.items():
        print(f"  {sensor}: {count}")
    print()

    print("Campos disponíveis:")
    available_fields = []
    if 'GPS' in sensor_counts:
        available_fields.extend(['latitude', 'longitude', 'speed_kmh'])
    if 'AHRS' in sensor_counts:
        available_fields.extend(['pitch', 'roll', 'yaw'])
    if 'ACEL' in sensor_counts:
        available_fields.extend(['accel_x', 'accel_y', 'accel_z'])
    if 'GYRO' in sensor_counts:
        available_fields.extend(['gyro_x', 'gyro_y', 'gyro_z'])
    print(f"  {available_fields}")
    print()

    print("Campos ausentes (telemetria motocicleta):")
    missing_fields = ['rpm', 'gear', 'throttle_pct', 'engine_temp', 'voltage']
    print(f"  {missing_fields}")
    print()

    print("Estatísticas básicas:")
    for field, values in data_samples.items():
        if values:
            print(f"  {field}: min={min(values):.2f}, max={max(values):.2f}, avg={sum(values)/len(values):.2f}")

if __name__ == "__main__":
    csv_file = "IRL_DATA/sensor_data_20240927_150526.csv"
    if os.path.exists(csv_file):
        analyze_irl_csv(csv_file)
    else:
        print(f"Arquivo {csv_file} não encontrado.")