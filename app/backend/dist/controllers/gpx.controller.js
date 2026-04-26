"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importGpx = importGpx;
exports.parseGpxFile = parseGpxFile;
exports.exportTripGpx = exportTripGpx;
const prisma_service_1 = require("../services/prisma.service");
const gpx_import_service_1 = require("../services/gpx-import.service");
const influx_service_1 = require("../services/influx.service");
const trip_categorization_service_1 = require("../services/trip-categorization.service");
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
    const requestedMotorcycleId = typeof req.body?.motorcycleId === "string" && req.body.motorcycleId.trim() !== ""
        ? req.body.motorcycleId.trim()
        : null;
    try {
        if (!requestedMotorcycleId) {
            res.status(400).json({ error: "Seleciona uma mota para associar a viagem GPX." });
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
            // Verify user has at least one motorcycle (prevents GPX import for users without garage)
            const userMotorcycles = await tx.motorcycle.findMany({
                where: { userId },
                select: { id: true },
                take: 1,
            });
            if (userMotorcycles.length === 0) {
                throw badRequest("Não tens motas registadas. Adiciona uma mota na Garagem antes de importar um GPX.");
            }
            // Verify the requested motorcycle belongs to this user
            const motorcycle = await tx.motorcycle.findFirst({
                where: { id: requestedMotorcycleId, userId },
            });
            if (!motorcycle) {
                throw badRequest("Mota selecionada não encontrada ou não pertence ao utilizador");
            }
            const ensuredMotorcycle = motorcycle;
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
        // Fire-and-forget: categorize trip asynchronously
        (0, trip_categorization_service_1.categorizeTripById)(result.tripId, userId).catch((err) => {
            console.error(`[trip-categorization] Erro ao categorizar viagem ${result.tripId}:`, err);
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
async function parseGpxFile(req, res) {
    const file = req.file;
    if (!file) {
        res.status(400).json({
            success: false,
            error: "GPX file is required",
            validationErrors: ["No file provided in request"]
        });
        return;
    }
    // Validate file extension
    const filename = file.originalname || "";
    if (!filename.toLowerCase().endsWith('.gpx')) {
        res.status(400).json({
            success: false,
            error: "Only .gpx files are supported",
            validationErrors: ["File must have .gpx extension"]
        });
        return;
    }
    // Validate file size (10MB limit as per requirements)
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBytes) {
        res.status(413).json({
            success: false,
            error: "File size exceeds 10MB limit",
            validationErrors: [`File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum allowed size of 10MB`]
        });
        return;
    }
    try {
        const xml = file.buffer.toString("utf8");
        const parsed = (0, gpx_import_service_1.parseGpx)(xml);
        if (parsed.waypoints.length === 0) {
            res.status(400).json({
                success: false,
                error: "GPX file contains no valid waypoints",
                validationErrors: ["No trackpoints (trkpt) or waypoints (wpt) found in GPX file"]
            });
            return;
        }
        // Validate minimum waypoint requirement (at least 2 for route creation)
        if (parsed.waypoints.length < 2) {
            res.status(400).json({
                success: false,
                error: "GPX file must contain at least 2 waypoints",
                validationErrors: [`Found ${parsed.waypoints.length} waypoint(s), minimum 2 required for route creation`]
            });
            return;
        }
        // Create simulator-compatible route format
        const firstWaypoint = parsed.waypoints[0];
        const lastWaypoint = parsed.waypoints[parsed.waypoints.length - 1];
        const route = {
            ...parsed,
            simulatorRoute: {
                start: {
                    latitude: firstWaypoint.lat,
                    longitude: firstWaypoint.lon
                },
                end: {
                    latitude: lastWaypoint.lat,
                    longitude: lastWaypoint.lon
                },
                loop: false // GPX imports are never loops as per requirements
            }
        };
        res.status(200).json({
            success: true,
            route
        });
    }
    catch (err) {
        console.error("[parseGpxFile] Error parsing GPX:", err);
        // Handle XML parsing errors specifically
        if (err instanceof Error && err.message.includes('XML')) {
            res.status(400).json({
                success: false,
                error: "Invalid GPX file format",
                validationErrors: ["GPX file appears to be corrupted or contains invalid XML"]
            });
            return;
        }
        res.status(500).json({
            success: false,
            error: "Internal server error while processing GPX file"
        });
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