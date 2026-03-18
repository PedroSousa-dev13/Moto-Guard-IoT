"use strict";
// =============================================================================
// MotoGuard IoT — Serviço: Telemetry Store
// =============================================================================
// Armazena a telemetria mais recente em memória e mantém contadores.
// Ponto único de acesso ao estado partilhado entre serviços e controllers.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.telemetryStore = void 0;
class TelemetryStore {
    _latest = null;
    _count = 0;
    /** Atualiza com novo payload recebido do MQTT */
    update(payload) {
        this._latest = payload;
        this._count++;
    }
    /** Último payload recebido */
    get latest() {
        return this._latest;
    }
    /** Total de mensagens recebidas desde o arranque */
    get count() {
        return this._count;
    }
    /** Indica se já existe pelo menos um payload recebido */
    get hasData() {
        return this._latest !== null;
    }
    /** Estado resumido para enviar ao frontend */
    getStatus(mqttConnected) {
        return {
            mqttConnected,
            telemetryCount: this._count,
            hasData: this.hasData,
        };
    }
    clearLatest() {
        this._latest = null;
    }
    clearLatestIfDevice(deviceId) {
        if (!deviceId)
            return;
        const latestDeviceId = this._latest?.system?.device_id ?? null;
        if (latestDeviceId === deviceId) {
            this._latest = null;
        }
    }
}
// Exporta instância singleton
exports.telemetryStore = new TelemetryStore();
//# sourceMappingURL=telemetry.store.js.map