# =============================================================================
# MotoGuard IoT — Gerador de Telemetria em Tempo Real
# =============================================================================
#  FOCO: Geração de dados de telemetria simulados.
#
#  Arquitectura:
#    1. Liga-se ao broker MQTT automaticamente ao arrancar
#    2. Subscreve o tópico de COMANDO (motoguard/comando)
#    3. Quando a app principal envia o modelo de mota, carrega o perfil
#       e começa a gerar dados automaticamente
#    4. Publica telemetria no tópico motoguard/telemetria a cada segundo
#
#  Comandos aceites (JSON no tópico motoguard/comando):
#    {"acao": "definir_modelo", "modelo": "Naked"}
#    {"acao": "evento", "tipo": "queda" | "alternador" | "sobreaquecimento"}
#    {"acao": "reset_eventos"}
#    {"acao": "parar"}
#
#  Mini-GUI: janela de debug com estado, valores em tempo real e log.
# =============================================================================

import customtkinter as ctk
import paho.mqtt.client as mqtt
import json
import math
import random
import time
import threading
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
from routes import RouteFollower, ROTAS, ROTA_PADRAO

# ── Tema ──────────────────────────────────────────────────────────────────────
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

FONT_TITLE  = ("Segoe UI", 16, "bold")
FONT_NORMAL = ("Segoe UI", 12)
FONT_BOLD   = ("Segoe UI", 12, "bold")
FONT_MONO   = ("Consolas", 11)

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
    """Interpolação linear: move current em direcção a target."""
    return current + (target - current) * factor


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# =============================================================================
#  Estado de Telemetria (objecto mutável — persiste entre ticks)
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

        # Novas variáveis de telemetria
        self.gear: int = 0                        # mudança engrenada (0 = neutro)
        self.throttle_pct: float = 0.0            # posição do acelerador (%)
        self.clutch_engaged: bool = False          # embraiagem puxada
        self.brake_front_pct: float = 0.0         # travão dianteiro (%)
        self.brake_rear_pct: float = 0.0          # travão traseiro (%)
        self.odometer_km: float = 0.0             # quilometragem acumulada

        # Segurança ativa
        self.abs_active: bool = False
        self.tc_active: bool = False
        self.side_stand_down: bool = False

        # Saúde do veículo
        self.oil_pressure_bar: float = 4.0
        self.tire_pressure_front: float = 2.5
        self.tire_pressure_rear: float = 2.9

        # Alvos internos (interpolação suave)
        self._target_vel: float = 0.0
        self._target_yaw: float = 0.0

        # Dinâmica interna
        self._acceleration: float = 0.0       # aceleração atual (km/h por tick)
        self._clutch_timer: int = 0           # ticks restantes com embraiagem puxada
        self._prev_gear: int = 0              # mudança anterior (para detetar troca)

        # Flags de eventos
        self.flag_queda: bool = False
        self.flag_alternador: bool = False
        self.flag_sobreaquecimento: bool = False

        # Confirmação de queda
        self._queda_timer: int = 0
        self._queda_confirmed: bool = False

        # Thresholds activos (preenchidos pelo perfil)
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
#  Classe Principal — Gerador com Mini-GUI de Debug
# =============================================================================
class MotoGuardGenerator(ctk.CTk):

    def __init__(self):
        super().__init__()
        self.title("MotoGuard IoT — Gerador de Telemetria")
        self.geometry("720x700")
        self.resizable(False, False)

        # MQTT
        self.mqtt_client: mqtt.Client | None = None
        self.connected = False

        # Estado
        self.tele = TelemetriaState()
        self.perfil_nome: str | None = None
        self._tick_count = 0
        self._sim_running = False
        self._sim_thread: threading.Thread | None = None
        self.route_follower: RouteFollower = RouteFollower(
            ROTAS.get(ROUTE_NAME, ROTAS[ROTA_PADRAO])
        )

        # Limites do perfil activo (preenchidos por _carregar_perfil)
        self.vel_max = 200
        self.rpm_max = 12000
        self.temp_min = 70.0
        self.temp_max = 105.0
        self.volt_min = 11.5
        self.volt_max = 14.5
        self.roll_tipico = 40.0
        self.peso = 190
        self.oil_idle = 1.5           # pressão óleo em marcha lenta (bar)
        self.oil_max = 5.0            # pressão óleo a RPM máximo (bar)
        self.tire_front_base = 2.3    # pressão base pneu dianteiro (bar)
        self.tire_rear_base = 2.6     # pressão base pneu traseiro (bar)
        self.th_roll = QUEDA_ROLL_THRESHOLD
        self.th_pitch = QUEDA_PITCH_THRESHOLD
        self.th_g_force = QUEDA_G_FORCE
        self.th_confirmacao = QUEDA_CONFIRMACAO_SEG
        self.th_rpm_critico = 11000
        self.th_temp_critica = 110.0
        self.th_volt_critica = VOLTAGEM_CRITICA

        # UI
        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_closing)

        # Auto-conectar ao arrancar
        self.after(500, self._auto_connect)

    # ========================================================================
    #  Perfil
    # ========================================================================
    def _carregar_perfil(self, nome: str):
        if nome not in PERFIS_MOTO:
            self._log(f"Modelo '{nome}' desconhecido — ignorado")
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

        self.th_roll         = p.get("queda_roll_threshold", QUEDA_ROLL_THRESHOLD)
        self.th_pitch        = p.get("queda_pitch_threshold", QUEDA_PITCH_THRESHOLD)
        self.th_g_force      = p.get("queda_g_force", QUEDA_G_FORCE)
        self.th_confirmacao  = p.get("queda_confirmacao_seg", QUEDA_CONFIRMACAO_SEG)
        self.th_rpm_critico  = p.get("rpm_critico", int(self.rpm_max * 0.9))
        self.th_temp_critica = p.get("temp_critica", self.temp_max + 5)
        self.th_volt_critica = p.get("voltagem_critica", VOLTAGEM_CRITICA)

        # Propagar para TelemetriaState
        self.tele.th_roll         = self.th_roll
        self.tele.th_pitch        = self.th_pitch
        self.tele.th_g_force      = self.th_g_force
        self.tele.th_confirmacao  = self.th_confirmacao
        self.tele.th_rpm_critico  = self.th_rpm_critico
        self.tele.th_temp_critica = self.th_temp_critica
        self.tele.th_volt_critica = self.th_volt_critica

        # Re-inicializar seguidor de rota ao carregar novo perfil
        rota = ROTAS.get(ROUTE_NAME, ROTAS[ROTA_PADRAO])
        self.route_follower = RouteFollower(rota)
        return True

    # ========================================================================
    #  Mini-GUI de Debug
    # ========================================================================
    def _build_ui(self):
        # ── Título ──
        ctk.CTkLabel(self, text="MotoGuard IoT — Gerador de Telemetria",
                     font=("Segoe UI", 18, "bold")).pack(pady=(10, 5))

        # ── Barra de Estado ──
        status_frame = ctk.CTkFrame(self)
        status_frame.pack(padx=15, pady=5, fill="x")

        row1 = ctk.CTkFrame(status_frame, fg_color="transparent")
        row1.pack(fill="x", padx=10, pady=5)
        ctk.CTkLabel(row1, text="MQTT:", font=FONT_BOLD, width=60).pack(side="left")
        self.lbl_mqtt = ctk.CTkLabel(row1, text="A conectar…", font=FONT_NORMAL, text_color="yellow")
        self.lbl_mqtt.pack(side="left", padx=5)
        ctk.CTkLabel(row1, text="Modelo:", font=FONT_BOLD, width=70).pack(side="left", padx=(20, 0))
        self.lbl_modelo = ctk.CTkLabel(row1, text="A aguardar…", font=FONT_NORMAL, text_color="gray")
        self.lbl_modelo.pack(side="left", padx=5)

        row2 = ctk.CTkFrame(status_frame, fg_color="transparent")
        row2.pack(fill="x", padx=10, pady=(0, 5))
        ctk.CTkLabel(row2, text="Estado:", font=FONT_BOLD, width=60).pack(side="left")
        self.lbl_estado = ctk.CTkLabel(row2, text="Parado — à espera de modelo via MQTT",
                                       font=FONT_NORMAL, text_color="gray")
        self.lbl_estado.pack(side="left", padx=5)

        # ── Telemetria em Tempo Real ──
        tele_frame = ctk.CTkFrame(self)
        tele_frame.pack(padx=15, pady=5, fill="x")
        ctk.CTkLabel(tele_frame, text="Telemetria em Tempo Real", font=FONT_TITLE).pack(pady=(8, 5))

        grid = ctk.CTkFrame(tele_frame, fg_color="transparent")
        grid.pack(padx=15, pady=(0, 10), fill="x")

        self.tele_labels: dict[str, ctk.CTkLabel] = {}
        campos = [
            ("Velocidade", "---"),
            ("RPM", "---"),
            ("Temp. Motor", "---"),
            ("Voltagem", "---"),
            ("Roll", "---"),
            ("Pitch", "---"),
            ("G-Force", "---"),
            ("Evento", "---"),
        ]
        for i, (campo, default) in enumerate(campos):
            row_idx = i // 2
            col_base = (i % 2) * 2
            ctk.CTkLabel(grid, text=f"{campo}:", font=FONT_BOLD, anchor="w",
                         width=100).grid(row=row_idx, column=col_base, padx=(10, 5), pady=3, sticky="w")
            lbl = ctk.CTkLabel(grid, text=default, font=FONT_MONO, anchor="w", width=120)
            lbl.grid(row=row_idx, column=col_base + 1, padx=(0, 20), pady=3, sticky="w")
            self.tele_labels[campo] = lbl

        # ── Eventos (Debug Local) ──
        evt_frame = ctk.CTkFrame(self)
        evt_frame.pack(padx=15, pady=5, fill="x")
        ctk.CTkLabel(evt_frame, text="Eventos — Debug Local", font=FONT_TITLE).pack(pady=(8, 5))
        ctk.CTkLabel(evt_frame, text="Simula eventos localmente (a app principal fará isto via MQTT)",
                     font=FONT_NORMAL, text_color="#888888").pack()

        btn_row = ctk.CTkFrame(evt_frame, fg_color="transparent")
        btn_row.pack(pady=8)
        ctk.CTkButton(btn_row, text="Queda", width=120, fg_color="#CC0000",
                      hover_color="#880000", command=self._evt_queda).pack(side="left", padx=5)
        ctk.CTkButton(btn_row, text="Alternador", width=120, fg_color="#CC6600",
                      hover_color="#994400", command=self._evt_alternador).pack(side="left", padx=5)
        ctk.CTkButton(btn_row, text="Sobreaquecimento", width=140, fg_color="#CC6600",
                      hover_color="#994400", command=self._evt_sobreaquecimento).pack(side="left", padx=5)
        ctk.CTkButton(btn_row, text="Reset", width=100, fg_color="gray",
                      hover_color="#555555", command=self._evt_reset).pack(side="left", padx=5)

        self.lbl_evento = ctk.CTkLabel(evt_frame, text="", font=FONT_NORMAL)
        self.lbl_evento.pack(pady=(0, 8))

        # ── Log / Último Payload ──
        log_frame = ctk.CTkFrame(self)
        log_frame.pack(padx=15, pady=5, fill="both", expand=True)
        ctk.CTkLabel(log_frame, text="Log / Último Payload", font=FONT_TITLE).pack(pady=(8, 5))
        self.txt_log = ctk.CTkTextbox(log_frame, font=FONT_MONO, height=200)
        self.txt_log.pack(padx=10, pady=(0, 10), fill="both", expand=True)
        self.txt_log.insert("1.0", "A aguardar ligação MQTT…\n")
        self.txt_log.configure(state="disabled")

    # ========================================================================
    #  MQTT
    # ========================================================================
    def _auto_connect(self):
        try:
            self.mqtt_client = mqtt.Client(client_id=DEVICE_ID,
                                          callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
            self.mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
            self.mqtt_client.on_connect = self._on_mqtt_connect
            self.mqtt_client.on_disconnect = self._on_mqtt_disconnect
            self.mqtt_client.on_message = self._on_mqtt_message
            self.mqtt_client.connect_async(MQTT_BROKER, MQTT_PORT, MQTT_KEEPALIVE)
            self.mqtt_client.loop_start()
        except Exception as e:
            self.after(0, lambda: self.lbl_mqtt.configure(text=f"Erro: {e}", text_color="red"))
            self._log(f"Erro ao conectar MQTT: {e}")

    def _on_mqtt_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            self.connected = True
            client.subscribe(MQTT_TOPIC_COMANDO, qos=MQTT_QOS)
            self.after(0, lambda: self.lbl_mqtt.configure(text="Conectado", text_color="#00FF88"))
            self._log(f"MQTT conectado — à escuta em '{MQTT_TOPIC_COMANDO}'")
        else:
            self.after(0, lambda: self.lbl_mqtt.configure(text=f"Erro: {reason_code}", text_color="red"))

    def _on_mqtt_disconnect(self, client, userdata, flags, reason_code, properties):
        self.connected = False
        self.after(0, lambda: self.lbl_mqtt.configure(text="Desconectado", text_color="red"))
        self._log("MQTT desconectado")

    def _on_mqtt_message(self, client, userdata, msg):
        """Processa comandos recebidos da app principal."""
        try:
            dados = json.loads(msg.payload.decode("utf-8"))
        except Exception:
            self._log(f"Comando inválido (não é JSON): {msg.payload}")
            return

        acao = dados.get("acao", "")

        if acao == "definir_modelo":
            modelo = dados.get("modelo", "")
            self._log(f"Comando recebido: definir_modelo → '{modelo}'")
            self.after(0, lambda m=modelo: self._aplicar_modelo(m))

        elif acao == "evento":
            tipo = dados.get("tipo", "")
            self._log(f"Comando recebido: evento → '{tipo}'")
            self.after(0, lambda t=tipo: self._aplicar_evento(t))

        elif acao == "reset_eventos":
            self._log("Comando recebido: reset_eventos")
            self.after(0, self._evt_reset)

        elif acao == "parar":
            self._log("Comando recebido: parar")
            self.after(0, self._parar_geracao)

        elif acao == "arrancar":
            self._log("Comando recebido: arrancar")
            self.after(0, self._arrancar_geracao)

        else:
            self._log(f"Comando desconhecido: {acao}")

    # ========================================================================
    #  Processar comandos
    # ========================================================================
    def _aplicar_modelo(self, modelo: str):
        """Carrega perfil e inicia geração automática."""
        if not self._carregar_perfil(modelo):
            return

        # Reset estado para novo modelo
        self.tele = TelemetriaState()
        self._carregar_perfil(modelo)  # re-propagar thresholds após reset

        # Iniciar GPS no ponto de partida da rota
        rota_start = self.route_follower.waypoints[0]
        self.tele.lat = rota_start[0]
        self.tele.lng = rota_start[1]

        self.tele._target_vel = random.randint(40, int(self.vel_max * 0.6))
        self._tick_count = 0

        # Actualizar UI
        self.lbl_modelo.configure(text=f"{modelo}", text_color="#00AAFF")
        self.lbl_estado.configure(text=f"A gerar dados — {modelo}", text_color="#00FF88")
        self._log(f"Perfil '{modelo}' carregado — geração iniciada")
        self._log(f"  Vel máx: {self.vel_max} km/h | RPM máx: {self.rpm_max}")
        self._log(f"  Queda: Roll≥{self.th_roll}° G≥{self.th_g_force} Confirm {self.th_confirmacao}s")

        # Iniciar geração se não estiver já a correr
        if not self._sim_running:
            self._sim_running = True
            self._sim_thread = threading.Thread(target=self._sim_loop, daemon=True)
            self._sim_thread.start()

    def _aplicar_evento(self, tipo: str):
        if not self._sim_running:
            self._log("Evento ignorado — geração não está activa")
            return
        if tipo == "queda":
            self._evt_queda()
        elif tipo == "alternador":
            self._evt_alternador()
        elif tipo == "sobreaquecimento":
            self._evt_sobreaquecimento()
        else:
            self._log(f"Tipo de evento desconhecido: {tipo}")

    def _parar_geracao(self):
        self._sim_running = False
        self.perfil_nome = None
        self.lbl_modelo.configure(text="Nenhum", text_color="gray")
        self.lbl_estado.configure(text="Parado — à espera de modelo via MQTT", text_color="gray")
        self._log("Geração parada")

    def _pausar_apos_queda(self):
        """Para a geração após queda confirmada, mantendo o perfil activo para retoma."""
        self._sim_running = False
        # Não limpar perfil_nome: permite retomar com reset_eventos ou arrancar
        self.lbl_estado.configure(
            text="PARADO — Queda confirmada. Aguarda 'reset' ou 'arrancar'.",
            text_color="#FF4444"
        )
        self.lbl_evento.configure(text="QUEDA CONFIRMADA — aguarda reset", text_color="#FF0000")
        self._log("QUEDA CONFIRMADA — geração parada. Aguarda 'reset_eventos' ou 'arrancar'.")

    def _arrancar_geracao(self):
        """Retoma a geração após queda (ou inicia se o modelo já foi definido)."""
        if self.perfil_nome and not self._sim_running:
            self.tele.reset_eventos()
            self._sim_running = True
            self._sim_thread = threading.Thread(target=self._sim_loop, daemon=True)
            self._sim_thread.start()
            self.lbl_estado.configure(
                text=f"A gerar dados — {self.perfil_nome} (retomado)",
                text_color="#00FF88"
            )
            self.lbl_evento.configure(text="Retomado após queda", text_color="#00FF88")
            self._log(f"Geração retomada — modelo: {self.perfil_nome}")
        elif not self.perfil_nome:
            self._log("Arrancar: sem modelo activo — usa 'definir_modelo' primeiro.")
        else:
            self._log("Arrancar: geração já activa.")

    # ========================================================================
    #  LOOP CENTRAL DE GERAÇÃO (1 tick = 1 segundo)
    # ========================================================================
    def _sim_loop(self):
        while self._sim_running and self.connected:
            self._tick_count += 1
            s = self.tele

            # =============================================================
            #  MODELO FÍSICO — todos os dados derivam uns dos outros
            # =============================================================

            # ── 1. Intenção do motociclista (guiada pela rota) ─────────────
            #  Velocidade alvo: muda a cada 8s (decisão do condutor)
            if self._tick_count % 8 == 0:
                s._target_vel = clamp(
                    s._target_vel + random.uniform(-5, 5),
                    30, self.vel_max * 0.7
                )
            #  Yaw alvo derivado da rota pré-definida (substitui random walk)
            route_info = self.route_follower.update(s.lat, s.lng)
            s._target_yaw = route_info["target_yaw_deg"]
            #  Reduzir velocidade antes de curvas fechadas
            if route_info["speed_limit_kmh"] is not None:
                s._target_vel = min(s._target_vel, route_info["speed_limit_kmh"])

            # ── 2. Velocidade e Aceleração ────────────────────────────────
            vel_diff = s._target_vel - s.velocidade
            s._acceleration = clamp(vel_diff * 0.15, -15, 15)

            s.velocidade = lerp(s.velocidade, s._target_vel, LERP_VEL)
            s.velocidade += random.uniform(-0.3, 0.3)
            s.velocidade = clamp(s.velocidade, 0, self.vel_max)

            # ── 3. Throttle e Brakes (MUTUAMENTE EXCLUSIVOS) ─────────────
            if vel_diff > 2:
                # Acelerando → throttle proporcional, brakes a zero
                s.throttle_pct = clamp(vel_diff * 3 + random.uniform(5, 15), 5, 100)
                s.brake_front_pct = lerp(s.brake_front_pct, 0, 0.5)
                s.brake_rear_pct  = lerp(s.brake_rear_pct, 0, 0.5)
            elif vel_diff < -5:
                # Travando → brakes proporcionais, throttle a zero
                s.throttle_pct = lerp(s.throttle_pct, 0, 0.5)
                brake_force = clamp(abs(vel_diff) * 2, 0, 100)
                s.brake_front_pct = lerp(s.brake_front_pct,
                    brake_force * random.uniform(0.5, 0.8), 0.4)
                s.brake_rear_pct  = lerp(s.brake_rear_pct,
                    brake_force * random.uniform(0.2, 0.5), 0.4)
            else:
                # Cruzeiro — manter velocidade
                s.throttle_pct = lerp(s.throttle_pct,
                    random.uniform(15, 30), 0.2)
                s.brake_front_pct = lerp(s.brake_front_pct, 0, 0.3)
                s.brake_rear_pct  = lerp(s.brake_rear_pct, 0, 0.3)
            s.throttle_pct    = clamp(s.throttle_pct, 0, 100)
            s.brake_front_pct = clamp(s.brake_front_pct, 0, 100)
            s.brake_rear_pct  = clamp(s.brake_rear_pct, 0, 100)

            # ── 4. Pitch DERIVADO da aceleração ──────────────────────────
            #  Acelerar = nariz sobe (pitch positivo)
            #  Travar = nariz desce (pitch negativo)
            target_pitch = clamp(s._acceleration * 0.8, -12, 12)
            s.pitch = lerp(s.pitch, target_pitch, LERP_PITCH)
            s.pitch += random.uniform(-0.15, 0.15)
            s.pitch = clamp(s.pitch, -45, 45)

            # ── 5. Roll e Yaw INTERLIGADOS (curvas) ──────────────────────
            #  Diferença angular pelo caminho mais curto
            yaw_diff = (s._target_yaw - s.yaw + 180) % 360 - 180
            speed_factor = clamp(s.velocidade / 60.0, 0.1, 2.0)

            #  Roll necessário: quanto mais rápido + mais curva → mais inclinação
            target_roll = clamp(
                yaw_diff * speed_factor * 0.5,
                -self.roll_tipico, self.roll_tipico
            )
            s.roll = lerp(s.roll, target_roll, LERP_ROLL)
            s.roll += random.uniform(-0.2, 0.2)
            s.roll = clamp(s.roll,
                           -self.roll_tipico * 1.2,
                            self.roll_tipico * 1.2)

            #  Yaw atualiza-se com base no roll (mais inclinação → mais viragem)
            if s.velocidade > 1:
                yaw_rate = s.roll * 0.08 * speed_factor
                s.yaw = (s.yaw + yaw_rate) % 360
            s.yaw += random.uniform(-0.3, 0.3)
            s.yaw = s.yaw % 360

            # ── 6. RPM PROPORCIONAL à velocidade ─────────────────────────
            target_rpm = (s.velocidade * (self.rpm_max / self.vel_max)
                          + random.uniform(-100, 100))
            s.rpm = lerp(float(s.rpm), target_rpm, LERP_RPM)
            s.rpm += random.uniform(-15, 15)
            s.rpm = clamp(s.rpm, 0, self.rpm_max)

            # ── 7. Temperatura PROPORCIONAL à velocidade e RPM ───────────
            target_temp = (self.temp_min
                           + (self.temp_max - self.temp_min)
                           * (s.velocidade / self.vel_max) * 0.9)
            s.temp_motor = lerp(s.temp_motor, target_temp, LERP_TEMP)
            s.temp_motor += random.uniform(-0.1, 0.1)
            s.temp_motor = clamp(s.temp_motor,
                                 self.temp_min - 5,
                                 self.temp_max + 25)

            # ── 8. Voltagem ──────────────────────────────────────────────
            target_volt = VOLTAGEM_NOMINAL + random.uniform(-0.05, 0.05)
            s.voltagem = lerp(s.voltagem, target_volt, LERP_VOLT)
            s.voltagem += random.uniform(-0.02, 0.02)
            s.voltagem = clamp(s.voltagem, 9.0, self.volt_max)

            # ── 9. Gear e Clutch (com deteção de troca) ──────────────────
            s._prev_gear = s.gear
            if s.velocidade < 1:
                s.gear = 0
                s.clutch_engaged = True
            else:
                gear_ratio = s.velocidade / self.vel_max
                s.gear = max(1, min(6, int(gear_ratio * 6) + 1))
                # Embraiagem puxa durante 1-2 ticks ao mudar de mudança
                if s.gear != s._prev_gear and s._prev_gear != 0:
                    s._clutch_timer = 2
                if s._clutch_timer > 0:
                    s.clutch_engaged = True
                    s._clutch_timer -= 1
                else:
                    s.clutch_engaged = False

            # ── 10. Odómetro (acumula distância real) ────────────────────
            s.odometer_km += s.velocidade / 3600.0

            # ── 11. Segurança ativa (derivada de throttle e brakes) ──────
            s.abs_active = (s.brake_front_pct > 60 and s.velocidade > 30
                           and random.random() < 0.15)
            s.tc_active = (s.throttle_pct > 70 and s.velocidade > 20
                          and random.random() < 0.10)
            s.side_stand_down = (s.velocidade < 1
                                and random.random() < 0.05)

            # ── 12. Pressão óleo (específica por perfil) ──────────────────────────
            oil_base = self.oil_idle + (s.rpm / self.rpm_max) * (self.oil_max - self.oil_idle)
            s.oil_pressure_bar = clamp(
                oil_base + random.uniform(-0.1, 0.1),
                self.oil_idle * 0.5, self.oil_max * 1.1)

            # ── 13. Pressão pneus (base específica por perfil + calor) ───────────
            temp_factor = ((s.temp_motor - self.temp_min)
                          / max(1, self.temp_max - self.temp_min))
            s.tire_pressure_front = clamp(
                self.tire_front_base + temp_factor * self.tire_front_base * 0.08
                + random.uniform(-0.02, 0.02),
                self.tire_front_base * 0.85, self.tire_front_base * 1.15)
            s.tire_pressure_rear = clamp(
                self.tire_rear_base + temp_factor * self.tire_rear_base * 0.10
                + random.uniform(-0.02, 0.02),
                self.tire_rear_base * 0.85, self.tire_rear_base * 1.15)

            # ── 14. Efeitos de eventos activos ───────────────────────────
            s.g_force = 0.0

            if s.flag_queda:
                if not s._queda_confirmed:
                    if s._queda_timer == 0:
                        s.g_force = round(random.uniform(self.th_g_force, 5.0), 1)
                    s._queda_timer += 1
                    s.velocidade = lerp(s.velocidade, 0, 0.6)
                    s.rpm        = lerp(float(s.rpm), 0, 0.6)
                    target_crash_roll = self.th_roll if s.roll >= 0 else -self.th_roll
                    s.roll = lerp(s.roll, target_crash_roll, 0.5)
                    s.throttle_pct = 0
                    s.brake_front_pct = 0
                    s.brake_rear_pct = 0
                    s.tc_active = False          # sem acelerador durante queda
                    s.side_stand_down = False    # mota em queda — descanso levantado
                    if s._queda_timer >= self.th_confirmacao:
                        s._queda_confirmed = True
                else:
                    # Mota no chão — estado congelado até reset
                    s.velocidade = lerp(s.velocidade, 0, 0.9)
                    s.rpm        = lerp(float(s.rpm), 0, 0.9)
                    s.gear = 0
                    s.throttle_pct = 0
                    s.roll = self.th_roll if s.roll >= 0 else -self.th_roll
                    s.oil_pressure_bar = max(0.0, lerp(s.oil_pressure_bar, 0.0, 0.5))
                    s.abs_active = False
                    s.tc_active = False
                    s.side_stand_down = False

            if s.flag_alternador:
                s.voltagem = max(9.0, s.voltagem - random.uniform(0.15, 0.25))

            if s.flag_sobreaquecimento:
                s.temp_motor = min(self.temp_max + 25, s.temp_motor + random.uniform(1.5, 3.0))
                s.oil_pressure_bar = clamp(s.oil_pressure_bar - 0.05, 0.5, 5.5)

            # ── 15. GPS baseado em DIREÇÃO (yaw) e VELOCIDADE ────────
            if s.velocidade > 1:
                speed_ms = s.velocidade / 3.6          # km/h → m/s
                yaw_rad  = math.radians(s.yaw)
                s.lat += (speed_ms * math.cos(yaw_rad)) / 111320.0
                s.lng += (speed_ms * math.sin(yaw_rad)) / (
                    111320.0 * math.cos(math.radians(s.lat)))
                # Sem ruído aleatório — posição segue a física da rota

            # ── 16. Arredondar para output ───────────────────────────────
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

            # ── 17. Construir e publicar payload ─────────────────────────
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

            self._publicar(payload)

            # ── 18. Actualizar GUI de debug ────────────────────────────
            self.after(0, lambda v=vel_out, r=rpm_out, t=temp_out,
                       vt=volt_out, ro=roll_out, pi=pitch_out,
                       g=s.g_force, ev=evento, tk=self._tick_count:
                       self._update_debug_ui(v, r, t, vt, ro, pi, g, ev, tk))

            # ── Detectar queda confirmada — parar geração e aguardar reset ──────────────
            if self.tele._queda_confirmed:
                s.velocidade = 0.0
                s.rpm = 0.0
                s.gear = 0
                s.throttle_pct = 0.0
                s.brake_front_pct = 0.0
                s.brake_rear_pct = 0.0
                s._target_vel = 0.0
                self.after(0, self._pausar_apos_queda)
                break

            time.sleep(PUBLISH_INTERVAL)

        # Loop terminou
        if not self.connected:
            self._log("Geração parada — MQTT desconectado")

    # ========================================================================
    #  Publicação MQTT
    # ========================================================================
    def _publicar(self, payload: dict):
        json_str = json.dumps(payload, indent=2)
        try:
            self.mqtt_client.publish(MQTT_TOPIC_TELEMETRIA, json_str,
                                     qos=MQTT_QOS, retain=MQTT_RETAIN)
        except Exception as e:
            self._log(f"Erro ao publicar: {e}")
        self.after(0, lambda t=json_str: self._update_payload_display(t))

    # ========================================================================
    #  Actualizar UI de Debug
    # ========================================================================
    def _update_debug_ui(self, vel, rpm, temp, volt, roll, pitch, g_force, evento, tick):
        try:
            self.tele_labels["Velocidade"].configure(text=f"{vel} km/h")
            self.tele_labels["RPM"].configure(text=f"{rpm}")
            self.tele_labels["Temp. Motor"].configure(text=f"{temp} °C")
            self.tele_labels["Voltagem"].configure(text=f"{volt} V")
            self.tele_labels["Roll"].configure(text=f"{roll}°")
            self.tele_labels["Pitch"].configure(text=f"{pitch}°")
            self.tele_labels["G-Force"].configure(text=f"{g_force}")
            color = "#00FF88" if evento == "NORMAL" else "#FF4444"
            self.tele_labels["Evento"].configure(text=evento, text_color=color)
            self.lbl_estado.configure(
                text=f"A gerar dados — {self.perfil_nome} (tick #{tick})",
                text_color="#00FF88")
        except Exception:
            pass

    def _update_payload_display(self, texto: str):
        try:
            self.txt_log.configure(state="normal")
            self.txt_log.delete("1.0", "end")
            self.txt_log.insert("1.0", texto)
            self.txt_log.configure(state="disabled")
        except Exception:
            pass

    # ========================================================================
    #  Eventos — debug local + MQTT
    # ========================================================================
    def _evt_queda(self):
        if not self._sim_running:
            self.lbl_evento.configure(text="Geração não activa!", text_color="red")
            return
        self.tele.flag_queda = True
        self.tele._queda_timer = 0
        self.tele._queda_confirmed = False
        self.lbl_evento.configure(text="QUEDA activada", text_color="#FF0000")
        self._log("Evento: QUEDA activada")

    def _evt_alternador(self):
        if not self._sim_running:
            self.lbl_evento.configure(text="Geração não activa!", text_color="red")
            return
        self.tele.flag_alternador = True
        self.lbl_evento.configure(text="Falha alternador activada", text_color="#FF8800")
        self._log("Evento: FALHA ALTERNADOR activada")

    def _evt_sobreaquecimento(self):
        if not self._sim_running:
            self.lbl_evento.configure(text="Geração não activa!", text_color="red")
            return
        self.tele.flag_sobreaquecimento = True
        self.lbl_evento.configure(text="Sobreaquecimento activado", text_color="#FF8800")
        self._log("Evento: SOBREAQUECIMENTO activado")

    def _evt_reset(self):
        self.tele.reset_eventos()
        self.lbl_evento.configure(text="Eventos limpos", text_color="#00FF88")
        self._log("Eventos resetados")
        self.after(3000, lambda: self.lbl_evento.configure(text=""))
        # Retomar geração se estava parada por queda (perfil activo mas loop parado)
        if self.perfil_nome and not self._sim_running:
            self._arrancar_geracao()

    # ========================================================================
    #  Log
    # ========================================================================
    def _log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {msg}\n"

        def _append():
            try:
                self.txt_log.configure(state="normal")
                self.txt_log.insert("end", line)
                self.txt_log.see("end")
                self.txt_log.configure(state="disabled")
            except Exception:
                pass

        self.after(0, _append)

    # ========================================================================
    #  Ciclo de vida
    # ========================================================================
    def _on_closing(self):
        self._sim_running = False
        if self.mqtt_client:
            self.mqtt_client.disconnect()
            self.mqtt_client.loop_stop()
        self.destroy()


# =============================================================================
#  Ponto de Entrada
# =============================================================================
if __name__ == "__main__":
    app = MotoGuardGenerator()
    app.mainloop()
