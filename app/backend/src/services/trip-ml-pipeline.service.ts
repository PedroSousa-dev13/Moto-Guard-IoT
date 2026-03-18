import { evaluateTrip, type TripEvaluation } from "./trip-evaluation.service";

export interface TripMlPipelineResult extends TripEvaluation {
  ml: {
    enabled: boolean;
    model: string;
    notes: string;
  };
}

export async function runTripMlPipeline(tripId: string, userId: string): Promise<TripMlPipelineResult | null> {
  const base = await evaluateTrip(tripId, userId);
  if (!base) return null;

  return {
    ...base,
    ml: {
      enabled: false,
      model: base.model,
      notes: "Pipeline ML ainda não está ativo; avaliação baseada em heurísticas.",
    },
  };
}

