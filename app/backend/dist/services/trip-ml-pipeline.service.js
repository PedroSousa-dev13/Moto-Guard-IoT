"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTripMlPipeline = runTripMlPipeline;
const trip_evaluation_service_1 = require("./trip-evaluation.service");
async function runTripMlPipeline(tripId, userId) {
    const base = await (0, trip_evaluation_service_1.evaluateTrip)(tripId, userId);
    if (!base)
        return null;
    return {
        ...base,
        ml: {
            enabled: false,
            model: base.model,
            notes: "Pipeline ML ainda não está ativo; avaliação baseada em heurísticas.",
        },
    };
}
//# sourceMappingURL=trip-ml-pipeline.service.js.map