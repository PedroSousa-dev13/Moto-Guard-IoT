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
}

// Exporta instância singleton
export const telemetryStore = new TelemetryStore();
