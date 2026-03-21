"""
test_model_selection.py — Testa a seleção automática de modelos (GPX vs Telemetria)

Uso:
  docker exec motoguard-backend python /ml/test_model_selection.py
"""

import json
import sys
from pathlib import Path

# Adicionar o diretório pai ao path
sys.path.insert(0, str(Path(__file__).parent))
from infer import infer

print("=" * 70)
print("TESTE: Seleção Automática de Modelos ML")
print("=" * 70)

# ── Teste 1: Viagem do Simulador (deve usar modelo de telemetria) ────────────
print("\n[Teste 1] Viagem SIMULATOR (deve usar modelo telemetria)")
print("-" * 70)

trip_simulator = {
    "trip": {
        "id": "test-simulator-001",
        "source": "SIMULATOR",
        "maxSpeedKmh": 120.5,
        "maxRollDeg": 35.2,
        "maxGForce": 2.1,
        "distanceKm": 45.3,
        "avgSpeedKmh": 65.0,
        "startedAt": "2024-01-15T10:00:00Z",
        "endedAt": "2024-01-15T11:30:00Z",
    },
    "events": [
        {"type": "HARD_BRAKING", "severity": "WARNING"},
        {"type": "SPEEDING", "severity": "CRITICAL"},
    ],
    "profile": {
        "maxSpeedKmh": 180,
        "typicalMaxRollDeg": 45,
        "crashRollThreshold": 60,
        "crashGForce": 3.5,
    },
}

result_sim = infer(trip_simulator)
print(f"✓ Modelo usado: {result_sim.get('modelType', 'ERRO')}")
print(f"✓ ML Score: {result_sim.get('mlScore', 'N/A')}")
print(f"✓ Model Version: {result_sim.get('modelVersion', 'N/A')}")
if result_sim.get('error'):
    print(f"✗ ERRO: {result_sim['error']}")

# ── Teste 2: Viagem GPX (deve usar modelo GPX) ───────────────────────────────
print("\n[Teste 2] Viagem GPX_IMPORTED (deve usar modelo GPX)")
print("-" * 70)

trip_gpx = {
    "trip": {
        "id": "test-gpx-001",
        "source": "GPX_IMPORTED",
        "maxSpeedKmh": 95.3,
        "avgSpeedKmh": 55.2,
        "distanceKm": 32.1,
        "startedAt": "2024-01-15T14:00:00Z",
        "endedAt": "2024-01-15T15:15:00Z",
    },
    "gpx_waypoints": [
        {"lat": 38.7223, "lon": -9.1393, "ele": 100.0, "time": "2024-01-15T14:00:00Z", "speedKmh": 50.0},
        {"lat": 38.7233, "lon": -9.1403, "ele": 105.0, "time": "2024-01-15T14:01:00Z", "speedKmh": 55.0},
        {"lat": 38.7243, "lon": -9.1413, "ele": 110.0, "time": "2024-01-15T14:02:00Z", "speedKmh": 60.0},
        {"lat": 38.7253, "lon": -9.1423, "ele": 108.0, "time": "2024-01-15T14:03:00Z", "speedKmh": 58.0},
        {"lat": 38.7263, "lon": -9.1433, "ele": 102.0, "time": "2024-01-15T14:04:00Z", "speedKmh": 52.0},
    ],
    "events": [],
    "profile": None,
}

result_gpx = infer(trip_gpx)
print(f"✓ Modelo usado: {result_gpx.get('modelType', 'ERRO')}")
print(f"✓ ML Score: {result_gpx.get('mlScore', 'N/A')}")
print(f"✓ Model Version: {result_gpx.get('modelVersion', 'N/A')}")
if result_gpx.get('error'):
    print(f"✗ ERRO: {result_gpx['error']}")

# ── Teste 3: Viagem sem source (fallback para telemetria) ────────────────────
print("\n[Teste 3] Viagem sem campo 'source' (fallback para telemetria)")
print("-" * 70)

trip_no_source = {
    "trip": {
        "id": "test-no-source-001",
        "maxSpeedKmh": 80.0,
        "maxRollDeg": 25.0,
        "maxGForce": 1.5,
        "distanceKm": 20.0,
        "avgSpeedKmh": 50.0,
        "startedAt": "2024-01-15T16:00:00Z",
        "endedAt": "2024-01-15T16:30:00Z",
    },
    "events": [],
    "profile": None,
}

result_no_source = infer(trip_no_source)
print(f"✓ Modelo usado: {result_no_source.get('modelType', 'ERRO')}")
print(f"✓ ML Score: {result_no_source.get('mlScore', 'N/A')}")
print(f"✓ Model Version: {result_no_source.get('modelVersion', 'N/A')}")
if result_no_source.get('error'):
    print(f"✗ ERRO: {result_no_source['error']}")

# ── Resumo ────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("RESUMO DOS TESTES")
print("=" * 70)

tests_passed = 0
tests_total = 3

# Teste 1: Deve ser Telemetria
if result_sim.get('modelType') == 'Telemetria' and not result_sim.get('error'):
    print("✓ Teste 1 PASSOU: Viagem SIMULATOR usa modelo telemetria")
    tests_passed += 1
else:
    print("✗ Teste 1 FALHOU: Viagem SIMULATOR não usou modelo telemetria")

# Teste 2: Deve ser GPX
if result_gpx.get('modelType') == 'GPX' and not result_gpx.get('error'):
    print("✓ Teste 2 PASSOU: Viagem GPX_IMPORTED usa modelo GPX")
    tests_passed += 1
else:
    print("✗ Teste 2 FALHOU: Viagem GPX_IMPORTED não usou modelo GPX")

# Teste 3: Deve ser Telemetria (fallback)
if result_no_source.get('modelType') == 'Telemetria' and not result_no_source.get('error'):
    print("✓ Teste 3 PASSOU: Viagem sem source usa modelo telemetria (fallback)")
    tests_passed += 1
else:
    print("✗ Teste 3 FALHOU: Viagem sem source não usou modelo telemetria")

print(f"\nResultado: {tests_passed}/{tests_total} testes passaram")
print("=" * 70)

sys.exit(0 if tests_passed == tests_total else 1)
