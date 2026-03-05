/** Resultado da validação */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
/**
 * Valida a estrutura do payload de telemetria recebido do simulador.
 * Não valida tipos individuais — apenas presença dos blocos e campos.
 */
export declare function validateTelemetryPayload(data: unknown): ValidationResult;
//# sourceMappingURL=validate-telemetry.d.ts.map