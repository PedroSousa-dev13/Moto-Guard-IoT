"use strict";
// =============================================================================
// MotoGuard IoT â€” Backend (Entry Point)
// =============================================================================
// Servidor Express com:
//   Â· SubscriÃ§Ã£o MQTT (recebe telemetria do simulador)
//   Â· WebSocket via Socket.IO (reencaminha para o frontend em tempo real)
//   Â· REST API (health, Ãºltima telemetria, enviar comandos ao simulador)
//   Â· Servidor estÃ¡tico (serve o build do frontend React em produÃ§Ã£o)
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
const prisma_service_1 = require("./services/prisma.service");
// â”€â”€â”€ Express & HTTP Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// â”€â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Servir ficheiros estÃ¡ticos do build do frontend (produÃ§Ã£o)
const FRONTEND_DIST = path_1.default.join(__dirname, "..", "..", "frontend", "dist");
app.use(express_1.default.static(FRONTEND_DIST));
// â”€â”€â”€ API Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use("/api", routes_1.default);
// â”€â”€â”€ SPA Fallback (serve index.html para rotas nÃ£o-API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
        res.sendFile(path_1.default.join(FRONTEND_DIST, "index.html"));
    }
});
// â”€â”€â”€ Iniciar ServiÃ§os â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
mqtt_service_1.mqttService.connect();
socket_service_1.socketService.init(server);
// â”€â”€â”€ Arrancar Servidor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function start() {
    // Verificar ligaÃ§Ã£o ao PostgreSQL
    try {
        await prisma_service_1.prisma.$connect();
        console.log("âœ… PostgreSQL conectado");
    }
    catch (err) {
        console.error("âŒ Falha ao conectar ao PostgreSQL:", err);
    }
    server.listen(env_1.env.PORT, () => {
        console.log(`\nðŸï¸  MotoGuard Backend a correr na porta ${env_1.env.PORT}`);
        console.log(`   Dashboard:    http://localhost:${env_1.env.PORT}`);
        console.log(`   Health check: http://localhost:${env_1.env.PORT}/api/health`);
        console.log(`   Telemetria:   http://localhost:${env_1.env.PORT}/api/telemetry/latest`);
        console.log(`   MQTT Broker:  ${env_1.env.MQTT_BROKER_URL}\n`);
    });
}
start();
// â”€â”€â”€ Graceful Shutdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
process.on("SIGINT", async () => {
    await prisma_service_1.prisma.$disconnect();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await prisma_service_1.prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map