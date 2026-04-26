"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeAnomalyService = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const socket_service_1 = require("./socket.service");
const ANOMALY_SCRIPT = path.resolve(process.cwd(), "..", "ml", "online_detector.py");
class RealtimeAnomalyService {
    buffers = new Map();
    BUFFER_SIZE = 100; // ~10 segundos a 10Hz
    tickCounters = new Map();
    /**
     * Processa nova telemetria para deteção de anomalias em tempo real.
     */
    async processTelemetry(payload) {
        const deviceId = payload.system.device_id;
        // 1. Atualizar buffer circular
        let buffer = this.buffers.get(deviceId) || [];
        buffer.push({
            speedKmh: payload.telemetry.speed_kmh,
            rpm: payload.telemetry.rpm,
            rollDeg: payload.imu.roll_deg,
            gForce: payload.imu.g_force,
            temp: payload.telemetry.engine_temp_c,
            voltage: payload.telemetry.voltage
        });
        if (buffer.length > this.BUFFER_SIZE) {
            buffer.shift();
        }
        this.buffers.set(deviceId, buffer);
        // 2. Throttling: Só analisar a cada 10 ticks (1Hz real) para poupar CPU
        let count = (this.tickCounters.get(deviceId) || 0) + 1;
        if (count < 10) {
            this.tickCounters.set(deviceId, count);
            return;
        }
        this.tickCounters.set(deviceId, 0);
        // Só analisar se tivermos dados suficientes no buffer
        if (buffer.length < 20)
            return;
        // 2. Invocar ML em tempo real
        try {
            const result = await this.runRealtimeInference(buffer);
            if (result.isAnomaly) {
                console.log(`[realtime-anomaly] ANOMALIA detetada em ${deviceId}: ${result.reason}`);
                socket_service_1.socketService.emit("realtime_anomaly", {
                    deviceId,
                    reason: result.reason,
                    score: result.anomalyScore,
                    timestamp: new Date().toISOString()
                });
            }
        }
        catch (err) {
            // Ignorar erros silenciosamente em RT para não inundar logs
        }
    }
    runRealtimeInference(points) {
        return new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)("python", [ANOMALY_SCRIPT], {
                env: {
                    ...process.env,
                    PYTHONPATH: path.resolve(process.cwd(), "..", "ml"),
                },
            });
            let stdout = "";
            proc.stdout.on("data", (data) => { stdout += data.toString(); });
            proc.on("close", (code) => {
                if (code !== 0)
                    return reject(new Error("Script failed"));
                try {
                    resolve(JSON.parse(stdout));
                }
                catch (err) {
                    reject(new Error("Parse failed"));
                }
            });
            proc.stdin.write(JSON.stringify(points));
            proc.stdin.end();
        });
    }
}
exports.realtimeAnomalyService = new RealtimeAnomalyService();
//# sourceMappingURL=realtime-anomaly.service.js.map