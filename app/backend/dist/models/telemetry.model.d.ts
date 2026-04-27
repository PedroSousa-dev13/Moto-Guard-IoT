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
    accel_g?: number;
}
export interface ActiveSafety {
    abs_active: boolean;
    tc_active: boolean;
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
export interface SystemData {
    device_id: string;
    moto_model: string;
    event_status: string;
    tick: number;
    timestamp: string;
    speed_limit_kmh?: number;
}
/** Payload completo recebido do simulador via MQTT */
export interface TelemetryPayload {
    telemetry: TelemetryData;
    imu: IMUData;
    active_safety: ActiveSafety;
    health: HealthData;
    location: LocationData;
    system: SystemData;
}
/** Comando enviado para o simulador */
export interface SimulatorCommand {
    acao: string;
    modelo?: string;
    motorcycleName?: string;
    tipo?: string;
    device_id?: string;
    new_device_id?: string;
    userId?: string;
    source?: string;
    route?: {
        start: {
            latitude: number;
            longitude: number;
        };
        end: {
            latitude: number;
            longitude: number;
        };
        loop?: boolean;
    };
}
/** Estado de ligação do backend (enviado ao frontend via Socket.IO) */
export interface BackendStatus {
    mqttConnected: boolean;
    telemetryCount: number;
    hasData: boolean;
}
//# sourceMappingURL=telemetry.model.d.ts.map