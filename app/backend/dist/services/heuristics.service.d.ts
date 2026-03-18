import type { TelemetryPayload } from "../models/telemetry.model";
import { EventSeverity, EventType } from "../generated/prisma/enums";
export interface MotorcycleProfileThresholds {
    maxSpeedKmh: number;
    typicalMaxRollDeg: number;
    crashRollThreshold: number;
    crashGForce: number;
    criticalTemp: number;
    criticalVoltage: number;
}
export interface HeuristicState {
    prevPayload: TelemetryPayload | null;
    gForceWindow: number[];
    overheatTicks: number;
    lowVoltageTicks: number;
    lastEventAtByType: Partial<Record<EventType, number>>;
    temps: number[];
    volts: number[];
    tiresFront: number[];
    tiresRear: number[];
}
export interface DetectedRiskEvent {
    type: EventType;
    severity: EventSeverity;
    message: string;
}
export interface RiskEvaluation {
    events: DetectedRiskEvent[];
}
export declare function createInitialHeuristicState(): HeuristicState;
export declare function evaluateTelemetryRisk(payload: TelemetryPayload, state: HeuristicState, profile: MotorcycleProfileThresholds, nowMs: number, dtSec: number): RiskEvaluation;
//# sourceMappingURL=heuristics.service.d.ts.map