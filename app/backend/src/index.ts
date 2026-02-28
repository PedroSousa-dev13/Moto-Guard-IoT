// =============================================================================
// MotoGuard IoT — Backend (Entry Point)
// =============================================================================
// Servidor Express com:
//   · Subscrição MQTT (recebe telemetria do simulador)
//   · WebSocket via Socket.IO (reencaminha para o frontend em tempo real)
//   · REST API (health, última telemetria, enviar comandos ao simulador)
//   · Servidor estático (serve o build do frontend React em produção)
// =============================================================================

import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { mqttService } from "./services/mqtt.service";
import { socketService } from "./services/socket.service";

// ─── Express & HTTP Server ──────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Servir ficheiros estáticos do build do frontend (produção)
const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(FRONTEND_DIST));

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use("/api", apiRoutes);

// ─── SPA Fallback (serve index.html para rotas não-API) ─────────────────────
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  }
});

// ─── Iniciar Serviços ───────────────────────────────────────────────────────
mqttService.connect();
socketService.init(server);

// ─── Arrancar Servidor ──────────────────────────────────────────────────────
server.listen(env.PORT, () => {
  console.log(`\n🏍️  MotoGuard Backend a correr na porta ${env.PORT}`);
  console.log(`   Dashboard:    http://localhost:${env.PORT}`);
  console.log(`   Health check: http://localhost:${env.PORT}/api/health`);
  console.log(`   Telemetria:   http://localhost:${env.PORT}/api/telemetry/latest`);
  console.log(`   MQTT Broker:  ${env.MQTT_BROKER_URL}\n`);
});
