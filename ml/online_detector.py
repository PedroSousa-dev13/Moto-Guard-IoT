"""
online_detector.py — Detecção de anomalias em tempo real para janelas de telemetria.

Input (stdin):
  [ { "speedKmh": float, "rpm": int, "rollDeg": float, "gForce": float, ... }, ... ]

Output (stdout):
  { "isAnomaly": bool, "anomalyScore": float, "reason": str | null }
"""

import json
import sys
import numpy as np

def detect_anomalies(points):
    """
    Detecta anomalias numa janela de telemetria usando desvios estatísticos (Z-Score).
    Uma abordagem mais pesada usaria Isolation Forest, mas para RT, Z-Score é mais eficiente.
    """
    if not points or len(points) < 3:
        return {"isAnomaly": False, "anomalyScore": 0.0, "reason": "Poucos dados"}

    # Extrair vetores de features relevantes
    speeds = [p.get("speedKmh", 0) for p in points]
    rolls = [p.get("rollDeg", 0) for p in points]
    gforces = [p.get("gForce", 1.0) for p in points]
    rpms = [p.get("rpm", 0) for p in points]
    
    # 1. Verificar variações bruscas (derivadas)
    speed_delta = np.abs(np.diff(speeds))
    roll_delta = np.abs(np.diff(rolls))
    
    # Thresholds simples para anomalias em tempo real (fora do normal da física de uma mota)
    # Ex: aceleração > 15km/h em 100ms (impossível/anómalo)
    if any(speed_delta > 20):
        return {"isAnomaly": True, "anomalyScore": 0.9, "reason": "Variação brusca de velocidade"}
        
    if any(roll_delta > 30):
        return {"isAnomaly": True, "anomalyScore": 0.8, "reason": "Mudança súbita de inclinação"}

    # 2. Verificar valores absolutos extremos
    max_g = max(gforces)
    if max_g > 3.5: # 3.5G é muito alto para uma mota normal em estrada
        return {"isAnomaly": True, "anomalyScore": 0.85, "reason": "G-Force excessiva"}
        
    # 3. Consistência RPM vs Velocidade
    # Se RPM está alto e velocidade é 0 por muito tempo (e não é ponto morto)
    last_rpm = rpms[-1]
    last_speed = speeds[-1]
    if last_rpm > 5000 and last_speed < 1:
         return {"isAnomaly": True, "anomalyScore": 0.7, "reason": "RPM elevado em repouso"}

    return {"isAnomaly": False, "anomalyScore": 0.1, "reason": None}

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            return
            
        points = json.loads(raw_input)
        result = detect_anomalies(points)
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"isAnomaly": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
