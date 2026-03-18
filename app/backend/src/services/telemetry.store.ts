// =============================================================================
// MotoGuard IoT — Serviço: Telemetry Store
// =============================================================================
// Armazena a telemetria mais recente em memória e mantém contadores.
// Ponto único de acesso ao estado partilhado entre serviços e controllers.
// =============================================================================

import type { TelemetryPayload, BackendStatus } from "../models/telemetry.model";

class TelemetryStore {
  private _latest: TelemetryPayload | null = null;
  private _count = 0;

  /** Atualiza com novo payload recebido do MQTT */
  update(payload: TelemetryPayload): void {
    this._latest = payload;
    this._count++;
  }

  /** Último payload recebido */
  get latest(): TelemetryPayload | null {
    return this._latest;
  }

  /** Total de mensagens recebidas desde o arranque */
  get count(): number {
    return this._count;
  }

  /** Indica se já existe pelo menos um payload recebido */
  get hasData(): boolean {
    return this._latest !== null;
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
    this._latest = null;
  }

  clearLatestIfDevice(deviceId: string | null): void {
    if (!deviceId) return;
    const latestDeviceId = this._latest?.system?.device_id ?? null;
    if (latestDeviceId === deviceId) {
      this._latest = null;
    }
  }
}

// Exporta instância singleton
export const telemetryStore = new TelemetryStore();
