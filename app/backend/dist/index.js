"use strict";
// =============================================================================
// MotoGuard IoT — Backend (Entry Point)
// =============================================================================
// Servidor Express com:
//   · Subscricao MQTT (recebe telemetria do simulador)
//   · WebSocket via Socket.IO (reencaminha para o frontend em tempo real)
//   · REST API (health, ultima telemetria, enviar comandos ao simulador)
//   · Servidor estatico (serve o build do frontend React em producao)
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const setup_static_serving_1 = require("./utils/setup-static-serving");
const env_1 = require("./config/env");
const routes_1 = __importDefault(require("./routes"));
const mqtt_service_1 = require("./services/mqtt.service");
const socket_service_1 = require("./services/socket.service");
const prisma_service_1 = require("./services/prisma.service");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/api", routes_1.default);
// ─── Serve frontend estático (Opção B / produção) ────────────────────────────
// Só activo se o build do React existir. Em dev (Opção A) é um no-op.
const FRONTEND_DIST = path_1.default.join(__dirname, "..", "..", "frontend", "dist");
(0, setup_static_serving_1.setupStaticServing)(app, FRONTEND_DIST);
mqtt_service_1.mqttService.connect();
socket_service_1.socketService.init(server);
async function start() {
    try {
        await prisma_service_1.prisma.$connect();
        console.log("PostgreSQL conectado");
    }
    catch (err) {
        console.error("Falha ao conectar ao PostgreSQL:", err);
    }
    server.listen(env_1.env.PORT, () => {
        console.log(`MotoGuard Backend a correr na porta ${env_1.env.PORT}`);
        console.log(`Dashboard:    http://localhost:${env_1.env.PORT}`);
        console.log(`Health check: http://localhost:${env_1.env.PORT}/api/health`);
        console.log(`Telemetria:   http://localhost:${env_1.env.PORT}/api/telemetry/latest`);
        console.log(`MQTT Broker:  ${env_1.env.MQTT_BROKER_URL}`);
    });
}
start();
process.on("SIGINT", async () => {
    await prisma_service_1.prisma.$disconnect();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await prisma_service_1.prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map