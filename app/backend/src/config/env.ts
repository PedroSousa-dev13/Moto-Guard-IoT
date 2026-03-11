// =============================================================================
// MotoGuard IoT — Configuração (Variáveis Externas)
// =============================================================================
// Centraliza todas as variáveis externas usadas pelo backend.
// Valores por defeito alinham com o docker-compose.yml.
// =============================================================================

export const env = {
  // ─── Servidor ───────────────────────────────────────────────────────────
  PORT: parseInt(process.env.PORT || "3000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",

  // ─── MQTT ───────────────────────────────────────────────────────────────
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
  MQTT_USER: process.env.MQTT_USER || "backend",
  MQTT_PASS: process.env.MQTT_PASS || "backend123",
  MQTT_TOPIC_TELEMETRIA:
    process.env.MQTT_TOPIC_TELEMETRIA || "motoguard/telemetria",
  MQTT_TOPIC_COMANDO: process.env.MQTT_TOPIC_COMANDO || "motoguard/comando",

  // ─── InfluxDB ───────────────────────────────────────────────────────────
  INFLUXDB_URL: process.env.INFLUXDB_URL || "http://localhost:8086",
  INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN || "motoguard-dev-token",
  INFLUXDB_ORG: process.env.INFLUXDB_ORG || "motoguard",
  INFLUXDB_BUCKET: process.env.INFLUXDB_BUCKET || "motoguard_telemetry",

  // ─── PostgreSQL ─────────────────────────────────────────────────────────
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://motoguard:motoguard123@localhost:5432/motoguard",

  // ─── JWT ────────────────────────────────────────────────────────────────
  JWT_SECRET:
    process.env.JWT_SECRET || "motoguard-dev-secret-change-in-prod",
} as const;
