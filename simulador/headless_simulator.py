# =============================================================================
# MotoGuard IoT — Simulador Headless (sem GUI — para Docker)
# =============================================================================
#  Gera telemetria idêntica ao simulador principal, mas sem dependência
#  de customtkinter. Ideal para correr dentro de um container Docker.
#
#  Usa:  python headless_simulator.py [--modelo Naked] [--evento queda]
#
#  Variáveis de ambiente suportadas (via config.py):
#    MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASS, etc.
# =============================================================================

import paho.mqtt.client as mqtt
import json
import math
import random
import time
import signal
import sys
import argparse
import os
from datetime import datetime, timezone

from config import (
    MQTT_BROKER, MQTT_PORT, MQTT_TOPIC_TELEMETRIA, MQTT_TOPIC_COMANDO,
    MQTT_QOS, MQTT_RETAIN, MQTT_KEEPALIVE, MQTT_USER, MQTT_PASS,
    DEVICE_ID, PUBLISH_INTERVAL,
    DEFAULT_LAT, DEFAULT_LNG,
    QUEDA_ROLL_THRESHOLD, QUEDA_PITCH_THRESHOLD, QUEDA_G_FORCE,
    QUEDA_CONFIRMACAO_SEG, VOLTAGEM_NOMINAL, VOLTAGEM_CRITICA,
    PERFIS_MOTO,
)

# ── Constantes de interpolação (suavidade por tick de 1s) ─────────────────────
LERP_VEL   = 0.15
LERP_RPM   = 0.20
LERP_ROLL  = 0.12
LERP_PITCH = 0.18
LERP_TEMP  = 0.03
LERP_VOLT  = 0.08


# =============================================================================
#  Funções utilitárias
# =============================================================================
def lerp(current: float, target: float, factor: float) -> float:
    return current + (target - current) * factor


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# =============================================================================
#  Estado de Telemetria
# =============================================================================
class TelemetriaState:

    def __init__(self):
        self.velocidade: float = 0.0
        self.rpm: int = 0
        self.temp_motor: float = 70.0
        self.voltagem: float = VOLTAGEM_NOMINAL
        self.roll: float = 0.0
        self.pitch: float = 0.0
        self.yaw: float = 0.0
        self.g_force: float = 0.0
        self.lat: float = DEFAULT_LAT
        self.lng: float = DEFAULT_LNG

        self.gear: int = 0
        self.throttle_pct: float = 0.0
        self.clutch_engaged: bool = False
        self.brake_front_pct: float = 0.0
        self.brake_rear_pct: float = 0.0
        self.odometer_km: float = 0.0

        self.abs_active: bool = False
        self.tc_active: bool = False
        self.side_stand_down: bool = False

        self.oil_pressure_bar: float = 4.0
        self.tire_pressure_front: float = 2.5
        self.tire_pressure_rear: float = 2.9

        self.ambient_light_lux: float = 500.0

        self._target_vel: float = 0.0
        self._target_yaw: float = 0.0
        self._acceleration: float = 0.0
        self._clutch_timer: int = 0
        self._prev_gear: int = 0

        self.flag_queda: bool = False
        self.flag_alternador: bool = False
        self.flag_sobreaquecimento: bool = False
        self._queda_timer: int = 0
        self._queda_confirmed: bool = False

        self.th_roll: float = QUEDA_ROLL_THRESHOLD
        self.th_pitch: float = QUEDA_PITCH_THRESHOLD
        self.th_g_force: float = QUEDA_G_FORCE
        self.th_confirmacao: int = QUEDA_CONFIRMACAO_SEG
        self.th_rpm_critico: int = 14000
        self.th_temp_critica: float = 110.0
        self.th_volt_critica: float = VOLTAGEM_CRITICA

    def evento_activo(self) -> str:
        if self._queda_confirmed:
            return "QUEDA_CONFIRMADA"
        if self.flag_queda:
            return "POSSIVEL_QUEDA"
        if self.flag_alternador and self.voltagem < self.th_volt_critica:
            return "FALHA_ALTERNADOR"
        if self.flag_sobreaquecimento and self.temp_motor > self.th_temp_critica:
            return "SOBREAQUECIMENTO"
        return "NORMAL"

    def reset_eventos(self):
        self.flag_queda = False
        self.flag_alternador = False
        self.flag_sobreaquecimento = False
        self._queda_timer = 0
        self._queda_confirmed = False
        self.g_force = 0.0


