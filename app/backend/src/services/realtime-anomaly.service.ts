import { spawn } from "child_process";
import * as path from "path";
import { socketService } from "./socket.service";
import type { TelemetryPayload } from "../models/telemetry.model";

const ANOMALY_SCRIPT = path.resolve(process.cwd(), "..", "ml", "online_detector.py");

class RealtimeAnomalyService {
  private buffers = new Map<string, any[]>();
  private readonly BUFFER_SIZE = 100; // ~10 segundos a 10Hz
  private tickCounters = new Map<string, number>();

  /**
   * Processa nova telemetria para deteção de anomalias em tempo real.
   */
  async processTelemetry(payload: TelemetryPayload): Promise<void> {
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
    if (buffer.length < 20) return;

    // 2. Invocar ML em tempo real
    try {
      const result = await this.runRealtimeInference(buffer);
      
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
      // Ignorar erros silenciosamente em RT para não inundar logs
    }
  }

  private runRealtimeInference(points: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const proc = spawn("python", [ANOMALY_SCRIPT], {
        env: {
          ...process.env,
          PYTHONPATH: path.resolve(process.cwd(), "..", "ml"),
        },
      });

      let stdout = "";
      proc.stdout.on("data", (data) => { stdout += data.toString(); });
      
      proc.on("close", (code) => {
        if (code !== 0) return reject(new Error("Script failed"));
        try {
          resolve(JSON.parse(stdout));
        } catch (err) {
          reject(new Error("Parse failed"));
        }
      });

      proc.stdin.write(JSON.stringify(points));
      proc.stdin.end();
    });
  }
}

export const realtimeAnomalyService = new RealtimeAnomalyService();
