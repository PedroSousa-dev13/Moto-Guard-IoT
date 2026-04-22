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
    PERFIS_MOTO, ROUTE_NAME,
                   )
from routes import RouteCursor, get_route, get_route_between

# ── Constantes de interpolação (suavidade por tick de 1s) ─────────────────────
LERP_VEL   = 0.15
LERP_RPM   = 0.20
LERP_ROLL  = 0.12
LERP_PITCH = 0.18
LERP_TEMP  = 0.03
LERP_VOLT  = 0.08

# Redução progressiva de velocidade perto do destino final (rotas não-loop).
ARRIVAL_SLOWDOWN_START_M = 300.0   # começa a abrandar apenas nos últimos 300m
ARRIVAL_FULL_STOP_M = 8.0
ARRIVAL_MIN_CRUISE_KMH = 6.0


# =============================================================================
#  Funções utilitárias
# =============================================================================
def lerp(current: float, target: float, factor: float) -> float:
    return current + (target - current) * factor


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def lerp_angle_deg(current: float, target: float, factor: float) -> float:
    diff = (target - current + 180) % 360 - 180
    return (current + diff * factor) % 360


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
        self.lat: float = 0.0
        self.lng: float = 0.0

        self.gear: int = 0
        self.throttle_pct: float = 0.0
        self.clutch_engaged: bool = False
        self.brake_front_pct: float = 0.0
        self.brake_rear_pct: float = 0.0
        self.odometer_km: float = 0.0

        self.abs_active: bool = False
        self.tc_active: bool = False

        self.oil_pressure_bar: float = 4.0
        self.tire_pressure_front: float = 2.5
        self.tire_pressure_rear: float = 2.9

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
        self._generation_paused: bool = False  # True após queda confirmada; retoma com reset_eventos/arrancar
        self.route_cursor: RouteCursor | None = None
        self._route_override = False
        self._route_override_waypoints: list[tuple[float, float]] | None = None
        self._route_override_loop: bool = False
        self._startup_phase: bool = False  # True durante a fase de arranque suave
        self._startup_tick: int = 0

        # Limites do perfil
        self.vel_max = 200
        self.rpm_max = 12000
        self.temp_min = 70.0
        self.temp_max = 105.0
        self.volt_min = 11.5
        self.volt_max = 14.5
        self.roll_tipico = 40.0
        self.peso = 190
        self.oil_idle = 1.5
        self.oil_max = 5.0
        self.tire_front_base = 2.3
        self.tire_rear_base = 2.6
        self.accel_max       = 12.0
        self.brake_max       = 18.0
        self.cruise_min      = 40.0
        self.cruise_max_frac = 0.70
        self.throttle_resp   = 0.35
        self.temp_idle_off   = 8.0
        self.th_roll = QUEDA_ROLL_THRESHOLD
        self.th_pitch = QUEDA_PITCH_THRESHOLD
        self.th_g_force = QUEDA_G_FORCE
        self.th_confirmacao = QUEDA_CONFIRMACAO_SEG
        self.th_rpm_critico = 11000
        self.th_temp_critica = 110.0
        self.th_volt_critica = VOLTAGEM_CRITICA

        # Modelo inicial
        self.modelo_inicial = modelo
        self.moto_model_display: str | None = None
        self.current_device_id: str = DEVICE_ID
        self._tick_interval: float = float(PUBLISH_INTERVAL)  # pode ser alterado por set_speed
        self._excesso_ticks: int = 0  # ticks restantes de excesso de velocidade forçado

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

        self.oil_idle        = p.get("oil_pressure_idle_bar", 1.5)
        self.oil_max         = p.get("oil_pressure_max_bar", 5.0)
        self.tire_front_base = p.get("tire_pressure_front_bar", 2.3)
        self.tire_rear_base  = p.get("tire_pressure_rear_bar", 2.6)

        # Parâmetros comportamentais — diferenciam cada tipo de mota
        self.accel_max       = p.get("accel_max_kmhs", 12.0)    # km/h/s aceleração máxima
        self.brake_max       = p.get("brake_max_kmhs", 18.0)    # km/h/s travagem máxima
        self.cruise_min      = p.get("cruise_min_kmh", 40.0)    # velocidade mínima de cruzeiro
        self.cruise_max_frac = p.get("cruise_max_frac", 0.70)   # % de vel_max como teto
        self.throttle_resp   = p.get("throttle_response", 0.35) # LERP do acelerador
        self.temp_idle_off   = p.get("temp_idle_offset", 8.0)   # °C acima de temp_min em marcha lenta

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

        # Temperatura inicial = marcha lenta do perfil (motor já ligado)
        self.tele.temp_motor = self.temp_min + self.temp_idle_off

        if self._route_override and self._route_override_waypoints:
            self.route_cursor = RouteCursor(self._route_override_waypoints, close_loop=self._route_override_loop)
        else:
            self.route_cursor = None
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

        target_id = dados.get("device_id")
        if target_id and target_id != self.current_device_id and target_id != DEVICE_ID:
            return

        acao_raw = dados.get("acao", "")
        acao = str(acao_raw).strip().lower()
        if acao == "definir_modelo":
            modelo = dados.get("modelo", "")
            nome = dados.get("motorcycleName", "")
            dev_id = dados.get("new_device_id")
            log(f"Comando: definir_modelo → '{modelo}' (Nome: '{nome}', Novo ID: '{dev_id}')")
            self._aplicar_modelo(modelo, nome, dev_id)
        elif acao == "evento":
            tipo = dados.get("tipo", "")
            log(f"Comando: evento → '{tipo}'")
            self._aplicar_evento(tipo)
        elif acao == "reset_eventos":
            log("Comando: reset_eventos")
            self.tele.reset_eventos()
            self._excesso_ticks = 0
            if self._generation_paused:
                self._generation_paused = False
                log(f"Geração retomada após reset_eventos — modelo '{self.perfil_nome}'.")
        elif acao == "arrancar":
            log("Comando: arrancar")
            if self.perfil_nome and self._generation_paused:
                self.tele.reset_eventos()
                self._generation_paused = False
                log(f"Geração retomada — modelo '{self.perfil_nome}'.")
            elif not self.perfil_nome:
                log("Arrancar: sem modelo activo — usa 'definir_modelo' primeiro.")
            else:
                log("Arrancar: geração já activa.")
        elif acao == "parar":
            log("Comando: parar — simulador a ficar inactivo (aguarda novo 'definir_modelo')")
            self._clear_simulator_state()
        elif acao in ("definir_rota", "set_route", "set-rota"):
            route = dados.get("route") or {}
            start = route.get("start") or {}
            end = route.get("end") or {}
            start_lat = start.get("latitude")
            start_lng = start.get("longitude")
            end_lat = end.get("latitude")
            end_lng = end.get("longitude")
            loop = bool(route.get("loop", False))
            if not all(isinstance(v, (int, float)) for v in (start_lat, start_lng, end_lat, end_lng)):
                log("Comando: definir_rota inválido — faltam coordenadas (latitude/longitude)")
                return
            wps = get_route_between((float(start_lat), float(start_lng)), (float(end_lat), float(end_lng)))
            self.route_cursor = RouteCursor(wps, close_loop=loop)
            self.route_cursor.reset(0)
            start_point = self.route_cursor.waypoints[0]
            self.tele.lat = start_point[0]
            self.tele.lng = start_point[1]
            self._route_override = True
            self._route_override_waypoints = wps
            self._route_override_loop = loop
            log(f"Comando: definir_rota → start=({start_lat:.6f},{start_lng:.6f}) end=({end_lat:.6f},{end_lng:.6f}) loop={'on' if loop else 'off'}")
        elif acao in ("reset_rota", "clear_route", "clear-rota"):
            self._route_override = False
            self._route_override_waypoints = None
            self._route_override_loop = False
            self.route_cursor = None
            self.tele._target_vel = 0.0
            self.tele.velocidade = 0.0
            log("Comando: reset_rota")
        elif acao in ("set_speed", "set-speed"):
            mult = dados.get("multiplier", 1)
            try:
                mult = float(mult)
            except (TypeError, ValueError):
                mult = 1.0
            mult = max(0.1, min(mult, 20.0))
            self._tick_interval = PUBLISH_INTERVAL / mult
            log(f"Comando: set_speed → {mult}x (intervalo={self._tick_interval:.3f}s)")
        elif acao in ("set_speeding", "set-speeding"):
            active = bool(dados.get("active", False))
            if active:
                self._excesso_ticks = 9999  # ativo indefinidamente até desligar
                log("Comando: set_speeding → ON (excesso de velocidade forçado)")
            else:
                self._excesso_ticks = 0
                # Repor velocidade alvo para o limite legal da estrada atual
                if self.route_cursor:
                    legal = self.route_cursor.speed_limit_kmh() or 50.0
                    self.tele._target_vel = legal * random.uniform(0.90, 1.00)
                    log(f"Comando: set_speeding → OFF (velocidade reposta para {self.tele._target_vel:.1f} km/h)")
                else:
                    log("Comando: set_speeding → OFF (velocidade normalizada)")
        else:
            log(f"Comando desconhecido: {acao} (raw={acao_raw!r})")

    # ========================================================================
    #  Processar comandos
    # ========================================================================
    def _aplicar_modelo(self, modelo: str, nome: str = None, device_id: str = None):
        if not self._carregar_perfil(modelo):
            return
        self._generation_paused = False
        self.moto_model_display = nome
        if device_id:
            self.current_device_id = device_id
        
        # Preservar rota customizada durante reset
        rota_salva = self._route_override_waypoints
        loop_salvo = self._route_override_loop
        override_salvo = self._route_override
        
        self.tele = TelemetriaState()
        self._carregar_perfil(modelo)  # re-propagar thresholds após reset
        
        # Restaurar rota customizada se existia
        if override_salvo and rota_salva:
            self._route_override = override_salvo
            self._route_override_waypoints = rota_salva
            self._route_override_loop = loop_salvo
            self.route_cursor = RouteCursor(rota_salva, close_loop=loop_salvo)

        if self._route_override and self._route_override_waypoints:
            self.route_cursor = RouteCursor(self._route_override_waypoints, close_loop=self._route_override_loop)
        else:
            self.route_cursor = None

        if self.route_cursor is not None:
            self.route_cursor.reset(0)
            rota_start = self.route_cursor.waypoints[0]
            self.tele.lat = rota_start[0]
            self.tele.lng = rota_start[1]

        self.tele._target_vel = 0.0   # arranca parado — acelera organicamente
        self._tick_count = 0
        self._startup_phase = True    # flag para fase de arranque suave
        self._startup_tick = 0
        log(f"Perfil '{modelo}' carregado — Vel máx: {self.vel_max} km/h | RPM máx: {self.rpm_max}")
        if self.route_cursor is None:
            log("Modelo carregado — aguarda rota do mapa")
        else:
            log(f"A gerar telemetria ({PUBLISH_INTERVAL}s/tick)…")

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
        elif tipo in ("excesso_velocidade", "speeding"):
            self._excesso_ticks = 20  # ~20 ticks a 1x = 20s de excesso
            log("Evento: EXCESSO DE VELOCIDADE activado (20 ticks)")
        else:
            log(f"Tipo de evento desconhecido: {tipo}")

    def _clear_simulator_state(self):
        self.perfil_nome = None
        self._generation_paused = False
        self.tele = TelemetriaState()
        self._tick_count = 0
        self._route_override = False
        self._route_override_waypoints = None
        self._route_override_loop = False
        self.route_cursor = None
        self._tick_interval = float(PUBLISH_INTERVAL)  # reset velocidade
        self._excesso_ticks = 0

    def _arrival_speed_cap_kmh(self) -> float | None:
        if self.route_cursor is None:
            return None
        dist_to_end_m = self.route_cursor.distance_to_end_m()
        if dist_to_end_m is None:
            return None
        if dist_to_end_m <= ARRIVAL_FULL_STOP_M:
            return 0.0
        if dist_to_end_m >= ARRIVAL_SLOWDOWN_START_M:
            return None

        ratio = (dist_to_end_m - ARRIVAL_FULL_STOP_M) / (ARRIVAL_SLOWDOWN_START_M - ARRIVAL_FULL_STOP_M)
        ratio = clamp(ratio, 0.0, 1.0)
        max_approach_kmh = min(self.vel_max * 0.35, 60.0)
        return ARRIVAL_MIN_CRUISE_KMH + (max_approach_kmh - ARRIVAL_MIN_CRUISE_KMH) * (ratio ** 1.35)

    # ========================================================================
    #  LOOP CENTRAL (idêntico ao simulador GUI)
    # ========================================================================
    def _sim_tick(self):
        self._tick_count += 1
        s = self.tele

        # ── 0. Fase de arranque — aceleração orgânica desde 0 ────────────
        # Simula: marcha lenta → embraiagem → 1ª mudança → aceleração suave
        # Fase 1 (ticks 1-3):   mota parada, motor a aquecer em marcha lenta
        # Fase 2 (ticks 4-8):   embraiagem, começa a mover-se muito devagar (0→5 km/h)
        # Fase 3 (ticks 9-20):  aceleração suave em 1ª/2ª (5→30 km/h)
        # Fase 4 (tick 21+):    entrega ao controlador normal de velocidade
        if self._startup_phase:
            self._startup_tick += 1
            t = self._startup_tick
            if t <= 3:
                # Parado — motor em marcha lenta
                s._target_vel = 0.0
            elif t <= 8:
                # Embraiagem — arranque muito suave
                s._target_vel = (t - 3) * 1.0   # 0 → 5 km/h ao longo de 5 ticks
            elif t <= 20:
                # Aceleração progressiva em 1ª/2ª mudança
                s._target_vel = 5.0 + (t - 8) * 2.5   # 5 → 35 km/h ao longo de 12 ticks
            else:
                # Entregar ao controlador normal — aponta para o limite legal da rota
                legal_now = (self.route_cursor.speed_limit_kmh()
                             if self.route_cursor else None) or self.cruise_min
                s._target_vel = clamp(legal_now * random.uniform(0.90, 1.00),
                                      self.cruise_min, self.vel_max * self.cruise_max_frac)
                self._startup_phase = False

        # ── 1. Intenção do motociclista (guiada pela rota) ────────────────
        #  Velocidade alvo: ajuste suave a cada 8s + limites de curva
        #  Durante a fase de arranque, o step 0 controla _target_vel — não interferir
        if self.route_cursor is None:
            if not self._startup_phase:
                s._target_vel = 0.0
            s._target_yaw = s.yaw
        else:
            if not self._startup_phase:
                if self._tick_count % 8 == 0:
                    # Velocidade de cruzeiro baseada no limite legal da estrada atual
                    # Motociclista realista: circula perto do limite ± variação natural
                    legal_now = (self.route_cursor.speed_limit_kmh()
                                 if self.route_cursor else None) or self.cruise_min
                    # Cruzeiro entre 90% e 105% do limite (simula condução normal sem trânsito)
                    cruise_target = legal_now * random.uniform(0.90, 1.05)
                    cruise_target = clamp(cruise_target, self.cruise_min, self.vel_max * self.cruise_max_frac)
                    # Ajuste suave para não mudar bruscamente
                    s._target_vel = lerp(s._target_vel, cruise_target, 0.3)
            s._target_yaw = self.route_cursor.bearing_deg()
            speed_limit = self.route_cursor.speed_limit_kmh(steps=12)
            if speed_limit is not None and self._excesso_ticks <= 0:
                # Respeitar limite legal apenas quando NÃO há excesso forçado
                if speed_limit < s._target_vel:
                    s._target_vel = lerp(s._target_vel, speed_limit, 0.35)
                else:
                    s._target_vel = min(s._target_vel, speed_limit)

            arrival_speed_cap = self._arrival_speed_cap_kmh()
            if arrival_speed_cap is not None and self._excesso_ticks <= 0:
                # Ignorar arrival cap durante excesso — queremos ultrapassar
                if arrival_speed_cap < s._target_vel:
                    dist_to_end_m = self.route_cursor.distance_to_end_m() or 0.0
                    closeness = clamp(1.0 - (dist_to_end_m / ARRIVAL_SLOWDOWN_START_M), 0.0, 1.0)
                    factor = clamp(0.12 + closeness * 0.55, 0.12, 0.80)
                    s._target_vel = lerp(s._target_vel, arrival_speed_cap, factor)
                else:
                    s._target_vel = min(s._target_vel, arrival_speed_cap)

            if self.route_cursor.finished:
                s._target_vel = 0.0

        # ── 2. Velocidade e Aceleração ────────────────────────────────
        vel_diff = s._target_vel - s.velocidade
        # Durante arranque: aceleração máxima muito suave (como embraiagem real)
        accel_cap = 3.0 if self._startup_phase else self.accel_max
        brake_cap = self.brake_max
        s._acceleration = clamp(vel_diff * 0.22, -brake_cap, accel_cap)
        s.velocidade = clamp(s.velocidade + s._acceleration, 0, self.vel_max)

        # ── 2b. Excesso de velocidade forçado ─────────────────────────
        # Incrementa progressivamente a partir da velocidade atual até ultrapassar o limite.
        # A velocidade já devia estar perto do limite (cruzeiro normal), por isso
        # o incremento é suave mas constante enquanto o botão está pressionado.
        if self._excesso_ticks > 0 and not self._startup_phase:
            legal = (self.route_cursor.speed_limit_kmh()
                     if self.route_cursor else 50.0) or 50.0
            # Alvo: 30-40% acima do limite (suficiente para disparar CRITICAL no heuristics)
            target_excesso = legal * 1.35
            # Incremento por tick: ~3-5 km/h/s — sobe visivelmente mas não instantâneo
            increment = min(self.accel_max * 1.8, 25.0)
            if s.velocidade < target_excesso:
                s.velocidade = min(s.velocidade + increment, target_excesso)
            s._target_vel = target_excesso
            s.throttle_pct = clamp(lerp(s.throttle_pct, 100.0, 0.4), 0, 100)
            s.brake_front_pct = lerp(s.brake_front_pct, 0, 0.5)
            s.brake_rear_pct = lerp(s.brake_rear_pct, 0, 0.5)

        # ── 3. Throttle e Brakes ─────────────────────────────────────
        if vel_diff > 1.5:
            s.throttle_pct = clamp(lerp(s.throttle_pct, clamp(vel_diff * 5.0, 18, 100), self.throttle_resp), 0, 100)
            s.brake_front_pct = lerp(s.brake_front_pct, 0, 0.6)
            s.brake_rear_pct  = lerp(s.brake_rear_pct, 0, 0.6)
        elif vel_diff < -1.5:
            s.throttle_pct = lerp(s.throttle_pct, 0, 0.6)
            brake_force = clamp(abs(vel_diff) * 6.0, 0, 100)
            s.brake_front_pct = lerp(s.brake_front_pct, brake_force * 0.75, 0.45)
            s.brake_rear_pct  = lerp(s.brake_rear_pct, brake_force * 0.35, 0.45)
        else:
            cruise = clamp(12 + (s.velocidade / max(1, self.vel_max)) * 18, 10, 35)
            s.throttle_pct = lerp(s.throttle_pct, cruise, self.throttle_resp * 0.5)
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

        # ── 7. Temperatura ───────────────────────────────────────────
        # Em marcha lenta: temp_min + offset do perfil (motor a ar aquece mais)
        # Em movimento: sobe até temp_max proporcional à velocidade
        temp_idle = self.temp_min + self.temp_idle_off
        target_temp = temp_idle + (self.temp_max - temp_idle) * (s.velocidade / self.vel_max) * 0.9
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
            # Gear selection: profile-aware speed bands (% of vel_max)
            # Escalas adaptadas a cada tipo de mota em vez de valores absolutos
            spd_pct = s.velocidade / self.vel_max if self.vel_max > 0 else 0
            
            # Percentagens de vel_max para cada marcha:
            # Gear 1: 0-15%, Gear 2: 15-35%, Gear 3: 35-60%, 
            # Gear 4: 60-75%, Gear 5: 75-90%, Gear 6: 90%+
            if spd_pct <= 0.15:
                s.gear = 1
            elif spd_pct <= 0.35:
                s.gear = 2
            elif spd_pct <= 0.60:
                s.gear = 3
            elif spd_pct <= 0.75:
                s.gear = 4
            elif spd_pct <= 0.90:
                s.gear = 5
            else:
                s.gear = 6
            
            if s.gear != s._prev_gear and s._prev_gear != 0:
                s._clutch_timer = 2
            if s._clutch_timer > 0:
                s.clutch_engaged = True
                s._clutch_timer -= 1
            else:
                s.clutch_engaged = False

        idle_rpm = max(900, int(self.rpm_max * 0.08))
        if s.gear <= 0 or s.velocidade < 1:
            # Marcha lenta: RPM base + contribuição do acelerador
            target_rpm = idle_rpm + s.throttle_pct * 6
        else:
            # Velocidade máxima de cada mudança antes de mudar (% de vel_max)
            redline_speeds = { 1: 0.20, 2: 0.34, 3: 0.52, 4: 0.70, 5: 0.86, 6: 1.00 }
            red_speed = max(1.0, self.vel_max * redline_speeds.get(s.gear, 1.0))
            ratio = clamp(s.velocidade / red_speed, 0.0, 1.0)
            # Curva quadrática: RPM sobe devagar a baixas velocidades,
            # acelera perto do redline — mais realista que linear
            rpm_range = self.rpm_max * 0.82 - idle_rpm
            target_rpm = idle_rpm + rpm_range * (ratio ** 1.8)
            if s.clutch_engaged:
                target_rpm = max(idle_rpm, target_rpm - 800)
        s.rpm = lerp(float(s.rpm), target_rpm, LERP_RPM)
        s.rpm += random.uniform(-20, 20)
        s.rpm = clamp(s.rpm, 0, self.rpm_max)

        # ── 10. Odómetro ─────────────────────────────────────────────
        s.odometer_km += s.velocidade / 3600.0

        # ── 11. Segurança ativa ──────────────────────────────────────
        s.abs_active = (s.brake_front_pct > 60 and s.velocidade > 30
                       and random.random() < 0.15)
        s.tc_active = (s.throttle_pct > 70 and s.velocidade > 20
                      and random.random() < 0.10)

        # ── 12. Pressão óleo (específica por perfil) ──────────────────────────
        oil_base = self.oil_idle + (s.rpm / self.rpm_max) * (self.oil_max - self.oil_idle)
        s.oil_pressure_bar = clamp(oil_base + random.uniform(-0.1, 0.1),
                                   self.oil_idle * 0.5, self.oil_max * 1.1)

        # ── 13. Pressão pneus (base específica por perfil + calor) ───────────
        temp_factor = ((s.temp_motor - self.temp_min)
                      / max(1, self.temp_max - self.temp_min))
        target_tire_front = self.tire_front_base + temp_factor * self.tire_front_base * 0.08
        target_tire_rear = self.tire_rear_base + temp_factor * self.tire_rear_base * 0.10
        s.tire_pressure_front = lerp(s.tire_pressure_front, target_tire_front, 0.06)
        s.tire_pressure_rear = lerp(s.tire_pressure_rear, target_tire_rear, 0.06)
        s.tire_pressure_front += random.uniform(-0.003, 0.003)
        s.tire_pressure_rear += random.uniform(-0.003, 0.003)
        s.tire_pressure_front = clamp(s.tire_pressure_front, self.tire_front_base * 0.90, self.tire_front_base * 1.15)
        s.tire_pressure_rear = clamp(s.tire_pressure_rear, self.tire_rear_base * 0.90, self.tire_rear_base * 1.15)

        # ── 14. G-Force física ───────────────────────────────────────
        # Física real de uma mota em curva:
        #   Em equilíbrio: tan(roll) = v² / (r·g)  →  G_lateral = tan(roll)
        # G longitudinal: derivado da aceleração/travagem (km/h/s → m/s² → G)
        if not s.flag_queda:
            g_lateral = abs(math.tan(math.radians(clamp(s.roll, -80, 80))))
            g_lateral = clamp(g_lateral, 0.0, 2.5)

            accel_ms2 = s._acceleration / 3.6      # km/h/s → m/s²
            g_longitudinal = clamp(abs(accel_ms2) / 9.81, 0.0, 1.5)

            # Resultante vetorial com componente vertical (gravidade = 1G)
            g_combined = math.sqrt(1.0 + g_lateral**2 + g_longitudinal**2)
            s.g_force = round(clamp(g_combined + random.uniform(-0.03, 0.03), 0.95, 3.5), 2)

        # ── 14b. Queda automática em curva a alta velocidade ─────────
        # Se em excesso de velocidade E numa curva apertada, a física dita queda.
        # Condição: roll > 85% do threshold de queda do perfil durante excesso.
        if (self._excesso_ticks > 0
                and not s.flag_queda
                and not s._queda_confirmed
                and s.velocidade > 30):
            roll_abs = abs(s.roll)
            # Quanto mais rápido acima do limite, menor o roll necessário para cair
            legal = (self.route_cursor.speed_limit_kmh()
                     if self.route_cursor else 50.0) or 50.0
            speed_excess_ratio = s.velocidade / max(legal, 1.0)  # ex: 1.45 = 45% acima
            # Threshold dinâmico: a 1.45x o limite, cai com 70% do roll normal
            dynamic_threshold = self.th_roll * max(0.55, 1.5 - speed_excess_ratio * 0.65)
            if roll_abs > dynamic_threshold:
                s.flag_queda = True
                s._queda_timer = 0
                s._queda_confirmed = False
                self._excesso_ticks = 0  # parar excesso imediatamente
                log(f"QUEDA por excesso em curva: vel={s.velocidade:.0f}km/h "
                    f"roll={roll_abs:.1f}° threshold={dynamic_threshold:.1f}° "
                    f"(limite={legal:.0f}km/h)")

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
                s.tc_active = False          # sem acelerador durante queda
                if s._queda_timer >= self.th_confirmacao:
                    s._queda_confirmed = True
            else:
                # Mota no chão — estado congelado até reset
                s.velocidade = lerp(s.velocidade, 0, 0.9)
                s.rpm = lerp(float(s.rpm), 0, 0.9)
                s.gear = 0
                s.throttle_pct = 0
                s.roll = self.th_roll if s.roll >= 0 else -self.th_roll
                s.g_force = round(random.uniform(0.1, 0.4), 2)  # mota no chão — G baixo
                s.oil_pressure_bar = max(0.0, lerp(s.oil_pressure_bar, 0.0, 0.5))
                s.abs_active = False
                s.tc_active = False

        if s.flag_alternador:
            s.voltagem = max(9.0, s.voltagem - random.uniform(0.15, 0.25))

        if s.flag_sobreaquecimento:
            s.temp_motor = min(self.temp_max + 25, s.temp_motor + random.uniform(1.5, 3.0))
            s.oil_pressure_bar = clamp(s.oil_pressure_bar - 0.05, 0.5, 5.5)

        # ── 15. GPS ──────────────────────────────────────────────────
        if self.route_cursor is not None:
            # Continuar a mover-se mesmo a baixa velocidade para conseguir chegar ao fim
            if s.velocidade > 0.1:
                speed_ms = s.velocidade / 3.6
                dist_m = speed_ms * PUBLISH_INTERVAL
                lat, lng, bearing = self.route_cursor.step(dist_m)
                s.lat = lat
                s.lng = lng
                s._target_yaw = bearing
                s.yaw = lerp_angle_deg(s.yaw, bearing, 0.35)
            
            # Se estivermos muito perto do fim (menos de 5m) e quase parados, forçamos o fim
            dist_end = self.route_cursor.distance_to_end_m()
            if dist_end is not None and dist_end < 5.0 and s.velocidade < 2.0:
                self.route_cursor.step(dist_end) # isto vai pôr _finished = True
                log("Snap ao destino final (dist < 5m)")

            if self.route_cursor.finished:
                s._target_vel = 0.0

        # ── 16. Arredondar ───────────────────────────────────────────
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

        # ── 17. Payload ──────────────────────────────────────────────
        # Estrutura alinhada com o contrato do backend (telemetry.model.ts)
        payload = {
            "telemetry": {
                "speed_kmh":       vel_out,
                "rpm":             rpm_out,
                "engine_temp_c":   temp_out,
                "gear":            s.gear,
                "throttle_pct":    round(s.throttle_pct, 1),
                "voltage":         volt_out,
                "brake_front_pct": round(s.brake_front_pct, 1),
                "brake_rear_pct":  round(s.brake_rear_pct, 1),
                "odometer_km":     round(s.odometer_km, 1),
                "clutch_engaged":  s.clutch_engaged,
            },
            "imu": {
                "roll_deg":  roll_out,
                "pitch_deg": pitch_out,
                "yaw_deg":   yaw_out,
                "g_force":   s.g_force,
            },
            "active_safety": {
                "abs_active":      s.abs_active,
                "tc_active":       s.tc_active,
            },
            "health": {
                "oil_pressure_bar":        round(s.oil_pressure_bar, 1),
                "tire_pressure_front_bar": round(s.tire_pressure_front, 2),
                "tire_pressure_rear_bar":  round(s.tire_pressure_rear, 2),
            },
            "location": {
                "latitude":  round(s.lat, 6),
                "longitude": round(s.lng, 6),
            },
            "system": {
                "device_id":       self.current_device_id,
                "moto_model":      self.moto_model_display or self.perfil_nome,
                "event_status":    evento,
                "tick":            self._tick_count,
                "timestamp":       datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "speed_limit_kmh": self.route_cursor.speed_limit_kmh() if self.route_cursor else 50.0,
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

        # Não arranca automaticamente — aguarda comando 'definir_modelo' do frontend
        log("Simulador idle — à espera do comando 'definir_modelo' do frontend...")

        # Loop principal
        while self.running:
            if self.connected and self.perfil_nome and (self.route_cursor is not None) and not self._generation_paused:
                payload = self._sim_tick()
                self._publicar(payload)

                # Detectar queda confirmada — parar geração e aguardar reset explícito
                if self.tele._queda_confirmed:
                    self._generation_paused = True
                    s = self.tele
                    s.velocidade = 0.0
                    s.rpm = 0.0
                    s.gear = 0
                    s.throttle_pct = 0.0
                    s.brake_front_pct = 0.0
                    s.brake_rear_pct = 0.0
                    s._target_vel = 0.0
                    log("QUEDA CONFIRMADA — geração de dados parada. "
                        "Aguarda 'reset_eventos' ou 'arrancar' para retomar.")

                # Detectar fim de rota e paragem total
                if self.route_cursor and self.route_cursor.finished and self.tele.velocidade < 0.1:
                    if not hasattr(self, '_stop_countdown'): self._stop_countdown = 15
                    self._stop_countdown -= 1
                    if self._stop_countdown <= 0:
                        self._generation_paused = True
                        delattr(self, '_stop_countdown')
                        log("FIM DE ROTA ALCANÇADO E VEÍCULO PARADO — simulador em pausa.")
                    else:
                        if self._stop_countdown % 5 == 0:
                            log(f"A aguardar paragem total para fechar viagem... ({self._stop_countdown} ticks)")

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

            time.sleep(self._tick_interval)

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

