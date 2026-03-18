"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importGpx = importGpx;
exports.exportTripGpx = exportTripGpx;
const prisma_service_1 = require("../services/prisma.service");
const gpx_import_service_1 = require("../services/gpx-import.service");
const influx_service_1 = require("../services/influx.service");
function badRequest(message) {
    const err = new Error(message);
    err.statusCode = 400;
    return err;
}
async function importGpx(req, res) {
    const userId = req.userId;
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: "Ficheiro GPX em falta (campo 'file')" });
        return;
    }
    const requestedMotorcycleId = typeof req.body?.motorcycleId === "string" ? req.body.motorcycleId : null;
    try {
        const xml = file.buffer.toString("utf8");
        const parsed = (0, gpx_import_service_1.parseGpx)(xml);
        if (parsed.waypoints.length === 0) {
            res.status(400).json({ error: "O GPX não contém trackpoints (trkpt)" });
            return;
        }
        const startedAt = parsed.startedAt ?? new Date();
        const endedAt = parsed.endedAt ?? startedAt;
        const result = await prisma_service_1.prisma.$transaction(async (tx) => {
            const motorcycle = requestedMotorcycleId
                ? await tx.motorcycle.findFirst({ where: { id: requestedMotorcycleId, userId } })
                : await tx.motorcycle.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
            const ensuredMotorcycle = motorcycle
                ? motorcycle
                : await tx.motorcycle.create({
                    data: {
                        userId,
                        name: "GPX Import",
                        brand: null,
                        year: null,
                        profileId: null,
                        deviceId: null,
                    },
                });
            if (requestedMotorcycleId && !motorcycle) {
                throw badRequest("Mota selecionada não encontrada");
            }
            const trip = await tx.trip.create({
                data: {
                    userId,
                    motorcycleId: ensuredMotorcycle.id,
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
        const statusCode = typeof err?.statusCode === "number" ? err.statusCode : null;
        if (statusCode) {
            res.status(statusCode).json({ error: err.message });
            return;
        }
        console.error("[importGpx] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
function safeFilename(name) {
    const trimmed = (name || "export.gpx").trim();
    const sanitized = trimmed.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ");
    return sanitized.toLowerCase().endsWith(".gpx") ? sanitized : `${sanitized}.gpx`;
}
function toIsoTime(value) {
    if (typeof value === "string" && value) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime()))
            return d.toISOString();
    }
    return null;
}
function buildGpx(params) {
    const header = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<gpx version="1.1" creator="MotoGuard IoT" xmlns="http://www.topografix.com/GPX/1/1">\n`;
    const metaTime = params.startedAt ? `<time>${params.startedAt}</time>` : "";
    const metadata = `<metadata><name>${escapeXml(params.name)}</name>${metaTime}</metadata>\n`;
    const seg = `<trk><name>${escapeXml(params.name)}</name><trkseg>\n` +
        params.waypoints
            .map((p) => {
            const ele = typeof p.ele === "number" ? `<ele>${p.ele}</ele>` : "";
            const t = p.time ? `<time>${p.time}</time>` : "";
            return `<trkpt lat="${p.lat}" lon="${p.lon}">${ele}${t}</trkpt>`;
        })
            .join("\n") +
        `\n</trkseg></trk>\n`;
    const footer = `</gpx>\n`;
    return header + metadata + seg + footer;
}
function escapeXml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
async function exportTripGpx(req, res) {
    const userId = req.userId;
    const tripId = req.params.tripId;
    const trip = await prisma_service_1.prisma.trip.findFirst({
        where: { id: tripId, userId },
        include: {
            gpxData: true,
            motorcycle: { select: { deviceId: true, name: true, brand: true } },
        },
    });
    if (!trip) {
        res.status(404).json({ error: "Viagem não encontrada" });
        return;
    }
    const nameParts = [
        "MotoGuard",
        trip.motorcycle?.name || null,
        trip.motorcycle?.brand || null,
    ].filter(Boolean);
    const gpxName = nameParts.join(" · ");
    const startedAtIso = trip.startedAt ? trip.startedAt.toISOString() : null;
    let filename = trip.gpxData?.filename || `trip-${trip.id}.gpx`;
    let waypoints = [];
    if (trip.gpxData?.waypoints) {
        const raw = trip.gpxData.waypoints;
        if (Array.isArray(raw)) {
            waypoints = raw
                .map((p) => ({
                lat: typeof p?.lat === "number" ? p.lat : null,
                lon: typeof p?.lon === "number" ? p.lon : null,
                ele: typeof p?.ele === "number" ? p.ele : null,
                time: toIsoTime(p?.time),
            }))
                .filter((p) => typeof p.lat === "number" && typeof p.lon === "number");
        }
    }
    else {
        const points = await influx_service_1.influxService.queryTripTelemetry(trip.startedAt, trip.endedAt, trip.motorcycle?.deviceId);
        waypoints = points
            .map((p) => ({
            lat: typeof p?.latitude === "number" ? p.latitude : null,
            lon: typeof p?.longitude === "number" ? p.longitude : null,
            time: toIsoTime(p?.time),
        }))
            .filter((p) => typeof p.lat === "number" && typeof p.lon === "number");
        filename = `motoguard-trip-${trip.id}.gpx`;
    }
    if (waypoints.length === 0) {
        res.status(400).json({ error: "Não há pontos GPS suficientes para exportar GPX" });
        return;
    }
    const gpx = buildGpx({
        name: gpxName || "MotoGuard Trip",
        startedAt: startedAtIso,
        waypoints,
    });
    res.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(filename)}"`);
    res.status(200).send(gpx);
}
//# sourceMappingURL=gpx.controller.js.map