// =============================================================================
// MotoGuard IoT — Tipos de Telemetria (Data Contract)
// =============================================================================
// Corresponde ao payload JSON publicado pelo simulador Python via MQTT.
// =============================================================================

export interface TelemetryData {
  speed_kmh: number;
  rpm: number;
  gear: number;
  throttle_pct: number;
  engine_temp_c: number;
  voltage: number;
  brake_front_pct: number;
  brake_rear_pct: number;
  odometer_km: number;
  clutch_engaged: boolean;
}

export interface IMUData {
  roll_deg: number;
  pitch_deg: number;
  yaw_deg: number;
  g_force: number;
}

export interface ActiveSafety {
  abs_active: boolean;
  tc_active: boolean;
  side_stand_down: boolean;
}

export interface HealthData {
  oil_pressure_bar: number;
  tire_pressure_front_bar: number;
  tire_pressure_rear_bar: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface EnvironmentData {
  ambient_light_lux: number;
}

export interface SystemData {
  device_id: string;
  moto_model: string;
  event_status: string;
  tick: number;
  timestamp: string;
}

/** Payload completo recebido do simulador via MQTT */
export interface TelemetryPayload {
  telemetry: TelemetryData;
  imu: IMUData;
  active_safety: ActiveSafety;
  health: HealthData;
  location: LocationData;
  environment: EnvironmentData;
  system: SystemData;
}

/** Entrada de log no dashboard */
export interface LogEntry {
  time: string;
  message: string;
  color: string;
}

/** Estado de ligação dos serviços */
export interface ConnectionStatus {
  mqtt: boolean;
  ws: boolean;
  hasData: boolean;
}

/** Comando enviado para o simulador */
export interface SimulatorCommand {
  acao: string;
  modelo?: string;
  tipo?: string;
  device_id?: string;
  userId?: string;
}

/** Evento de alerta emitido por WebSocket */
export interface AlertEvent {
  status: string;
  deviceId: string;
  motoModel: string;
  timestamp: string;
}

/** Evento de ciclo de viagem emitido por WebSocket */
export interface TripSocketEvent {
  deviceId: string;
  motoModel: string;
  timestamp: string;
}
