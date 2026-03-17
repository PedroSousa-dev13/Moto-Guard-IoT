"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importGpx = importGpx;
const prisma_service_1 = require("../services/prisma.service");
const gpx_import_service_1 = require("../services/gpx-import.service");
async function importGpx(req, res) {
    const userId = req.userId;
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: "Ficheiro GPX em falta (campo 'file')" });
        return;
    }
    const requestedMotorcycleId = typeof req.body?.motorcycleId === "string" ? req.body.motorcycleId : null;
    try {
        const motorcycle = requestedMotorcycleId
            ? await prisma_service_1.prisma.motorcycle.findFirst({ where: { id: requestedMotorcycleId, userId } })
            : await prisma_service_1.prisma.motorcycle.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
        if (!motorcycle) {
            res.status(400).json({ error: "O utilizador não tem motas associadas" });
            return;
        }
        const xml = file.buffer.toString("utf8");
        const parsed = (0, gpx_import_service_1.parseGpx)(xml);
        if (parsed.waypoints.length === 0) {
            res.status(400).json({ error: "O GPX não contém trackpoints (trkpt)" });
            return;
        }
        const startedAt = parsed.startedAt ?? new Date();
        const endedAt = parsed.endedAt ?? startedAt;
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            const trip = await tx.trip.create({
                data: {
                    userId,
                    motorcycleId: motorcycle.id,
                    source: "GPX_IMPORTED",
                    startedAt,
                    endedAt,
                    status: "COMPLETED",
                    distanceKm: parsed.distanceKm,
                    maxSpeedKmh: parsed.maxSpeedKmh,
                    avgSpeedKmh: parsed.avgSpeedKmh,
                },
            });
            const gpxData = await tx.gpxData.create({
                data: {
                    tripId: trip.id,
                    filename: file.originalname || "import.gpx",
                    fileSize: file.size,
                    waypoints: parsed.waypoints,
                    bounds: parsed.bounds,
                    totalTime: parsed.totalTimeSec,
                },
            });
            return { tripId: trip.id, gpxDataId: gpxData.id };
        });
        res.status(201).json({
            tripId: result.tripId,
            gpxDataId: result.gpxDataId,
            stats: {
                points: parsed.waypoints.length,
                distanceKm: parsed.distanceKm,
                totalTimeSec: parsed.totalTimeSec,
                avgSpeedKmh: parsed.avgSpeedKmh,
                maxSpeedKmh: parsed.maxSpeedKmh,
            },
        });
    }
    catch (err) {
        console.error("[importGpx] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
//# sourceMappingURL=gpx.controller.js.map