import http from "http";
export declare class SocketService {
    private io;
    private _connectedClients;
    private tripActiveByDevice;
    private stationaryTicksByDevice;
    private lastEventStatusByDevice;
    private pendingEmergenciesByDevice;
    private lastTelemetryByDevice;
    private activeTripIdByDevice;
    private lastStopHandledAtByDevice;
    private lastUserIdByDevice;
    private lastMotoModelByDevice;
    private tripStatsByDevice;
    private heuristicStateByDevice;
    private profileThresholdsCacheByDevice;
    private static readonly TRIP_START_SPEED_KMH;
    private static readonly TRIP_END_SPEED_KMH;
    private static readonly TRIP_END_STATIONARY_TICKS;
    /** Emitir evento para todos os clientes ligados */
    emit(event: string, data: any): void;
    /** Número de clientes WebSocket ligados */
    get connectedClients(): number;
    /** Inicializa o Socket.IO com o servidor HTTP */
    init(httpServer: http.Server): void;
    private getProfileThresholds;
    private handleHeuristicEvents;
    private handleAlertEvent;
    private handleTripLifecycle;
    private startTrip;
    private updateTripStats;
    private flushTripStats;
    private endTrip;
    private forceEndTripsOnStopCommand;
    private forceEndTrip;
    private clearRuntimeStateAfterStop;
    private clearDeviceRuntimeState;
    private createCompletedTripFromLastPayload;
    private createCompletedTripWithoutTelemetry;
    private ensureAssociationForDevice;
    /** Calcula distância em km entre coordenadas GPS */
    private haversineDistance;
    private toRad;
    private normalizeEventStatus;
    private getEventTypeFromStatus;
    /** Persiste evento de risco na base de dados (etapa 1.12) */
    private persistTripEvent;
    private sendEmergencyEmail;
    private handleCancelEmergency;
    private mapStatusToEventType;
}
export declare const socketService: SocketService;
//# sourceMappingURL=socket.service.d.ts.map