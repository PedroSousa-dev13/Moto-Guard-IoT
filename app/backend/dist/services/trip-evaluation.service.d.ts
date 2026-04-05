import { EventSeverity, EventType } from "../generated/prisma/enums";
export interface TripEvaluation {
    score: number;
    model: string;
    severityCounts: Record<EventSeverity, number>;
    typeCounts: Partial<Record<EventType, number>>;
    penalties: Array<{
        reason: string;
        points: number;
    }>;
}
export type TripEvaluationInput = {
    trip: {
        maxSpeedKmh?: number | null;
        maxRollDeg?: number | null;
        maxGForce?: number | null;
    };
    profile?: {
        maxSpeedKmh: number;
        typicalMaxRollDeg: number;
        crashRollThreshold: number;
        crashGForce: number;
    } | null;
    events: Array<{
        severity: EventSeverity;
        type: EventType;
    }>;
};
export declare function evaluateTripHeuristic(input: TripEvaluationInput): TripEvaluation;
//# sourceMappingURL=trip-evaluation.service.d.ts.map