// =============================================================================
// MotoGuard IoT — Serviço: Telemetry Store
// =============================================================================
// Armazena a telemetria mais recente em memória e mantém contadores.
// Ponto único de acesso ao estado partilhado entre serviços e controllers.
// =============================================================================

import type { TelemetryPayload, BackendStatus } from "../models/telemetry.model";

class TelemetryStore {
  private _latestByDevice = new Map<string, TelemetryPayload>();
  private _count = 0;

  /** Atualiza com novo payload recebido do MQTT */
  update(payload: TelemetryPayload): void {
    const deviceId = payload.system?.device_id;
    if (deviceId) {
      this._latestByDevice.set(deviceId, payload);
    }
    this._count++;
  }

  /** Último payload recebido (qualquer device) */
  get latest(): TelemetryPayload | null {
    if (this._latestByDevice.size === 0) return null;
    let latest: TelemetryPayload | null = null;
    let latestTime = 0;
    for (const payload of this._latestByDevice.values()) {
      const t = new Date(payload.system?.timestamp || 0).getTime();
      if (t > latestTime) {
        latestTime = t;
        latest = payload;
      }
    }
    return latest;
  }

  /** Total de mensagens recebidas desde o arranque */
  get count(): number {
    return this._count;
  }

  /** Indica se já existe pelo menos um payload recebido */
  get hasData(): boolean {
    return this._latestByDevice.size > 0;
  }

  /** Estado resumido para enviar ao frontend */
  getStatus(mqttConnected: boolean): BackendStatus {
    return {
      mqttConnected,
      telemetryCount: this._count,
      hasData: this.hasData,
    };
  }

  clearLatest(): void {
    this._latestByDevice.clear();
  }

  clearLatestIfDevice(deviceId: string | null): void {
    if (!deviceId) return;
    this._latestByDevice.delete(deviceId);
  }
}

// Exporta instância singleton
export const telemetryStore = new TelemetryStore();
