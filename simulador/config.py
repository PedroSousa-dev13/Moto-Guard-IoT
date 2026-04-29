# =============================================================================
# MotoGuard IoT - Ficheiro de Configuração
# =============================================================================
# Todas as constantes e perfis de modelos centralizados aqui.
# O simulador lê este ficheiro para adaptar limites e comportamento.
# Variáveis externas sobrepõem os valores por defeito (para Docker).
# =============================================================================

import os

# ─────────────────────────────────────────────
#  MQTT
# ─────────────────────────────────────────────
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")          # Docker: "mosquitto"
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_TOPIC_TELEMETRIA = os.environ.get("MQTT_TOPIC_TELEMETRIA", "motoguard/telemetria")
MQTT_TOPIC_COMANDO    = os.environ.get("MQTT_TOPIC_COMANDO", "motoguard/comando")
MQTT_QOS = 1
MQTT_RETAIN = False
MQTT_KEEPALIVE = 60

# Autenticação MQTT (deve corresponder às credenciais do Mosquitto)
MQTT_USER = os.environ.get("MQTT_USER", "motoguard")
MQTT_PASS = os.environ.get("MQTT_PASS", "motoguard123")

# ─────────────────────────────────────────────
#  DISPOSITIVO
# ─────────────────────────────────────────────
DEVICE_ID = "MOTOGUARD-SIM-01"
PUBLISH_INTERVAL = 0.1          # segundos entre cada payload

# ─────────────────────────────────────────────
#  LOCALIZAÇÃO SIMULADA (Vila Real, Portugal)
# ─────────────────────────────────────────────
DEFAULT_LAT = 41.2951
DEFAULT_LNG = -7.7463

# ─────────────────────────────────────────────
#  ROTA GPS PRÉ-DEFINIDA (Etapa 0.9)
#  Opções: "vila_real_urbano" | "vila_real_estrada"
# ─────────────────────────────────────────────
ROUTE_NAME = os.environ.get("ROUTE_NAME", "vila_real_estrada")
ROUTE_LOOP = os.environ.get("ROUTE_LOOP", "false").strip().lower() in (
    "1", "true", "yes", "y", "on"
)

# ─────────────────────────────────────────────
#  DETECÇÃO DE QUEDA — valores por defeito
#  (cada perfil de mota sobrepõe com os seus)
# ─────────────────────────────────────────────
QUEDA_ROLL_THRESHOLD = 90     # ° — fallback global
QUEDA_PITCH_THRESHOLD = 60    # ° — fallback global
QUEDA_G_FORCE = 2.5           # G — fallback global
QUEDA_CONFIRMACAO_SEG = 2     # segundos — fallback global

# ─────────────────────────────────────────────
#  VOLTAGEM / ALTERNADOR
# ─────────────────────────────────────────────
VOLTAGEM_NOMINAL = 14.2       # V — valor com alternador a funcionar
VOLTAGEM_CRITICA = 11.0       # V — limiar de falha do alternador