# =============================================================================
#  Simulador Headless
# =============================================================================
class HeadlessSimulator:

    def __init__(self, modelo: str = "Naked"):
        self.mqtt_client: mqtt.Client | None = None
        self.connected = False
        self.running = True

        self.tele = TelemetriaState()
        self.perfil_nome: str | None = None
        self._tick_count = 0

        # Limites do perfil
        self.vel_max = 200
        self.rpm_max = 12000
        self.temp_min = 70.0
        self.temp_max = 105.0
        self.volt_min = 11.5
        self.volt_max = 14.5
        self.roll_tipico = 40.0
        self.peso = 190
        self.th_roll = QUEDA_ROLL_THRESHOLD
        self.th_pitch = QUEDA_PITCH_THRESHOLD
        self.th_g_force = QUEDA_G_FORCE
        self.th_confirmacao = QUEDA_CONFIRMACAO_SEG
        self.th_rpm_critico = 11000
        self.th_temp_critica = 110.0
        self.th_volt_critica = VOLTAGEM_CRITICA

        # Modelo inicial
        self.modelo_inicial = modelo

        # Graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        log("Sinal de paragem recebido — a encerrar…")
        self.running = False

    # ========================================================================
    #  Perfil
    # ========================================================================
    def _carregar_perfil(self, nome: str) -> bool:
        if nome not in PERFIS_MOTO:
            log(f"Modelo '{nome}' desconhecido — ignorado")
            return False
        p = PERFIS_MOTO[nome]
        self.perfil_nome = nome
        self.vel_max     = p["velocidade_max"]
        self.rpm_max     = p["rpm_max"]
        self.temp_min    = p["temp_motor_min"]
        self.temp_max    = p["temp_motor_max"]
        self.volt_min    = p["voltagem_min"]
        self.volt_max    = p["voltagem_max"]
        self.roll_tipico = p["roll_tipico_max"]
        self.peso        = p["peso_medio"]

        self.th_roll         = p.get("queda_roll_threshold", QUEDA_ROLL_THRESHOLD)
        self.th_pitch        = p.get("queda_pitch_threshold", QUEDA_PITCH_THRESHOLD)
        self.th_g_force      = p.get("queda_g_force", QUEDA_G_FORCE)
        self.th_confirmacao  = p.get("queda_confirmacao_seg", QUEDA_CONFIRMACAO_SEG)
        self.th_rpm_critico  = p.get("rpm_critico", int(self.rpm_max * 0.9))
        self.th_temp_critica = p.get("temp_critica", self.temp_max + 5)
        self.th_volt_critica = p.get("voltagem_critica", VOLTAGEM_CRITICA)

        self.tele.th_roll         = self.th_roll
        self.tele.th_pitch        = self.th_pitch
        self.tele.th_g_force      = self.th_g_force
        self.tele.th_confirmacao  = self.th_confirmacao
        self.tele.th_rpm_critico  = self.th_rpm_critico
        self.tele.th_temp_critica = self.th_temp_critica
        self.tele.th_volt_critica = self.th_volt_critica
        return True

    # ========================================================================
    #  MQTT
    # ========================================================================
    def _connect_mqtt(self):
        log(f"A conectar ao broker MQTT em {MQTT_BROKER}:{MQTT_PORT}…")
        self.mqtt_client = mqtt.Client(
            client_id=DEVICE_ID,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )
        self.mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
        self.mqtt_client.on_connect = self._on_connect
        self.mqtt_client.on_disconnect = self._on_disconnect
        self.mqtt_client.on_message = self._on_message

        # Retry com backoff
        max_retries = 30
        for attempt in range(1, max_retries + 1):
            try:
                self.mqtt_client.connect(MQTT_BROKER, MQTT_PORT, MQTT_KEEPALIVE)
                self.mqtt_client.loop_start()
                return
            except Exception as e:
                wait = min(attempt * 2, 30)
                log(f"Tentativa {attempt}/{max_retries} falhou: {e} — retry em {wait}s")
                time.sleep(wait)

        log("Não foi possível conectar ao broker MQTT — a sair")
        sys.exit(1)

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            self.connected = True
            client.subscribe(MQTT_TOPIC_COMANDO, qos=MQTT_QOS)
            log(f"MQTT conectado — à escuta em '{MQTT_TOPIC_COMANDO}'")
        else:
            log(f"MQTT erro de conexão: {reason_code}")

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):
        self.connected = False
        log("MQTT desconectado — a tentar reconectar…")

    def _on_message(self, client, userdata, msg):
        try:
            dados = json.loads(msg.payload.decode("utf-8"))
        except Exception:
            log(f"Comando inválido (não é JSON): {msg.payload}")
            return

        acao = dados.get("acao", "")
        if acao == "definir_modelo":
            modelo = dados.get("modelo", "")
            log(f"Comando: definir_modelo → '{modelo}'")
            self._aplicar_modelo(modelo)
        elif acao == "evento":
            tipo = dados.get("tipo", "")
            log(f"Comando: evento → '{tipo}'")
            self._aplicar_evento(tipo)
        elif acao == "reset_eventos":
            log("Comando: reset_eventos")
            self.tele.reset_eventos()
        elif acao == "parar":
            log("Comando: parar")
            self.running = False
        else:
            log(f"Comando desconhecido: {acao}")

    # ========================================================================
    #  Processar comandos
    # ========================================================================
    def _aplicar_modelo(self, modelo: str):
        if not self._carregar_perfil(modelo):
            return
        self.tele = TelemetriaState()
        self._carregar_perfil(modelo)
        self.tele._target_vel = random.randint(40, int(self.vel_max * 0.6))
        self._tick_count = 0
        log(f"Perfil '{modelo}' carregado — Vel máx: {self.vel_max} km/h | RPM máx: {self.rpm_max}")

    def _aplicar_evento(self, tipo: str):
        if tipo == "queda":
            self.tele.flag_queda = True
            self.tele._queda_timer = 0
            self.tele._queda_confirmed = False
            log("Evento: QUEDA activada")
        elif tipo == "alternador":
            self.tele.flag_alternador = True
            log("Evento: FALHA ALTERNADOR activada")
        elif tipo == "sobreaquecimento":
            self.tele.flag_sobreaquecimento = True
            log("Evento: SOBREAQUECIMENTO activado")
        else:
            log(f"Tipo de evento desconhecido: {tipo}")

    # ========================================================================
    #  LOOP CENTRAL (idêntico ao simulador GUI)
    # ========================================================================
    def _sim_tick(self):
        self._tick_count += 1
        s = self.tele

        # ── 1. Intenção do motociclista ───────────────────────────────
        if self._tick_count % 8 == 0:
            s._target_vel = clamp(
                s._target_vel + random.uniform(-15, 15),
                20, self.vel_max * 0.7
            )
        if self._tick_count % 4 == 0:
            s._target_yaw = (s._target_yaw + random.uniform(-15, 15)) % 360

        # ── 2. Velocidade e Aceleração ────────────────────────────────
        vel_diff = s._target_vel - s.velocidade
        s._acceleration = clamp(vel_diff * 0.15, -15, 15)
        s.velocidade = lerp(s.velocidade, s._target_vel, LERP_VEL)
        s.velocidade += random.uniform(-0.3, 0.3)
        s.velocidade = clamp(s.velocidade, 0, self.vel_max)

        # ── 3. Throttle e Brakes ─────────────────────────────────────
        if vel_diff > 2:
            s.throttle_pct = clamp(vel_diff * 3 + random.uniform(5, 15), 5, 100)
            s.brake_front_pct = lerp(s.brake_front_pct, 0, 0.5)
            s.brake_rear_pct  = lerp(s.brake_rear_pct, 0, 0.5)
        elif vel_diff < -5:
            s.throttle_pct = lerp(s.throttle_pct, 0, 0.5)
            brake_force = clamp(abs(vel_diff) * 2, 0, 100)
            s.brake_front_pct = lerp(s.brake_front_pct,
                brake_force * random.uniform(0.5, 0.8), 0.4)
            s.brake_rear_pct  = lerp(s.brake_rear_pct,
                brake_force * random.uniform(0.2, 0.5), 0.4)
        else:
            s.throttle_pct = lerp(s.throttle_pct, random.uniform(15, 30), 0.2)
            s.brake_front_pct = lerp(s.brake_front_pct, 0, 0.3)
            s.brake_rear_pct  = lerp(s.brake_rear_pct, 0, 0.3)
        s.throttle_pct    = clamp(s.throttle_pct, 0, 100)
        s.brake_front_pct = clamp(s.brake_front_pct, 0, 100)
        s.brake_rear_pct  = clamp(s.brake_rear_pct, 0, 100)

        # ── 4. Pitch ─────────────────────────────────────────────────
        target_pitch = clamp(s._acceleration * 0.8, -12, 12)
        s.pitch = lerp(s.pitch, target_pitch, LERP_PITCH)
        s.pitch += random.uniform(-0.15, 0.15)
        s.pitch = clamp(s.pitch, -45, 45)

        # ── 5. Roll e Yaw ────────────────────────────────────────────
        yaw_diff = (s._target_yaw - s.yaw + 180) % 360 - 180
        speed_factor = clamp(s.velocidade / 60.0, 0.1, 2.0)
        target_roll = clamp(
            yaw_diff * speed_factor * 0.5,
            -self.roll_tipico, self.roll_tipico
        )
        s.roll = lerp(s.roll, target_roll, LERP_ROLL)
        s.roll += random.uniform(-0.2, 0.2)
        s.roll = clamp(s.roll, -self.roll_tipico * 1.2, self.roll_tipico * 1.2)

        if s.velocidade > 1:
            yaw_rate = s.roll * 0.08 * speed_factor
            s.yaw = (s.yaw + yaw_rate) % 360
        s.yaw += random.uniform(-0.3, 0.3)
        s.yaw = s.yaw % 360

        # ── 6. RPM ───────────────────────────────────────────────────
        target_rpm = (s.velocidade * (self.rpm_max / self.vel_max)
                      + random.uniform(-100, 100))
        s.rpm = lerp(float(s.rpm), target_rpm, LERP_RPM)
        s.rpm += random.uniform(-15, 15)
        s.rpm = clamp(s.rpm, 0, self.rpm_max)

        # ── 7. Temperatura ───────────────────────────────────────────
        target_temp = (self.temp_min
                       + (self.temp_max - self.temp_min)
                       * (s.velocidade / self.vel_max) * 0.9)
        s.temp_motor = lerp(s.temp_motor, target_temp, LERP_TEMP)
        s.temp_motor += random.uniform(-0.1, 0.1)
        s.temp_motor = clamp(s.temp_motor, self.temp_min - 5, self.temp_max + 25)

        # ── 8. Voltagem ──────────────────────────────────────────────
        target_volt = VOLTAGEM_NOMINAL + random.uniform(-0.05, 0.05)
        s.voltagem = lerp(s.voltagem, target_volt, LERP_VOLT)
        s.voltagem += random.uniform(-0.02, 0.02)
        s.voltagem = clamp(s.voltagem, 9.0, self.volt_max)

        # ── 9. Gear e Clutch ─────────────────────────────────────────
        s._prev_gear = s.gear
        if s.velocidade < 1:
            s.gear = 0
            s.clutch_engaged = True
        else:
            gear_ratio = s.velocidade / self.vel_max
            s.gear = max(1, min(6, int(gear_ratio * 6) + 1))
            if s.gear != s._prev_gear and s._prev_gear != 0:
                s._clutch_timer = 2
            if s._clutch_timer > 0:
                s.clutch_engaged = True
                s._clutch_timer -= 1
            else:
                s.clutch_engaged = False

        # ── 10. Odómetro ─────────────────────────────────────────────
        s.odometer_km += s.velocidade / 3600.0

        # ── 11. Segurança ativa ──────────────────────────────────────
        s.abs_active = (s.brake_front_pct > 60 and s.velocidade > 30
                       and random.random() < 0.15)
        s.tc_active = (s.throttle_pct > 70 and s.velocidade > 20
                      and random.random() < 0.10)
        s.side_stand_down = (s.velocidade < 1 and random.random() < 0.05)

        # ── 12. Pressão óleo ─────────────────────────────────────────
        oil_base = 1.5 + (s.rpm / self.rpm_max) * 3.5
        s.oil_pressure_bar = clamp(oil_base + random.uniform(-0.1, 0.1), 0.5, 5.5)

        # ── 13. Pressão pneus ────────────────────────────────────────
        temp_factor = ((s.temp_motor - self.temp_min)
                      / max(1, self.temp_max - self.temp_min))
        s.tire_pressure_front = clamp(
            2.3 + temp_factor * 0.3 + random.uniform(-0.02, 0.02), 1.8, 3.2)
        s.tire_pressure_rear = clamp(
            2.6 + temp_factor * 0.4 + random.uniform(-0.02, 0.02), 2.0, 3.5)

        # ── 14. Luminosidade ─────────────────────────────────────────
        hour_sim = (self._tick_count % 1800) / 1800.0
        lux_base = 500 * math.sin(math.pi * hour_sim) + 50
        s.ambient_light_lux = clamp(lux_base + random.uniform(-20, 20), 0, 1000)

        # ── 15. Efeitos de eventos ───────────────────────────────────
        s.g_force = 0.0

        if s.flag_queda:
            if not s._queda_confirmed:
                if s._queda_timer == 0:
                    s.g_force = round(random.uniform(self.th_g_force, 5.0), 1)
                s._queda_timer += 1
                s.velocidade = lerp(s.velocidade, 0, 0.6)
                s.rpm = lerp(float(s.rpm), 0, 0.6)
                target_crash_roll = self.th_roll if s.roll >= 0 else -self.th_roll
                s.roll = lerp(s.roll, target_crash_roll, 0.5)
                s.throttle_pct = 0
                s.brake_front_pct = 0
                s.brake_rear_pct = 0
                if s._queda_timer >= self.th_confirmacao:
                    s._queda_confirmed = True
            else:
                s.velocidade = lerp(s.velocidade, 0, 0.9)
                s.rpm = lerp(float(s.rpm), 0, 0.9)
                s.gear = 0
                s.throttle_pct = 0
                s.side_stand_down = False

        if s.flag_alternador:
            s.voltagem = max(9.0, s.voltagem - random.uniform(0.15, 0.25))

        if s.flag_sobreaquecimento:
            s.temp_motor = min(self.temp_max + 25, s.temp_motor + random.uniform(1.5, 3.0))
            s.oil_pressure_bar = clamp(s.oil_pressure_bar - 0.05, 0.5, 5.5)

        # ── 16. GPS ──────────────────────────────────────────────────
        if s.velocidade > 1:
            speed_ms = s.velocidade / 3.6
            yaw_rad = math.radians(s.yaw)
            s.lat += (speed_ms * math.cos(yaw_rad)) / 111320.0
            s.lng += (speed_ms * math.sin(yaw_rad)) / (
                111320.0 * math.cos(math.radians(s.lat)))
            s.lat += random.uniform(-0.000002, 0.000002)
            s.lng += random.uniform(-0.000002, 0.000002)

        # ── 17. Arredondar ───────────────────────────────────────────
        vel_out   = round(s.velocidade, 1)
        rpm_out   = int(round(s.rpm))
        temp_out  = round(s.temp_motor, 1)
        volt_out  = round(s.voltagem, 1)
        roll_out  = round(s.roll, 1)
        pitch_out = round(s.pitch, 1)
        yaw_out   = round(s.yaw, 1)
        evento    = s.evento_activo()

        accel_x = pitch_out * 0.02 + random.uniform(-0.05, 0.05)
        accel_y = math.sin(math.radians(roll_out)) + random.uniform(-0.02, 0.02)
        accel_z = math.cos(math.radians(roll_out)) + random.uniform(-0.02, 0.02)

        # ── 18. Payload ──────────────────────────────────────────────
        payload = {
            "device_id": DEVICE_ID,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "modelo": self.perfil_nome,
            "telemetry": {
                "speed_kmh":     vel_out,
                "rpm":           rpm_out,
                "engine_temp_c": temp_out,
                "gear":          s.gear,
                "throttle_pct":  round(s.throttle_pct, 1),
                "clutch_engaged": s.clutch_engaged,
                "brakes": {
                    "front_pct": round(s.brake_front_pct, 1),
                    "rear_pct":  round(s.brake_rear_pct, 1),
                },
                "odometer_km":   round(s.odometer_km, 1),
                "imu": {
                    "roll":    roll_out,
                    "pitch":   pitch_out,
                    "yaw":     yaw_out,
                    "accel_x": round(accel_x, 2),
                    "accel_y": round(accel_y, 2),
                    "accel_z": round(accel_z, 2),
                    "g_force": s.g_force,
                },
            },
            "active_safety": {
                "abs_active":      s.abs_active,
                "tc_active":       s.tc_active,
                "side_stand_down": s.side_stand_down,
            },
            "health": {
                "oil_pressure_bar":  round(s.oil_pressure_bar, 1),
                "battery_voltage":   volt_out,
                "tire_pressure_bar": {
                    "front": round(s.tire_pressure_front, 2),
                    "rear":  round(s.tire_pressure_rear, 2),
                },
            },
            "location": {
                "lat": round(s.lat, 6),
                "lng": round(s.lng, 6),
            },
            "environment": {
                "ambient_light_lux": round(s.ambient_light_lux),
            },
            "system": {
                "status":          evento.lower(),
                "battery_voltage": volt_out,
            },
            "limites_modelo": {
                "velocidade_max":  self.vel_max,
                "rpm_max":         self.rpm_max,
                "temp_max":        self.temp_max,
                "roll_tipico_max": self.roll_tipico,
            },
        }

        return payload

    def _publicar(self, payload: dict):
        json_str = json.dumps(payload)
        try:
            self.mqtt_client.publish(
                MQTT_TOPIC_TELEMETRIA, json_str,
                qos=MQTT_QOS, retain=MQTT_RETAIN
            )
        except Exception as e:
            log(f"Erro ao publicar: {e}")

    # ========================================================================
    #  Arranque
    # ========================================================================
    def run(self):
        log("=" * 60)
        log("  MotoGuard IoT — Simulador Headless")
        log(f"  Broker: {MQTT_BROKER}:{MQTT_PORT}")
        log(f"  Modelo inicial: {self.modelo_inicial}")
        log("=" * 60)

        self._connect_mqtt()

        # Esperar conexão MQTT
        timeout = 30
        while not self.connected and timeout > 0:
            time.sleep(1)
            timeout -= 1
        if not self.connected:
            log("Timeout à espera de conexão MQTT — a sair")
            sys.exit(1)

        # Carregar modelo inicial
        self._aplicar_modelo(self.modelo_inicial)

        # Loop principal
        log(f"A gerar telemetria ({PUBLISH_INTERVAL}s/tick)…")
        while self.running:
            if self.connected and self.perfil_nome:
                payload = self._sim_tick()
                self._publicar(payload)

                # Log resumido a cada 10 ticks
                if self._tick_count % 10 == 0:
                    s = self.tele
                    log(f"tick #{self._tick_count:>5} | "
                        f"{round(s.velocidade)}km/h | "
                        f"{int(s.rpm)}rpm | "
                        f"{round(s.temp_motor,1)}°C | "
                        f"{round(s.voltagem,1)}V | "
                        f"roll {round(s.roll,1)}° | "
                        f"{s.evento_activo()}")

            time.sleep(PUBLISH_INTERVAL)

        # Cleanup
        log("A encerrar…")
        if self.mqtt_client:
            self.mqtt_client.disconnect()
            self.mqtt_client.loop_stop()
        log("Simulador terminado.")


# =============================================================================
#  Ponto de Entrada
# =============================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MotoGuard IoT — Simulador Headless")
    parser.add_argument(
        "--modelo", "-m",
        default=os.environ.get("SIM_MODELO", "Naked"),
        help="Modelo de mota inicial (default: Naked)"
    )
    args = parser.parse_args()

    sim = HeadlessSimulator(modelo=args.modelo)
    sim.run()
