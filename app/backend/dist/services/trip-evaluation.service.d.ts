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
export declare function evaluateTrip(tripId: string, userId: string): Promise<TripEvaluation | null>;
//# sourceMappingURL=trip-evaluation.service.d.ts.map