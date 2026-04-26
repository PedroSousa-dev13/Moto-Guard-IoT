"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.influxService = void 0;
const influxdb_client_1 = require("@influxdata/influxdb-client");
const env_1 = require("../config/env");
// Colunas de metadados do InfluxDB a remover da resposta ao cliente
const INFLUX_META_KEYS = new Set([
    "result",
    "table",
    "_start",
    "_stop",
    "_measurement",
]);
class InfluxService {
    client;
    writeApi;
    queryApi;
    _available = true;
    constructor() {
        this.client = new influxdb_client_1.InfluxDB({
            url: env_1.env.INFLUXDB_URL,
            token: env_1.env.INFLUXDB_TOKEN,
        });
        // Escrita em lote: flush a cada 5 s ou quando atingir 20 pontos
        this.writeApi = this.client.getWriteApi(env_1.env.INFLUXDB_ORG, env_1.env.INFLUXDB_BUCKET, "ms", {
            batchSize: 20,
            flushInterval: 5000,
            writeFailed: (_error, _lines, _attempt, expires) => {
                // Se o bucket não existe (404) ou token inválido (401/403), desativa writes
                const msg = _error?.statusCode;
                if (msg === 404 || msg === 401 || msg === 403) {
                    if (this._available) {
                        console.warn(`[InfluxDB] Indisponível (${msg}) — writes desativados. Cria o bucket "${env_1.env.INFLUXDB_BUCKET}" para ativar.`);
                        this._available = false;
                    }
                }
                return Promise.resolve();
            },
        });
        this.queryApi = this.client.getQueryApi(env_1.env.INFLUXDB_ORG);
    }
    get available() {
        return this._available;
    }
    // ─── Escrever ponto de telemetria ─────────────────────────────────────────
    writeTelemetry(payload) {
        if (!this._available)
            return;
        try {
            const point = new influxdb_client_1.Point("telemetry")
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
                // Timestamp do payload
                .timestamp(new Date(payload.system.timestamp));
            this.writeApi.writePoint(point);
        }
        catch (err) {
            console.error("❌ InfluxDB write error:", err.message);
            this._available = false;
        }
    }
    // ─── Consultar telemetria de uma viagem ───────────────────────────────────
    async queryTripTelemetry(startedAt, endedAt, deviceId) {
        if (!this._available)
            return [];
        const stop = (endedAt ?? new Date()).toISOString();
        const deviceFilter = deviceId
            ? `  |> filter(fn: (r) => r.device_id == "${deviceId}")`
            : "";
        const query = `
from(bucket: "${env_1.env.INFLUXDB_BUCKET}")
  |> range(start: ${startedAt.toISOString()}, stop: ${stop})
  |> filter(fn: (r) => r._measurement == "telemetry")
${deviceFilter}
  |> aggregateWindow(every: 1s, fn: mean, createEmpty: false)
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])
`;
        const rows = [];
        await new Promise((resolve, reject) => {
            this.queryApi.queryRows(query, {
                next(row, tableMeta) {
                    const raw = tableMeta.toObject(row);
                    const point = {};
                    for (const [k, v] of Object.entries(raw)) {
                        if (INFLUX_META_KEYS.has(k))
                            continue;
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
    async ensureBucket() {
        try {
            // 1. Obter o orgId a partir do nome da org
            const orgsRes = await fetch(`${env_1.env.INFLUXDB_URL}/api/v2/orgs?org=${encodeURIComponent(env_1.env.INFLUXDB_ORG)}`, { headers: { Authorization: `Token ${env_1.env.INFLUXDB_TOKEN}` } });
            if (!orgsRes.ok) {
                console.warn(`[InfluxDB] Não foi possível obter orgs (${orgsRes.status}) — a ignorar criação de bucket.`);
                return;
            }
            const orgsData = await orgsRes.json();
            const orgId = orgsData.orgs?.[0]?.id;
            if (!orgId) {
                console.warn("[InfluxDB] Org não encontrada — a ignorar criação de bucket.");
                return;
            }
            // 2. Verificar se o bucket já existe
            const bucketsRes = await fetch(`${env_1.env.INFLUXDB_URL}/api/v2/buckets?org=${encodeURIComponent(env_1.env.INFLUXDB_ORG)}&name=${encodeURIComponent(env_1.env.INFLUXDB_BUCKET)}`, { headers: { Authorization: `Token ${env_1.env.INFLUXDB_TOKEN}` } });
            if (bucketsRes.ok) {
                const bucketsData = await bucketsRes.json();
                if ((bucketsData.buckets?.length ?? 0) > 0) {
                    console.log(`[InfluxDB] Bucket "${env_1.env.INFLUXDB_BUCKET}" já existe.`);
                    this._available = true;
                    return;
                }
            }
            // 3. Criar o bucket
            const createRes = await fetch(`${env_1.env.INFLUXDB_URL}/api/v2/buckets`, {
                method: "POST",
                headers: {
                    Authorization: `Token ${env_1.env.INFLUXDB_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    orgID: orgId,
                    name: env_1.env.INFLUXDB_BUCKET,
                    retentionRules: [{ type: "expire", everySeconds: 60 * 60 * 24 * 30 }], // 30 dias
                }),
            });
            if (createRes.ok) {
                console.log(`[InfluxDB] Bucket "${env_1.env.INFLUXDB_BUCKET}" criado com sucesso.`);
                this._available = true;
            }
            else {
                const body = await createRes.text();
                console.warn(`[InfluxDB] Falha ao criar bucket: ${createRes.status} — ${body}`);
            }
        }
        catch (err) {
            console.warn("[InfluxDB] Não foi possível verificar/criar bucket:", err.message);
        }
    }
    // ─── Flush e fecho (graceful shutdown) ────────────────────────────────────
    async close() {
        await this.writeApi.close();
    }
}
exports.influxService = new InfluxService();
//# sourceMappingURL=influx.service.js.map