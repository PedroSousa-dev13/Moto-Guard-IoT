import { type TripEvaluation } from "./trip-evaluation.service";
export interface ComparisonReport {
    heuristicScore: number;
    mlScore: number;
    scoreDelta: number;
    agreement: boolean;
    agreementLevel: "HIGH" | "MEDIUM" | "LOW";
    dominantFactors: string[];
    note: string | null;
}
export interface TripMlPipelineResult extends TripEvaluation {
    mlScore: number | null;
    mlFeedback: string;
    comparisonReport: ComparisonReport | null;
}
export interface MlStatusResult {
    enabled: boolean;
    modelLoaded: boolean;
    modelVersion: string | null;
    trainedAt: string | null;
    nSamples: number | null;
}
export declare function buildComparisonReport(heuristicScore: number, mlScore: number, dominantFactors: string[]): ComparisonReport;
export declare function runTripMlPipeline(tripId: string, userId: string): Promise<TripMlPipelineResult | null>;
export declare function getMlStatus(): Promise<MlStatusResult>;
//# sourceMappingURL=trip-ml-pipeline.service.d.ts.map