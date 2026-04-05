export type TripCategory = "COMMUTE" | "WEEKEND_RIDE" | "TRACK_DAY" | "OFF_ROAD";
export interface CategorizationInput {
    trip: {
        distanceKm: number | null;
        avgSpeedKmh: number | null;
        maxSpeedKmh: number | null;
        maxRollDeg: number | null;
        maxGForce: number | null;
    };
    profile?: {
        maxSpeedKmh: number;
        typicalMaxRollDeg: number;
    } | null;
    eventCounts: Partial<Record<string, number>>;
}
export interface CategorizationResult {
    category: TripCategory;
    confidence: number;
    matchedRules: string[];
}
/**
 * Classifica uma viagem com base nas suas métricas e eventos.
 *
 * Quando o perfil está disponível, normaliza maxSpeedKmh e maxRollDeg
 * em relação aos valores do perfil antes de aplicar os limiares.
 *
 * Prioridade: TRACK_DAY > OFF_ROAD > WEEKEND_RIDE > COMMUTE
 */
export declare function categorizeTrip(input: CategorizationInput): CategorizationResult;
/**
 * Lê a viagem do Prisma, classifica-a e persiste category + categoryConfidence.
 *
 * Retorna null se:
 * - A viagem não existir ou não pertencer ao userId
 * - O status não for COMPLETED
 * - distanceKm e avgSpeedKmh forem ambos nulos (dados insuficientes)
 */
export declare function categorizeTripById(tripId: string, userId: string): Promise<CategorizationResult | null>;
//# sourceMappingURL=trip-categorization.service.d.ts.map