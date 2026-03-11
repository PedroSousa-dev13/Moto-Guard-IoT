// =============================================================================
// MotoGuard IoT â€” Backend (Entry Point)
// =============================================================================
// Servidor Express com:
//   Â· SubscriÃ§Ã£o MQTT (recebe telemetria do simulador)
//   Â· WebSocket via Socket.IO (reencaminha para o frontend em tempo real)
//   Â· REST API (health, Ãºltima telemetria, enviar comandos ao simulador)
//   Â· Servidor estÃ¡tico (serve o build do frontend React em produÃ§Ã£o)
// =============================================================================

import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { mqttService } from "./services/mqtt.service";
import { socketService } from "./services/socket.service";
import { prisma } from "./services/prisma.service";

// â”€â”€â”€ Express & HTTP Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app = express();
const server = http.createServer(app);

// â”€â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(cors());
app.use(express.json());

// Servir ficheiros estÃ¡ticos do build do frontend (produÃ§Ã£o)
const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(FRONTEND_DIST));

// â”€â”€â”€ API Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use("/api", apiRoutes);

// â”€â”€â”€ SPA Fallback (serve index.html para rotas nÃ£o-API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  }
});

// â”€â”€â”€ Iniciar ServiÃ§os â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
mqttService.connect();
socketService.init(server);

// â”€â”€â”€ Arrancar Servidor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function start() {
  // Verificar ligaÃ§Ã£o ao PostgreSQL
  try {
    await prisma.$connect();
    console.log("âœ… PostgreSQL conectado");
  } catch (err) {
    console.error("âŒ Falha ao conectar ao PostgreSQL:", err);
  }

  server.listen(env.PORT, () => {
    console.log(`\nðŸï¸  MotoGuard Backend a correr na porta ${env.PORT}`);
    console.log(`   Dashboard:    http://localhost:${env.PORT}`);
    console.log(`   Health check: http://localhost:${env.PORT}/api/health`);
    console.log(`   Telemetria:   http://localhost:${env.PORT}/api/telemetry/latest`);
    console.log(`   MQTT Broker:  ${env.MQTT_BROKER_URL}\n`);
  });
}

start();

// â”€â”€â”€ Graceful Shutdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
