// =============================================================================
// MotoGuard IoT — Backend (Entry Point)
// =============================================================================
// Servidor Express com:
//   · Subscricao MQTT (recebe telemetria do simulador)
//   · WebSocket via Socket.IO (reencaminha para o frontend em tempo real)
//   · REST API (health, ultima telemetria, enviar comandos ao simulador)
//   · Servidor estatico (serve o build do frontend React em producao)
// =============================================================================

import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { setupStaticServing } from "./utils/setup-static-serving";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { mqttService } from "./services/mqtt.service";
import { socketService } from "./services/socket.service";
import { prisma } from "./services/prisma.service";
import { influxService } from "./services/influx.service";
import { perfLogger } from "./middleware/perf-logger.middleware";

// ─── Handlers globais de erros não capturados ────────────────────────────────
// Sem estes handlers, uma excepção não capturada (ex: evento 'error' num
// stream, rejeição de Promise sem .catch(), etc.) mata o processo inteiro.
// Com eles, o erro é registado e o servidor continua a correr.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Erro não capturado:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Promise rejeitada sem handler:", reason);
});

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(perfLogger);

app.use("/api", apiRoutes);

// ─── Serve frontend estático (Opção B / produção) ────────────────────────────
// Só activo se o build do React existir. Em dev (Opção A) é um no-op.
const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");
setupStaticServing(app, FRONTEND_DIST);

mqttService.connect();
socketService.init(server);

async function start() {
  try {
    await prisma.$connect();
    console.log("PostgreSQL conectado");
  } catch (err) {
    console.error("Falha ao conectar ao PostgreSQL:", err);
  }

  // Garantir que o bucket do InfluxDB existe (cria automaticamente se necessário)
  await influxService.ensureBucket();

  server.listen(env.PORT, () => {
    console.log(`MotoGuard Backend a correr na porta ${env.PORT}`);
    console.log(`Dashboard:    http://localhost:${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}/api/health`);
    console.log(
      `Telemetria:   http://localhost:${env.PORT}/api/telemetry/latest`,
    );
    console.log(`MQTT Broker:  ${env.MQTT_BROKER_URL}`);
  });
}

start();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
