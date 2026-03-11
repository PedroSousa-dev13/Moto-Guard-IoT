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
PUBLISH_INTERVAL = 1          # segundos entre cada payload

# ─────────────────────────────────────────────
#  LOCALIZAÇÃO SIMULADA (Vila Real, Portugal)
# ─────────────────────────────────────────────
DEFAULT_LAT = 41.2951
DEFAULT_LNG = -7.7463

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
        "exemplo": "Honda PCX 125, Yamaha XMAX 300",
        # --- Thresholds específicos ---
        "queda_roll_threshold": 55,    # centro gravidade alto, rodas pequenas — tomba cedo
        "queda_pitch_threshold": 45,
        "queda_g_force": 2.0,          # chassis leve — menos G para dano
        "queda_confirmacao_seg": 2,
        "rpm_critico": 8500,           # zona vermelha
        "temp_critica": 95,            # motor pequeno sobreaquece mais cedo
        "voltagem_critica": 11.0,
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
        "queda_roll_threshold": 70,    # posição semi-ereta — tomba a ~70°
        "queda_pitch_threshold": 55,
        "queda_g_force": 2.5,
        "queda_confirmacao_seg": 2,
        "rpm_critico": 11000,
        "temp_critica": 110,
        "voltagem_critica": 11.0,
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
        "queda_roll_threshold": 85,    # feita para inclinar muito — só cai a ângulos extremos
        "queda_pitch_threshold": 65,
        "queda_g_force": 3.0,          # chassis rígido — suporta mais G
        "queda_confirmacao_seg": 2,
        "rpm_critico": 14000,
        "temp_critica": 115,           # motor de alta performance tolera mais
        "voltagem_critica": 11.0,
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
        "queda_roll_threshold": 65,    # centro gravidade alto + peso — tomba mais cedo
        "queda_pitch_threshold": 50,
        "queda_g_force": 2.0,          # off-road — impactos menores já são queda
        "queda_confirmacao_seg": 3,    # off-road pode ter inclinações breves normais
        "rpm_critico": 9000,
        "temp_critica": 105,
        "voltagem_critica": 11.0,
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
        "queda_roll_threshold": 50,    # pesada + baixa — tomba muito cedo
        "queda_pitch_threshold": 40,
        "queda_g_force": 1.8,          # massa grande — pouco G para derrubar
        "queda_confirmacao_seg": 2,
        "rpm_critico": 6500,
        "temp_critica": 100,
        "voltagem_critica": 11.0,
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
        "queda_roll_threshold": 75,    # leve + off-road — inclinações normais são maiores
        "queda_pitch_threshold": 60,   # saltos causam pitch alto
        "queda_g_force": 3.5,          # saltos e terreno irregular — G alto é normal
        "queda_confirmacao_seg": 3,    # terreno irregular causa leituras breves falsas
        "rpm_critico": 12500,
        "temp_critica": 120,           # motor arrefecido a ar — tolera mais
        "voltagem_critica": 11.0,
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
        "queda_roll_threshold": 45,    # muito pesada — tomba facilmente
        "queda_pitch_threshold": 35,   # baixo centro de massa mas peso enorme
        "queda_g_force": 1.5,          # 350 kg — pouco G já é acidente sério
        "queda_confirmacao_seg": 2,
        "rpm_critico": 7500,
        "temp_critica": 100,
        "voltagem_critica": 11.0,
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
        "queda_roll_threshold": 80,    # condução agressiva é normal — roll alto esperado
        "queda_pitch_threshold": 60,   # wheelies e stoppies frequentes
        "queda_g_force": 3.0,          # condução agressiva — G alto é comum
        "queda_confirmacao_seg": 2,
        "rpm_critico": 10500,
        "temp_critica": 115,
        "voltagem_critica": 11.0,
    },
}
