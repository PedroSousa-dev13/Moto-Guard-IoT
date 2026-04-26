export interface ClusteringResult {
    tripId: string;
    drivingStyle: "AGGRESSIVE" | "DEFENSIVE" | "ECONOMY";
    clusterId: number;
}
declare class TripClusteringService {
    /**
     * Executa o clustering para todas as viagens de um utilizador.
     * Geralmente chamado após uma nova viagem ou periodicamente.
     */
    clusterUserTrips(userId: string): Promise<void>;
    private runPythonClustering;
}
export declare const tripClusteringService: TripClusteringService;
export {};
//# sourceMappingURL=trip-clustering.service.d.ts.map