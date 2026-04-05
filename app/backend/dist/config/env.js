"use strict";
// =============================================================================
// MotoGuard IoT — Configuração (Variáveis Externas)
// =============================================================================
// Centraliza todas as variáveis externas usadas pelo backend.
// Valores por defeito alinham com o docker-compose.yml.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.env = {
    // ─── Servidor ───────────────────────────────────────────────────────────
    PORT: parseInt(process.env.PORT || "3000", 10),
    NODE_ENV: process.env.NODE_ENV || "development",
    // ─── MQTT ───────────────────────────────────────────────────────────────
    MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
    MQTT_USER: process.env.MQTT_USER || "backend",
    MQTT_PASS: process.env.MQTT_PASS || "backend123",
    MQTT_TOPIC_TELEMETRIA: process.env.MQTT_TOPIC_TELEMETRIA || "motoguard/telemetria",
    MQTT_TOPIC_COMANDO: process.env.MQTT_TOPIC_COMANDO || "motoguard/comando",
    // ─── InfluxDB ───────────────────────────────────────────────────────────
    INFLUXDB_URL: process.env.INFLUXDB_URL || "http://localhost:8086",
    INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN || "motoguard-dev-token",
    INFLUXDB_ORG: process.env.INFLUXDB_ORG || "motoguard",
    INFLUXDB_BUCKET: process.env.INFLUXDB_BUCKET || "motoguard_telemetry",
    // ─── PostgreSQL ─────────────────────────────────────────────────────────
    DATABASE_URL: process.env.DATABASE_URL ||
        "postgresql://motoguard:motoguard123@localhost:5432/motoguard",
    // ─── JWT ────────────────────────────────────────────────────────────────
    JWT_SECRET: process.env.JWT_SECRET || "motoguard-dev-secret-change-in-prod",
    // ─── ML Pipeline ────────────────────────────────────────────────────────
    ML_ENABLED: process.env.ML_ENABLED === "true",
    ML_MODEL_PATH: process.env.ML_MODEL_PATH || "ml/models/isolation_forest.pkl",
    // ─── Email (Emergência via Resend) ──────────────────────────────────────
    RESEND_API_KEY: process.env.RESEND_API_KEY || "",
    RESEND_FROM: process.env.RESEND_FROM || "onboarding@resend.dev",
    APP_URL: process.env.APP_URL || "http://localhost:3000",
};
//# sourceMappingURL=env.js.map