import { type TripEvaluation } from "./trip-evaluation.service";
export interface TripMlPipelineResult extends TripEvaluation {
    ml: {
        enabled: boolean;
        model: string;
        notes: string;
    };
}
export declare function runTripMlPipeline(tripId: string, userId: string): Promise<TripMlPipelineResult | null>;
//# sourceMappingURL=trip-ml-pipeline.service.d.ts.map