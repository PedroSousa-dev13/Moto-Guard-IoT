// =============================================================================
// MotoGuard IoT — Backend (Entry Point)
// =============================================================================
// Servidor Express com:
//   · Subscrição MQTT (recebe telemetria do simulador)
//   · WebSocket via Socket.IO (reencaminha para o frontend em tempo real)
//   · REST API (health, última telemetria, enviar comandos ao simulador)
//   · Servidor estático (serve o build do frontend React em produção)
// =============================================================================

const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const mqtt = require("mqtt");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ─── Socket.IO ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─── Estado em memória ──────────────────────────────────────────────────────
let latestTelemetry = null;       // último payload recebido do simulador
let telemetryCount = 0;           // total de mensagens recebidas
let mqttConnected = false;        // estado da ligação MQTT
let connectedClients = 0;         // clientes WebSocket ligados

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Servir ficheiros estáticos do build do frontend (produção)
const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(FRONTEND_DIST));

// ─── MQTT — Ligação ao Broker ───────────────────────────────────────────────
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const MQTT_USER = process.env.MQTT_USER || "backend";
const MQTT_PASS = process.env.MQTT_PASS || "backend123";
const MQTT_TOPIC_TELEMETRIA = process.env.MQTT_TOPIC_TELEMETRIA || "motoguard/telemetria";
const MQTT_TOPIC_COMANDO = process.env.MQTT_TOPIC_COMANDO || "motoguard/comando";

console.log(`\n📡 A ligar ao broker MQTT: ${MQTT_BROKER_URL}`);

const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
  username: MQTT_USER,
  password: MQTT_PASS,
  keepalive: 60,
  reconnectPeriod: 5000,
  clientId: `motoguard-backend-${Date.now()}`,
});

mqttClient.on("connect", () => {
  mqttConnected = true;
  console.log("✅ MQTT conectado ao broker");

  // Subscrever tópico de telemetria
  mqttClient.subscribe(MQTT_TOPIC_TELEMETRIA, { qos: 1 }, (err) => {
    if (err) {
      console.error("❌ Erro ao subscrever tópico de telemetria:", err.message);
    } else {
      console.log(`📥 Subscrito a: ${MQTT_TOPIC_TELEMETRIA}`);
    }
  });
});

mqttClient.on("error", (err) => {
  console.error("❌ Erro MQTT:", err.message);
});

mqttClient.on("offline", () => {
  mqttConnected = false;
  console.log("⚠️  MQTT desconectado — a tentar reconectar...");
});

mqttClient.on("reconnect", () => {
  console.log("🔄 MQTT a reconectar...");
});

// ─── MQTT — Processar Telemetria Recebida ───────────────────────────────────
mqttClient.on("message", (topic, message) => {
  if (topic === MQTT_TOPIC_TELEMETRIA) {
    try {
      const payload = JSON.parse(message.toString());
      latestTelemetry = payload;
      telemetryCount++;

      // Reencaminhar para todos os clientes WebSocket
      io.emit("telemetry_update", payload);

      // Log periódico (a cada 10 mensagens para não spammar)
      if (telemetryCount % 10 === 0) {
        const vel = payload?.telemetry?.speed_kmh ?? "?";
        const rpm = payload?.telemetry?.rpm ?? "?";
        const evento = payload?.system?.event_status ?? "?";
        console.log(
          `📊 [#${telemetryCount}] vel=${vel} km/h | rpm=${rpm} | evento=${evento} | clientes=${connectedClients}`
        );
      }
    } catch (err) {
      console.error("❌ Erro ao parsear telemetria:", err.message);
    }
  }
});

// ─── Socket.IO — Gestão de Clientes ─────────────────────────────────────────
io.on("connection", (socket) => {
  connectedClients++;
  console.log(`🔌 Cliente WebSocket conectado (${connectedClients} total)`);

  // Enviar estado atual imediatamente ao novo cliente
  socket.emit("status", {
    mqttConnected,
    telemetryCount,
    hasData: latestTelemetry !== null,
  });

  // Se já há telemetria, enviar a mais recente
  if (latestTelemetry) {
    socket.emit("telemetry_update", latestTelemetry);
  }

  // Receber comandos do frontend e reencaminhar via MQTT
  socket.on("send_command", (command) => {
    console.log("📤 Comando recebido do frontend:", JSON.stringify(command));
    if (mqttConnected) {
      mqttClient.publish(MQTT_TOPIC_COMANDO, JSON.stringify(command), { qos: 1 });
    } else {
      socket.emit("error_msg", { message: "MQTT não está conectado" });
    }
  });

  socket.on("disconnect", () => {
    connectedClients--;
    console.log(`🔌 Cliente desconectado (${connectedClients} restantes)`);
  });
});

// ─── REST API — Health Check ────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "motoguard-backend",
    timestamp: new Date().toISOString(),
    mqtt: {
      connected: mqttConnected,
      broker: MQTT_BROKER_URL,
      topic: MQTT_TOPIC_TELEMETRIA,
    },
    stats: {
      telemetryCount,
      connectedClients,
      hasData: latestTelemetry !== null,
    },
    environment: {
      influxdb: process.env.INFLUXDB_URL || "not configured",
      postgres: process.env.DATABASE_URL ? "configured" : "not configured",
    },
  });
});

// ─── REST API — Última Telemetria ───────────────────────────────────────────
app.get("/api/telemetry/latest", (req, res) => {
  if (!latestTelemetry) {
    return res.status(204).json({ message: "Sem dados de telemetria ainda" });
  }
  res.json({
    received_at: new Date().toISOString(),
    total_messages: telemetryCount,
    data: latestTelemetry,
  });
});

// ─── REST API — Enviar Comando ao Simulador ─────────────────────────────────
app.post("/api/command", (req, res) => {
  const command = req.body;

  if (!command || !command.acao) {
    return res.status(400).json({ error: "Campo 'acao' é obrigatório" });
  }

  if (!mqttConnected) {
    return res.status(503).json({ error: "MQTT não está conectado" });
  }

  mqttClient.publish(MQTT_TOPIC_COMANDO, JSON.stringify(command), { qos: 1 });
  console.log("📤 Comando enviado via REST:", JSON.stringify(command));
  res.json({ status: "sent", command });
});

// ─── Fallback — SPA routing (serve index.html para rotas não-API) ───────────
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  }
});

// ─── Arrancar servidor ──────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🏍️  MotoGuard Backend a correr na porta ${PORT}`);
  console.log(`   Dashboard:    http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Telemetria:   http://localhost:${PORT}/api/telemetry/latest`);
  console.log(`   MQTT Broker:  ${MQTT_BROKER_URL}\n`);
});
