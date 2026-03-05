import http from "http";
declare class SocketService {
    private io;
    private _connectedClients;
    /** Número de clientes WebSocket ligados */
    get connectedClients(): number;
    /** Inicializa o Socket.IO com o servidor HTTP */
    init(httpServer: http.Server): void;
}
export declare const socketService: SocketService;
export {};
//# sourceMappingURL=socket.service.d.ts.map