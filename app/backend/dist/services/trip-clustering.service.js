"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripClusteringService = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const prisma_service_1 = require("./prisma.service");
const CLUSTERING_SCRIPT = path.resolve(process.cwd(), "..", "ml", "clustering.py");
class TripClusteringService {
    /**
     * Executa o clustering para todas as viagens de um utilizador.
     * Geralmente chamado após uma nova viagem ou periodicamente.
     */
    async clusterUserTrips(userId) {
        try {
            // 1. Procurar viagens com dados suficientes
            const trips = await prisma_service_1.prisma.trip.findMany({
                where: { userId, status: "COMPLETED" },
                include: {
                    motorcycle: { include: { profile: true } },
                    events: true,
                },
            });
            if (trips.length < 3) {
                console.log(`[clustering] Utilizador ${userId} tem apenas ${trips.length} viagens. Aguardando mais dados.`);
                return;
            }
            // 2. Preparar payload para o Python
            const payload = trips.map((t) => ({
                trip: {
                    id: t.id,
                    maxSpeedKmh: t.maxSpeedKmh ?? 0,
                    maxRollDeg: t.maxRollDeg ?? 0,
                    maxGForce: t.maxGForce ?? 0,
                    distanceKm: t.distanceKm ?? 0,
                    avgSpeedKmh: t.avgSpeedKmh ?? 0,
                    startedAt: t.startedAt.toISOString(),
                    endedAt: t.endedAt?.toISOString() ?? null,
                },
                events: t.events.map((e) => ({ type: e.type, severity: e.severity })),
                profile: t.motorcycle.profile ? {
                    maxSpeedKmh: t.motorcycle.profile.maxSpeedKmh,
                    typicalMaxRollDeg: t.motorcycle.profile.typicalMaxRollDeg,
                } : null,
            }));
            // 3. Invocar script Python
            const results = await this.runPythonClustering(payload);
            // 4. Atualizar base de dados
            const updates = results.map((res) => prisma_service_1.prisma.trip.update({
                where: { id: res.tripId },
                data: { drivingStyle: res.drivingStyle },
            }));
            await Promise.all(updates);
            console.log(`[clustering] Atualizados estilos de condução para ${updates.length} viagens do utilizador ${userId}`);
        }
        catch (err) {
            console.error("[clustering] Erro ao executar clustering:", err);
        }
    }
    runPythonClustering(payload) {
        return new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)("python", [CLUSTERING_SCRIPT], {
                env: {
                    ...process.env,
                    PYTHONPATH: path.resolve(process.cwd(), "..", "ml"),
                },
            });
            let stdout = "";
            let stderr = "";
            proc.stdout.on("data", (data) => { stdout += data.toString(); });
            proc.stderr.on("data", (data) => { stderr += data.toString(); });
            proc.on("close", (code) => {
                if (code !== 0) {
                    return reject(new Error(`Clustering script falhou (code ${code}): ${stderr}`));
                }
                try {
                    resolve(JSON.parse(stdout));
                }
                catch (err) {
                    reject(new Error("Falha ao parsear output do clustering"));
                }
            });
            proc.stdin.write(JSON.stringify(payload));
            proc.stdin.end();
        });
    }
}
exports.tripClusteringService = new TripClusteringService();
//# sourceMappingURL=trip-clustering.service.js.map