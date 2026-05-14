# =============================================================================
# MotoGuard IoT — Dockerfile (Simulador Python - Headless)
# =============================================================================

FROM python:3.12-slim

WORKDIR /simulador

# Instalar dependências (apenas paho-mqtt, sem GUI)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY config.py headless_simulator.py routes.py moto_physics.py ./

# Variáveis externas por defeito
ENV MQTT_BROKER=mosquitto
ENV MQTT_PORT=1883
ENV MQTT_USER=motoguard
ENV MQTT_PASS=motoguard123
ENV SIM_MODELO=Naked
ENV PYTHONUNBUFFERED=1

CMD ["python", "headless_simulator.py"]
