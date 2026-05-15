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
import { swaggerSpec } from "./config/swagger";
import swaggerUi from "swagger-ui-express";
import apiRoutes from "./routes";
import { mqttService } from "./services/mqtt.service";
import { socketService } from "./services/socket.service";
import { prisma } from "./services/prisma.service";
import { influxService } from "./services/influx.service";
import { realtimeAnomalyService } from "./services/realtime-anomaly.service";
import { perfLogger } from "./middleware/perf-logger.middleware";

// ─── Limpeza periódica de tokens de reset expirados ─────────────────────────
const RESET_TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hora
let resetTokenCleanupTimer: NodeJS.Timeout | null = null;

async function cleanupExpiredResetTokens(): Promise<void> {
  try {
    // Tokens de reset têm validade de 24h (definido em auth-reset.controller.ts).
    // Limpamos tokens que existem há mais de 25h para dar margem de segurança.
    // NOTA: Usamos um campo dedicado `resetToken` como proxy — se o token existe
    // e o user não fez reset em 25h, assumimos que expirou.
    const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const result = await prisma.user.updateMany({
      where: { resetToken: { not: null }, createdAt: { lt: cutoff } },
      data: { resetToken: null },
    });
    if (result.count > 0) {
      console.log(`[cleanup] Limpos ${result.count} token(s) de reset expirados`);
    }
  } catch (err) {
    console.error("[cleanup] Erro ao limpar tokens expirados:", err);
  }
}

// ─── Handlers globais de erros não capturados ────────────────────────────────
// Após uma exceção não capturada, o processo fica num estado indefinido.
// Registamos o erro e terminamos para que o process manager (PM2, systemd, etc.)
// possa reiniciar o serviço limpo.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Erro não capturado:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Promise rejeitada sem handler:", reason);
  process.exit(1);
});

export const app = express();
export const server = http.createServer(app);

app.use(cors({
  origin: env.NODE_ENV === 'production' ? env.APP_URL : ['http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(perfLogger);

if (env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));
}

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
    console.error("Falha crítica ao conectar ao PostgreSQL. A terminar:", err);
    process.exit(1);
  }

  // Garantir que o bucket do InfluxDB existe (cria automaticamente se necessário)
  await influxService.ensureBucket();

  // Limpeza de tokens de reset expirados
  await cleanupExpiredResetTokens();
  resetTokenCleanupTimer = setInterval(cleanupExpiredResetTokens, RESET_TOKEN_CLEANUP_INTERVAL);

  server.listen(env.PORT, () => {
    console.log(`MotoGuard Backend a correr na porta ${env.PORT}`);
    console.log(`Swagger UI:   http://localhost:${env.PORT}/api-docs`);
    console.log(`Health check: http://localhost:${env.PORT}/api/health`);
    console.log(
      `Telemetria:   http://localhost:${env.PORT}/api/telemetry/latest`,
    );
    console.log(`MQTT Broker:  ${env.MQTT_BROKER_URL}`);
  });
}

if (env.NODE_ENV !== "test") {
  start();
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[shutdown] ${signal} recebido — a encerrar gracefulmente...`);

  const timeout = setTimeout(() => {
    console.error("[shutdown] Timeout — a forçar saída.");
    process.exit(1);
  }, 15_000);

  try {
    if (resetTokenCleanupTimer) clearInterval(resetTokenCleanupTimer);
    await Promise.all([
      socketService.stop(),
      mqttService.disconnect(),
      influxService.close(),
      prisma.$disconnect(),
      realtimeAnomalyService.dispose(),
    ]);
    console.log("[shutdown] Todos os serviços encerrados com sucesso.");
  } catch (err) {
    console.error("[shutdown] Erro ao encerrar serviços:", err);
  } finally {
    clearTimeout(timeout);
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
