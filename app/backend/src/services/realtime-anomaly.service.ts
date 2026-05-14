import { spawn } from "child_process";
import * as path from "path";
import { socketService } from "./socket.service";
import type { TelemetryPayload } from "../models/telemetry.model";

const ANOMALY_SCRIPT = path.resolve(__dirname, "..", "..", "..", "..", "ml", "online_detector.py");
const STALE_TTL_MS = 5 * 60 * 1000; // 5 min sem dados → buffer removido
const INFERENCE_TIMEOUT_MS = 10_000;

class RealtimeAnomalyService {
  private buffers = new Map<string, { data: any[]; lastSeen: number }>();
  private readonly BUFFER_SIZE = 100;
  private tickCounters = new Map<string, number>();
  private evictionTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.evictionTimer = setInterval(() => this.evictStaleBuffers(), 60_000);
  }

  /**
   * Remove buffers de dispositivos que não enviam dados há 5+ minutos.
   */
  private evictStaleBuffers(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [deviceId, entry] of this.buffers) {
      if (now - entry.lastSeen > STALE_TTL_MS) {
        this.buffers.delete(deviceId);
        this.tickCounters.delete(deviceId);
        evicted++;
      }
    }
    if (evicted > 0) {
      console.log(`[realtime-anomaly] Evicted ${evicted} stale buffer(s)`);
    }
  }

  /**
   * Limpa o buffer de um device específico (chamado quando a viagem termina).
   */
  clearDevice(deviceId: string): void {
    this.buffers.delete(deviceId);
    this.tickCounters.delete(deviceId);
  }

  /**
   * Liberta todos os recursos. Chamado no shutdown.
   */
  dispose(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    this.buffers.clear();
    this.tickCounters.clear();
  }

  /**
   * Processa nova telemetria para deteção de anomalias em tempo real.
   */
  async processTelemetry(payload: TelemetryPayload): Promise<void> {
    const deviceId = payload.system.device_id;
    const now = Date.now();
    
    // 1. Atualizar buffer circular
    let entry = this.buffers.get(deviceId);
    if (!entry) {
      entry = { data: [], lastSeen: now };
      this.buffers.set(deviceId, entry);
    }
    entry.lastSeen = now;
    entry.data.push({
      speedKmh: payload.telemetry.speed_kmh,
      rpm: payload.telemetry.rpm,
      rollDeg: payload.imu.roll_deg,
      gForce: payload.imu.g_force,
      temp: payload.telemetry.engine_temp_c,
      voltage: payload.telemetry.voltage
    });

    if (entry.data.length > this.BUFFER_SIZE) {
      entry.data.shift();
    }

    // 2. Throttling: Só analisar a cada 10 ticks (1Hz real) para poupar CPU
    let count = (this.tickCounters.get(deviceId) || 0) + 1;
    if (count < 10) {
      this.tickCounters.set(deviceId, count);
      return;
    }
    this.tickCounters.set(deviceId, 0);

    // Só analisar se tivermos dados suficientes no buffer
    if (entry.data.length < 20) return;

    // 3. Invocar ML em tempo real
    try {
      const result = await this.runRealtimeInference(entry.data);
      
      if (result.isAnomaly) {
        console.log(`[realtime-anomaly] ANOMALIA detetada em ${deviceId}: ${result.reason}`);
        socketService.emit("realtime_anomaly", {
          deviceId,
          reason: result.reason,
          score: result.anomalyScore,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn(`[realtime-anomaly] Erro ao analisar ${deviceId}:`, (err as Error).message);
    }
  }

  private runRealtimeInference(points: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const proc = spawn("python", [ANOMALY_SCRIPT], {
        env: {
          ...process.env,
          PYTHONPATH: path.resolve(__dirname, "..", "..", "..", "..", "ml"),
        },
      });

      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("Timeout"));
      }, INFERENCE_TIMEOUT_MS);

      let stdout = "";
      proc.stdout.on("data", (data) => { stdout += data.toString(); });
      
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`Script failed with code ${code}`));
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("Parse failed"));
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      proc.stdin.write(JSON.stringify(points));
      proc.stdin.end();
    });
  }
}

export const realtimeAnomalyService = new RealtimeAnomalyService();
