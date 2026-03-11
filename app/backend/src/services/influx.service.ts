// =============================================================================
// MotoGuard IoT — Serviço: InfluxDB
// =============================================================================
// Gere a escrita e leitura de telemetria na base de dados de séries temporais.
//
//   · writeTelemetry(payload) — grava 1 ponto por mensagem MQTT recebida
//   · queryTripTelemetry(...)  — consulta todos os pontos de uma viagem
//
// Medição: "telemetry"
// Tags:    device_id, moto_model
// Campos:  speed_kmh, rpm, gear, throttle_pct, engine_temp_c, voltage,
//          brake_front_pct, brake_rear_pct, roll_deg, pitch_deg, yaw_deg,
//          g_force, latitude, longitude, oil_pressure_bar,
//          tire_pressure_front_bar, tire_pressure_rear_bar, ambient_light_lux
// =============================================================================

import {
  InfluxDB,
  Point,
  WriteApi,
  QueryApi,
  FluxTableMetaData,
} from "@influxdata/influxdb-client";
import { env } from "../config/env";
import type { TelemetryPayload } from "../models/telemetry.model";

// Colunas de metadados do InfluxDB a remover da resposta ao cliente
const INFLUX_META_KEYS = new Set([
  "result",
  "table",
  "_start",
  "_stop",
  "_measurement",
]);

class InfluxService {
  private client: InfluxDB;
  private writeApi: WriteApi;
  private queryApi: QueryApi;

  constructor() {
    this.client = new InfluxDB({
      url: env.INFLUXDB_URL,
      token: env.INFLUXDB_TOKEN,
    });

    // Escrita em lote: flush a cada 5 s ou quando atingir 20 pontos
    this.writeApi = this.client.getWriteApi(
      env.INFLUXDB_ORG,
      env.INFLUXDB_BUCKET,
      "ms",
      { batchSize: 20, flushInterval: 5000 }
    );

    this.queryApi = this.client.getQueryApi(env.INFLUXDB_ORG);
  }

  // ─── Escrever ponto de telemetria ─────────────────────────────────────────
  writeTelemetry(payload: TelemetryPayload): void {
    try {
      const point = new Point("telemetry")
        // Tags (indexadas — usadas para filtrar por dispositivo/modelo)
        .tag("device_id", payload.system.device_id)
        .tag("moto_model", payload.system.moto_model)
        // Telemetria principal
        .floatField("speed_kmh", payload.telemetry.speed_kmh)
        .floatField("rpm", payload.telemetry.rpm)
        .floatField("gear", payload.telemetry.gear)
        .floatField("throttle_pct", payload.telemetry.throttle_pct)
        .floatField("engine_temp_c", payload.telemetry.engine_temp_c)
        .floatField("voltage", payload.telemetry.voltage)
        .floatField("brake_front_pct", payload.telemetry.brake_front_pct)
        .floatField("brake_rear_pct", payload.telemetry.brake_rear_pct)
        // IMU
        .floatField("roll_deg", payload.imu.roll_deg)
        .floatField("pitch_deg", payload.imu.pitch_deg)
        .floatField("yaw_deg", payload.imu.yaw_deg)
        .floatField("g_force", payload.imu.g_force)
        // GPS
        .floatField("latitude", payload.location.latitude)
        .floatField("longitude", payload.location.longitude)
        // Saúde
        .floatField("oil_pressure_bar", payload.health.oil_pressure_bar)
        .floatField("tire_pressure_front_bar", payload.health.tire_pressure_front_bar)
        .floatField("tire_pressure_rear_bar", payload.health.tire_pressure_rear_bar)
        // Ambiente
        .floatField("ambient_light_lux", payload.environment.ambient_light_lux)
        // Timestamp do payload
        .timestamp(new Date(payload.system.timestamp));

      this.writeApi.writePoint(point);
    } catch (err) {
      console.error("❌ InfluxDB write error:", (err as Error).message);
    }
  }

  // ─── Consultar telemetria de uma viagem ───────────────────────────────────
  async queryTripTelemetry(
    startedAt: Date,
    endedAt: Date | null,
    deviceId?: string | null
  ): Promise<Record<string, unknown>[]> {
    const stop = (endedAt ?? new Date()).toISOString();
    const deviceFilter = deviceId
      ? `  |> filter(fn: (r) => r.device_id == "${deviceId}")`
      : "";

    const query = `
from(bucket: "${env.INFLUXDB_BUCKET}")
  |> range(start: ${startedAt.toISOString()}, stop: ${stop})
  |> filter(fn: (r) => r._measurement == "telemetry")
${deviceFilter}
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])
`;

    const rows: Record<string, unknown>[] = [];

    await new Promise<void>((resolve, reject) => {
      this.queryApi.queryRows(query, {
        next(row: string[], tableMeta: FluxTableMetaData) {
          const raw = tableMeta.toObject(row) as Record<string, unknown>;
          const point: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(raw)) {
            if (INFLUX_META_KEYS.has(k)) continue;
            point[k === "_time" ? "time" : k] = v;
          }
          rows.push(point);
        },
        error: reject,
        complete: resolve,
      });
    });

    return rows;
  }

  // ─── Flush e fecho (graceful shutdown) ────────────────────────────────────
  async close(): Promise<void> {
    await this.writeApi.close();
  }
}

export const influxService = new InfluxService();
