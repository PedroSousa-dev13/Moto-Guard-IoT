import http from "http";
declare class SocketService {
    private io;
    private _connectedClients;
    private tripActiveByDevice;
    private stationaryTicksByDevice;
    private lastEventStatusByDevice;
    private static readonly TRIP_START_SPEED_KMH;
    private static readonly TRIP_END_SPEED_KMH;
    private static readonly TRIP_END_STATIONARY_TICKS;
    /** Número de clientes WebSocket ligados */
    get connectedClients(): number;
    /** Inicializa o Socket.IO com o servidor HTTP */
    init(httpServer: http.Server): void;
    private handleAlertEvent;
    private handleTripLifecycle;
    private normalizeEventStatus;
}
export declare const socketService: SocketService;
export {};
//# sourceMappingURL=socket.service.d.ts.map