# ─────────────────────────────────────────────
#  PERFIS DE MODELOS DE MOTA
# ─────────────────────────────────────────────
# Cada perfil define os limites reais do tipo de mota.
# O simulador ajusta sliders, modo cruzeiro e detecção
# de anomalias com base nestes valores.
PERFIS_MOTO = {
    "Scooter": {
        "cilindrada_min": 50,
        "cilindrada_max": 300,
        "velocidade_max": 120,
        "rpm_max": 9000,
        "temp_motor_min": 60,
        "temp_motor_max": 90,
        "voltagem_min": 11.5,
        "voltagem_max": 14.5,
        "roll_tipico_max": 25,
        "peso_medio": 130,
        "transmissao": "CVT",
        "exemplo": "Honda PCX 125, Yamaha XMAX 300",
        # --- Thresholds específicos ---
        "queda_roll_threshold": 55,
        "queda_pitch_threshold": 45,
        "queda_g_force": 2.0,
        "queda_confirmacao_seg": 2,
        "rpm_critico": 8500,
        "temp_critica": 95,
        "voltagem_critica": 11.0,
        # --- Pressões ---
        "oil_pressure_idle_bar": 0.8,
        "oil_pressure_max_bar":  3.0,
        "tire_pressure_front_bar": 1.75,
        "tire_pressure_rear_bar":  2.00,
        # --- Comportamento de simulação ---
        "accel_max_kmhs":   6.0,   # km/h por segundo — CVT suave, motor pequeno
        "brake_max_kmhs":  12.0,   # travagem fraca (pneus pequenos)
        "cruise_min_kmh":  30.0,   # velocidade mínima de cruzeiro
        "cruise_max_frac":  0.75,  # % de vel_max como teto de cruzeiro
        "throttle_response": 0.25, # LERP do acelerador — CVT é lento
        "temp_idle_offset":  5.0,  # motor aquece pouco em marcha lenta
    },
    "Naked": {
        "cilindrada_min": 300,
        "cilindrada_max": 1000,
        "velocidade_max": 200,
        "rpm_max": 12000,
        "temp_motor_min": 70,
        "temp_motor_max": 105,
        "voltagem_min": 11.5,
        "voltagem_max": 14.5,
        "roll_tipico_max": 40,
        "peso_medio": 190,
        "exemplo": "Yamaha MT-07, KTM Duke 890",
        # --- Thresholds específicos ---
        "queda_roll_threshold": 70,
        "queda_pitch_threshold": 55,
        "queda_g_force": 2.5,
        "queda_confirmacao_seg": 2,
        "rpm_critico": 11000,
        "temp_critica": 110,
        "voltagem_critica": 11.0,
        # --- Pressões ---
        "oil_pressure_idle_bar": 1.5,
        "oil_pressure_max_bar":  4.5,
        "tire_pressure_front_bar": 2.30,
        "tire_pressure_rear_bar":  2.50,
        # --- Comportamento de simulação ---
        "accel_max_kmhs":  12.0,
        "brake_max_kmhs":  18.0,
        "cruise_min_kmh":  40.0,
        "cruise_max_frac":  0.70,
        "throttle_response": 0.35,
        "temp_idle_offset":  8.0,
    },
    "Desportiva": {
        "cilindrada_min": 600,
        "cilindrada_max": 1000,
        "velocidade_max": 299,
        "rpm_max": 15000,
        "temp_motor_min": 80,
        "temp_motor_max": 110,
        "voltagem_min": 11.5,
        "voltagem_max": 14.5,
        "roll_tipico_max": 55,
        "peso_medio": 200,
        "exemplo": "Yamaha R1, Honda CBR1000RR",
        # --- Thresholds específicos ---
        "queda_roll_threshold": 85,
        "queda_pitch_threshold": 65,
        "queda_g_force": 3.0,
        "queda_confirmacao_seg": 2,
        "rpm_critico": 14000,
        "temp_critica": 115,
        "voltagem_critica": 11.0,
        # --- Pressões ---
        "oil_pressure_idle_bar": 2.0,
        "oil_pressure_max_bar":  5.5,
        "tire_pressure_front_bar": 2.50,
        "tire_pressure_rear_bar":  2.90,
        # --- Comportamento de simulação ---
        "accel_max_kmhs":  22.0,   # aceleração brutal
        "brake_max_kmhs":  25.0,   # travagem de competição
        "cruise_min_kmh":  60.0,   # não anda devagar
        "cruise_max_frac":  0.80,  # usa mais da velocidade máxima
        "throttle_response": 0.55, # resposta imediata
        "temp_idle_offset": 15.0,  # motor quente mesmo em marcha lenta
    },
    "Trail / Adventure": {
        "cilindrada_min": 650,
        "cilindrada_max": 1250,
        "velocidade_max": 200,
        "rpm_max": 10000,
        "temp_motor_min": 70,
        "temp_motor_max": 100,
        "voltagem_min": 11.5,
        "voltagem_max": 14.5,
        "roll_tipico_max": 35,
        "peso_medio": 230,
        "exemplo": "BMW R1250GS, Honda Africa Twin",
        # --- Thresholds específicos ---
        "queda_roll_threshold": 65,
        "queda_pitch_threshold": 50,
        "queda_g_force": 2.0,
        "queda_confirmacao_seg": 3,
        "rpm_critico": 9000,
        "temp_critica": 105,
        "voltagem_critica": 11.0,
        # --- Pressões ---
        "oil_pressure_idle_bar": 1.5,
        "oil_pressure_max_bar":  4.5,
        "tire_pressure_front_bar": 2.40,
        "tire_pressure_rear_bar":  2.80,
        # --- Comportamento de simulação ---
        "accel_max_kmhs":   9.0,   # pesada mas torque elevado
        "brake_max_kmhs":  14.0,
        "cruise_min_kmh":  40.0,
        "cruise_max_frac":  0.65,  # condução mais relaxada
        "throttle_response": 0.30,
        "temp_idle_offset":  8.0,
    },
    "Custom / Cruiser": {
        "cilindrada_min": 800,
        "cilindrada_max": 1900,
        "velocidade_max": 180,
        "rpm_max": 7000,
        "temp_motor_min": 65,
        "temp_motor_max": 95,
        "voltagem_min": 11.5,
        "voltagem_max": 14.5,
        "roll_tipico_max": 30,
        "peso_medio": 300,
        "exemplo": "Harley Davidson Sportster, Indian Scout",
        # --- Thresholds específicos ---
        "queda_roll_threshold": 50,
        "queda_pitch_threshold": 40,
        "queda_g_force": 1.8,
        "queda_confirmacao_seg": 2,
        "rpm_critico": 6500,
        "temp_critica": 100,
        "voltagem_critica": 11.0,
        # --- Pressões ---
        "oil_pressure_idle_bar": 1.0,
        "oil_pressure_max_bar":  3.5,
        "tire_pressure_front_bar": 2.10,
        "tire_pressure_rear_bar":  2.40,
        # --- Comportamento de simulação ---
        "accel_max_kmhs":   7.0,   # pesada, torque baixo a altas rotações
        "brake_max_kmhs":  10.0,   # travagem fraca (peso + pneus largos)
        "cruise_min_kmh":  50.0,   # não anda devagar — cruiser
        "cruise_max_frac":  0.60,  # condução relaxada, nunca no limite
        "throttle_response": 0.20, # resposta lenta — V-twin a ar
        "temp_idle_offset": 12.0,  # motor a ar aquece muito em marcha lenta
    },
    "Motocross / Enduro": {
        "cilindrada_min": 125,
        "cilindrada_max": 450,
        "velocidade_max": 130,
        "rpm_max": 13000,
        "temp_motor_min": 80,
        "temp_motor_max": 115,
        "voltagem_min": 11.5,
        "voltagem_max": 14.5,
        "roll_tipico_max": 40,
        "peso_medio": 110,
        "exemplo": "KTM 450 EXC, Honda CRF250",
        # --- Thresholds específicos ---
        "queda_roll_threshold": 75,
        "queda_pitch_threshold": 60,
        "queda_g_force": 3.5,
        "queda_confirmacao_seg": 3,
        "rpm_critico": 12500,
        "temp_critica": 120,
        "voltagem_critica": 11.0,
        # --- Pressões ---
        "oil_pressure_idle_bar": 1.5,
        "oil_pressure_max_bar":  4.0,
        "tire_pressure_front_bar": 1.00,
        "tire_pressure_rear_bar":  1.10,
        # --- Comportamento de simulação ---
        "accel_max_kmhs":  18.0,   # leve + potente = aceleração explosiva
        "brake_max_kmhs":  20.0,
        "cruise_min_kmh":  25.0,   # pode andar devagar em off-road
        "cruise_max_frac":  0.75,
        "throttle_response": 0.50, # resposta agressiva
        "temp_idle_offset": 18.0,  # motor a ar sobreaquece rapidamente
    },
    "Touring": {
        "cilindrada_min": 1000,
        "cilindrada_max": 1800,
        "velocidade_max": 220,
        "rpm_max": 8000,
        "temp_motor_min": 60,
        "temp_motor_max": 95,
        "voltagem_min": 11.5,
        "voltagem_max": 14.5,
        "roll_tipico_max": 30,
        "peso_medio": 350,
        "exemplo": "Honda Gold Wing, BMW K1600GTL",
        # --- Thresholds específicos ---
        "queda_roll_threshold": 45,
        "queda_pitch_threshold": 35,
        "queda_g_force": 1.5,
        "queda_confirmacao_seg": 2,
        "rpm_critico": 7500,
        "temp_critica": 100,
        "voltagem_critica": 11.0,
        # --- Pressões ---
        "oil_pressure_idle_bar": 1.5,
        "oil_pressure_max_bar":  4.5,
        "tire_pressure_front_bar": 2.50,
        "tire_pressure_rear_bar":  3.00,
        # --- Comportamento de simulação ---
        "accel_max_kmhs":   8.0,   # muito pesada — aceleração lenta
        "brake_max_kmhs":  12.0,
        "cruise_min_kmh":  60.0,   # touring — velocidades de autoestrada
        "cruise_max_frac":  0.70,
        "throttle_response": 0.22, # resposta suave e progressiva
        "temp_idle_offset":  5.0,  # motor líquido bem gerido
    },
    "Supermotard": {
        "cilindrada_min": 450,
        "cilindrada_max": 700,
        "velocidade_max": 160,
        "rpm_max": 11000,
        "temp_motor_min": 75,
        "temp_motor_max": 110,
        "voltagem_min": 11.5,
        "voltagem_max": 14.5,
        "roll_tipico_max": 50,
        "peso_medio": 150,
        "exemplo": "Husqvarna 701, KTM 690 SMC",
        # --- Thresholds específicos ---
        "queda_roll_threshold": 80,
        "queda_pitch_threshold": 60,
        "queda_g_force": 3.0,
        "queda_confirmacao_seg": 2,
        "rpm_critico": 10500,
        "temp_critica": 115,
        "voltagem_critica": 11.0,
        # --- Pressões ---
        "oil_pressure_idle_bar": 1.5,
        "oil_pressure_max_bar":  4.5,
        "tire_pressure_front_bar": 2.30,
        "tire_pressure_rear_bar":  2.50,
        # --- Comportamento de simulação ---
        "accel_max_kmhs":  16.0,   # leve + torque — aceleração agressiva
        "brake_max_kmhs":  22.0,   # travagem de supermoto
        "cruise_min_kmh":  35.0,
        "cruise_max_frac":  0.75,
        "throttle_response": 0.48, # resposta rápida
        "temp_idle_offset": 14.0,  # motor a ar aquece em marcha lenta
    },
}
