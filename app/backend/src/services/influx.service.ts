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
//          tire_pressure_front_bar, tire_pressure_rear_bar
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
  private _available = true;

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
      {
        batchSize: 20,
        flushInterval: 5000,
        writeFailed: (_error, _lines, _attempt, expires) => {
          // Se o bucket não existe (404) ou token inválido (401/403), desativa writes
          const msg = (_error as any)?.statusCode;
          if (msg === 404 || msg === 401 || msg === 403) {
            if (this._available) {
              console.warn(`[InfluxDB] Indisponível (${msg}) — writes desativados. Cria o bucket "${env.INFLUXDB_BUCKET}" para ativar.`);
              this._available = false;
            }
          }
          return Promise.resolve();
        },
      }
    );

    this.queryApi = this.client.getQueryApi(env.INFLUXDB_ORG);
  }

  get available(): boolean {
    return this._available;
  }

  // ─── Escrever ponto de telemetria ─────────────────────────────────────────
  writeTelemetry(payload: TelemetryPayload): void {
    if (!this._available) return;
    try {
      const point = new Point("telemetry")
        // Tags (indexadas — usadas para filtrar por dispositivo/modelo)
        .tag("device_id", payload.system?.device_id || "unknown")
        .tag("moto_model", payload.system?.moto_model || "unknown")
        // Telemetria principal
        .floatField("speed_kmh", payload.telemetry?.speed_kmh ?? 0)
        .floatField("rpm", payload.telemetry?.rpm ?? 0)
        .floatField("gear", payload.telemetry?.gear ?? 0)
        .floatField("throttle_pct", payload.telemetry?.throttle_pct ?? 0)
        .floatField("engine_temp_c", payload.telemetry?.engine_temp_c ?? 0)
        .floatField("voltage", payload.telemetry?.voltage ?? 0)
        .floatField("brake_front_pct", payload.telemetry?.brake_front_pct ?? 0)
        .floatField("brake_rear_pct", payload.telemetry?.brake_rear_pct ?? 0)
        // IMU
        .floatField("roll_deg", payload.imu?.roll_deg ?? 0)
        .floatField("pitch_deg", payload.imu?.pitch_deg ?? 0)
        .floatField("yaw_deg", payload.imu?.yaw_deg ?? 0)
        .floatField("g_force", payload.imu?.g_force ?? 0)
        // GPS
        .floatField("latitude", payload.location?.latitude ?? 0)
        .floatField("longitude", payload.location?.longitude ?? 0)
        // Saúde
        .floatField("oil_pressure_bar", payload.health?.oil_pressure_bar ?? 0)
        .floatField("tire_pressure_front_bar", payload.health?.tire_pressure_front_bar ?? 0)
        .floatField("tire_pressure_rear_bar", payload.health?.tire_pressure_rear_bar ?? 0);

      // Handle potentially missing timestamp
      if (payload.system?.timestamp) {
        point.timestamp(new Date(payload.system.timestamp));
      }

      this.writeApi.writePoint(point);
    } catch (err) {
      console.error("❌ InfluxDB write error:", (err as Error).message);
      // Removed this._available = false; formatting errors shouldn't permanently disable writes
    }
  }

  // ─── Consultar telemetria de uma viagem ───────────────────────────────────
  async queryTripTelemetry(
    startedAt: Date,
    endedAt: Date | null,
    deviceId?: string | null
  ): Promise<Record<string, unknown>[]> {
    if (!this._available) return [];
    const stop = (endedAt ?? new Date()).toISOString();
    const deviceFilter = deviceId
      ? `  |> filter(fn: (r) => r.device_id == "${deviceId}")`
      : "";

    const query = `
from(bucket: "${env.INFLUXDB_BUCKET}")
  |> range(start: ${startedAt.toISOString()}, stop: ${stop})
  |> filter(fn: (r) => r._measurement == "telemetry")
${deviceFilter}
  |> aggregateWindow(every: 1s, fn: mean, createEmpty: false)
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

  // ─── Garantir que o bucket existe (cria se necessário) ───────────────────
  async ensureBucket(): Promise<void> {
    try {
      // 1. Obter o orgId a partir do nome da org
      const orgsRes = await fetch(
        `${env.INFLUXDB_URL}/api/v2/orgs?org=${encodeURIComponent(env.INFLUXDB_ORG)}`,
        { headers: { Authorization: `Token ${env.INFLUXDB_TOKEN}` } }
      );
      if (!orgsRes.ok) {
        console.warn(`[InfluxDB] Não foi possível obter orgs (${orgsRes.status}) — a ignorar criação de bucket.`);
        return;
      }
      const orgsData = await orgsRes.json() as { orgs?: Array<{ id: string }> };
      const orgId = orgsData.orgs?.[0]?.id;
      if (!orgId) {
        console.warn("[InfluxDB] Org não encontrada — a ignorar criação de bucket.");
        return;
      }

      // 2. Verificar se o bucket já existe
      const bucketsRes = await fetch(
        `${env.INFLUXDB_URL}/api/v2/buckets?org=${encodeURIComponent(env.INFLUXDB_ORG)}&name=${encodeURIComponent(env.INFLUXDB_BUCKET)}`,
        { headers: { Authorization: `Token ${env.INFLUXDB_TOKEN}` } }
      );
      if (bucketsRes.ok) {
        const bucketsData = await bucketsRes.json() as { buckets?: unknown[] };
        if ((bucketsData.buckets?.length ?? 0) > 0) {
          console.log(`[InfluxDB] Bucket "${env.INFLUXDB_BUCKET}" já existe.`);
          this._available = true;
          return;
        }
      }

      // 3. Criar o bucket
      const createRes = await fetch(`${env.INFLUXDB_URL}/api/v2/buckets`, {
        method: "POST",
        headers: {
          Authorization: `Token ${env.INFLUXDB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgID: orgId,
          name: env.INFLUXDB_BUCKET,
          retentionRules: [{ type: "expire", everySeconds: 60 * 60 * 24 * 30 }], // 30 dias
        }),
      });

      if (createRes.ok) {
        console.log(`[InfluxDB] Bucket "${env.INFLUXDB_BUCKET}" criado com sucesso.`);
        this._available = true;
      } else {
        const body = await createRes.text();
        console.warn(`[InfluxDB] Falha ao criar bucket: ${createRes.status} — ${body}`);
      }
    } catch (err) {
      console.warn("[InfluxDB] Não foi possível verificar/criar bucket:", (err as Error).message);
    }
  }

  // ─── Flush e fecho (graceful shutdown) ────────────────────────────────────
  async close(): Promise<void> {
    await this.writeApi.close();
  }
}

export const influxService = new InfluxService();
