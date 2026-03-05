"use strict";
// =============================================================================
// MotoGuard IoT — Backend (Entry Point)
// =============================================================================
// Servidor Express com:
//   · Subscrição MQTT (recebe telemetria do simulador)
//   · WebSocket via Socket.IO (reencaminha para o frontend em tempo real)
//   · REST API (health, última telemetria, enviar comandos ao simulador)
//   · Servidor estático (serve o build do frontend React em produção)
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./config/env");
const routes_1 = __importDefault(require("./routes"));
const mqtt_service_1 = require("./services/mqtt.service");
const socket_service_1 = require("./services/socket.service");
// ─── Express & HTTP Server ──────────────────────────────────────────────────
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// ─── Middleware ──────────────────────────────────────────────────────────────
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Servir ficheiros estáticos do build do frontend (produção)
const FRONTEND_DIST = path_1.default.join(__dirname, "..", "..", "frontend", "dist");
app.use(express_1.default.static(FRONTEND_DIST));
// ─── API Routes ─────────────────────────────────────────────────────────────
app.use("/api", routes_1.default);
// ─── SPA Fallback (serve index.html para rotas não-API) ─────────────────────
app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
        res.sendFile(path_1.default.join(FRONTEND_DIST, "index.html"));
    }
});
// ─── Iniciar Serviços ───────────────────────────────────────────────────────
mqtt_service_1.mqttService.connect();
socket_service_1.socketService.init(server);
// ─── Arrancar Servidor ──────────────────────────────────────────────────────
server.listen(env_1.env.PORT, () => {
    console.log(`\n🏍️  MotoGuard Backend a correr na porta ${env_1.env.PORT}`);
    console.log(`   Dashboard:    http://localhost:${env_1.env.PORT}`);
    console.log(`   Health check: http://localhost:${env_1.env.PORT}/api/health`);
    console.log(`   Telemetria:   http://localhost:${env_1.env.PORT}/api/telemetry/latest`);
    console.log(`   MQTT Broker:  ${env_1.env.MQTT_BROKER_URL}\n`);
});
//# sourceMappingURL=index.js.map