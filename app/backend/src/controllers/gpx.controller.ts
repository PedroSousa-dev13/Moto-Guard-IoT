import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import { prisma } from "../services/prisma.service";
import { Prisma } from "../generated/prisma/client";
import type { AuthRequest } from "../middleware/auth.middleware";
import { parseGpx, type ParsedGpx } from "../services/gpx-import.service";
import { influxService } from "../services/influx.service";
import { categorizeTripById } from "../services/trip-categorization.service";

type GpxImportRequest = AuthRequest & { file?: Express.Multer.File };

// Type for the new parse endpoint response
interface ParsedGpxRoute extends ParsedGpx {
  simulatorRoute: {
    start: { latitude: number; longitude: number };
    end: { latitude: number; longitude: number };
    loop: boolean;
  };
}

interface GpxParseResult {
  success: boolean;
  route?: ParsedGpxRoute;
  error?: string;
  validationErrors?: string[];
}

interface GpxWaypointPayload {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

interface SaveSimulatorGpxPayload {
  tripId?: string;
  filename?: string;
  fileSize?: number;
  waypoints?: GpxWaypointPayload[];
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  totalTime?: number;
}

const ALLOWED_MIME_TYPES = ["application/gpx+xml", "application/xml", "text/xml"];

function isValidGpxMimeType(mime: string | undefined): boolean {
  if (!mime) return false;
  return ALLOWED_MIME_TYPES.includes(mime.toLowerCase());
}

function badRequest(message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = 400;
  return err;
}

function normalizeWaypoints(input: GpxWaypointPayload[] = []): GpxWaypointPayload[] {
  const out: GpxWaypointPayload[] = [];
  for (const pt of input) {
    const lat = Number(pt?.lat);
    const lon = Number(pt?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      lat,
      lon,
      ele: Number.isFinite(Number(pt?.ele)) ? Number(pt?.ele) : undefined,
      time: typeof pt?.time === "string" ? pt.time : undefined,
    });
  }
  return out;
}

function computeBounds(waypoints: GpxWaypointPayload[]): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const pt of waypoints) {
    minLat = Math.min(minLat, pt.lat);
    maxLat = Math.max(maxLat, pt.lat);
    minLon = Math.min(minLon, pt.lon);
    maxLon = Math.max(maxLon, pt.lon);
  }

  return { minLat, maxLat, minLon, maxLon };
}

export async function saveSimulatorGpxData(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const payload = (req.body ?? {}) as SaveSimulatorGpxPayload;
  const tripId = typeof payload.tripId === "string" ? payload.tripId.trim() : "";

  if (!tripId) {
    res.status(400).json({ error: "tripId em falta" });
    return;
  }

  const waypoints = normalizeWaypoints(payload.waypoints ?? []);
  if (waypoints.length === 0) {
    res.status(400).json({ error: "Waypoints inválidos ou vazios" });
    return;
  }

  try {
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId },
      select: { id: true, source: true },
    });

    if (!trip) {
      res.status(404).json({ error: "Viagem não encontrada" });
      return;
    }

    const bounds = payload.bounds && Number.isFinite(payload.bounds.minLat)
      ? payload.bounds
      : computeBounds(waypoints);

    const filename = `gpx-${randomUUID()}.gpx`;
    const fileSize = Number.isFinite(Number(payload.fileSize)) ? Number(payload.fileSize) : 0;
    const totalTime = Number.isFinite(Number(payload.totalTime)) ? Number(payload.totalTime) : null;

    const gpxData = await prisma.$transaction(async (tx) => {
      if (trip.source !== "GPX_IMPORTED") {
        await tx.trip.update({ where: { id: tripId }, data: { source: "GPX_IMPORTED" } });
      }

      return tx.gpxData.upsert({
        where: { tripId },
        update: {
          filename,
          fileSize,
          waypoints: waypoints as unknown as Prisma.InputJsonValue,
          bounds: bounds as unknown as Prisma.InputJsonValue,
          totalTime: totalTime ?? undefined,
        },
        create: {
          tripId,
          filename,
          fileSize,
          waypoints: waypoints as unknown as Prisma.InputJsonValue,
          bounds: bounds as unknown as Prisma.InputJsonValue,
          totalTime: totalTime ?? undefined,
        },
      });
    });

    res.status(201).json({ success: true, gpxDataId: gpxData.id });
  } catch (err) {
    console.error("[saveSimulatorGpxData] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function importGpx(req: GpxImportRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "Ficheiro GPX em falta (campo 'file')" });
    return;
  }

  const filename = file.originalname || "";
  if (!filename.toLowerCase().endsWith(".gpx")) {
    res.status(400).json({ error: "Apenas ficheiros .gpx são suportados" });
    return;
  }

  if (!isValidGpxMimeType(file.mimetype)) {
    res.status(400).json({ error: "Tipo de ficheiro não suportado" });
    return;
  }

  const requestedMotorcycleId =
    typeof req.body?.motorcycleId === "string" && req.body.motorcycleId.trim() !== ""
      ? req.body.motorcycleId.trim()
      : null;

  try {
    if (!requestedMotorcycleId) {
      res.status(400).json({ error: "Seleciona uma mota para associar a viagem GPX." });
      return;
    }

    let xml: string;
    try {
      xml = fs.readFileSync(file.path, "utf8");
    } catch {
      fs.unlink(file.path, () => {});
      res.status(400).json({ error: "Erro ao ler o ficheiro GPX" });
      return;
    }
    const parsed = parseGpx(xml);

    if (parsed.waypoints.length === 0) {
      res.status(400).json({ error: "O GPX não contém trackpoints (trkpt)" });
      return;
    }

    const startedAt = parsed.startedAt ?? new Date();
    const endedAt = parsed.endedAt ?? startedAt;

    const result = await prisma.$transaction(async (tx) => {
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
          filename: `gpx-${randomUUID()}.gpx`,
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
    categorizeTripById(result.tripId, userId).catch((err) => {
      console.error(`[trip-categorization] Erro ao categorizar viagem ${result.tripId}:`, err);
    });
  } catch (err) {
    const statusCode = typeof (err as Error & { statusCode?: number })?.statusCode === "number" ? (err as Error & { statusCode?: number }).statusCode : null;
    if (statusCode) {
      res.status(statusCode).json({ error: (err as Error).message });
      return;
    }
    console.error("[importGpx] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function parseGpxFile(req: GpxImportRequest, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({ 
      success: false, 
      error: "Ficheiro GPX em falta"
    });
    return;
  }

  const filename = file.originalname || "";
  if (!filename.toLowerCase().endsWith('.gpx')) {
    res.status(400).json({
      success: false,
      error: "Apenas ficheiros .gpx são suportados"
    });
    return;
  }

  if (!isValidGpxMimeType(file.mimetype)) {
    res.status(400).json({
      success: false,
      error: "Tipo de ficheiro não suportado"
    });
    return;
  }

  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    res.status(413).json({
      success: false,
      error: `Ficheiro demasiado grande (${Math.round(file.size / 1024 / 1024)}MB). Limite: 10MB`
    });
    return;
  }

  try {
    let xml: string;
    try {
      xml = fs.readFileSync(file.path, "utf8");
    } catch {
      fs.unlink(file.path, () => {});
      res.status(400).json({
        success: false,
        error: "Erro ao ler o ficheiro GPX"
      });
      return;
    }
    const parsed = parseGpx(xml);

    if (parsed.waypoints.length === 0) {
      res.status(400).json({
        success: false,
        error: "O GPX não contém trackpoints (trkpt) ou waypoints (wpt) válidos"
      });
      return;
    }

    if (parsed.waypoints.length < 2) {
      res.status(400).json({
        success: false,
        error: `O GPX deve conter pelo menos 2 waypoints (contém ${parsed.waypoints.length})`
      });
      return;
    }

    // Create simulator-compatible route format
    const firstWaypoint = parsed.waypoints[0];
    const lastWaypoint = parsed.waypoints[parsed.waypoints.length - 1];

    const route: ParsedGpxRoute = {
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

  } catch (err) {
    console.error("[parseGpxFile] Error parsing GPX:", err);
    
    // Handle XML parsing errors specifically
    if (err instanceof Error && err.message.includes('XML')) {
      res.status(400).json({
        success: false,
        error: "Formato GPX inválido — ficheiro corrompido ou XML inválido"
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "Erro interno ao processar o ficheiro GPX"
    });
  }
}

function safeFilename(name: string): string {
  const trimmed = (name || "export.gpx").trim();
  const sanitized = trimmed.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ");
  return sanitized.toLowerCase().endsWith(".gpx") ? sanitized : `${sanitized}.gpx`;
}

function toIsoTime(value: unknown): string | null {
  if (typeof value === "string" && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function buildGpx(params: {
  name: string;
  startedAt?: string | null;
  waypoints: Array<{ lat: number; lon: number; ele?: number | null; time?: string | null }>;
}): string {
  const header =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="MotoGuard IoT" xmlns="http://www.topografix.com/GPX/1/1">\n`;
  const metaTime = params.startedAt ? `<time>${params.startedAt}</time>` : "";
  const metadata = `<metadata><name>${escapeXml(params.name)}</name>${metaTime}</metadata>\n`;
  const seg =
    `<trk><name>${escapeXml(params.name)}</name><trkseg>\n` +
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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function exportTripGpx(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const tripId = req.params.tripId as string;

  try {
    const trip = await prisma.trip.findFirst({
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
    let waypoints: Array<{ lat: number; lon: number; ele?: number | null; time?: string | null }> = [];

    if (trip.gpxData?.waypoints) {
      const raw = trip.gpxData.waypoints as unknown;
      if (Array.isArray(raw)) {
        waypoints = raw
          .map((p) => ({
            lat: typeof p?.lat === "number" ? p.lat : null,
            lon: typeof p?.lon === "number" ? p.lon : null,
            ele: typeof p?.ele === "number" ? p.ele : null,
            time: toIsoTime(p?.time),
          }))
          .filter((p): p is { lat: number; lon: number; ele: number | null; time: string | null } => typeof p.lat === "number" && typeof p.lon === "number");
      }
    } else {
      const points = await influxService.queryTripTelemetry(
        trip.startedAt,
        trip.endedAt,
        trip.motorcycle?.deviceId,
      );

      waypoints = points
        .map((p) => ({
          lat: typeof p?.latitude === "number" ? (p.latitude as number) : null,
          lon: typeof p?.longitude === "number" ? (p.longitude as number) : null,
          time: toIsoTime(p?.time),
        }))
        .filter((p): p is { lat: number; lon: number; time: string | null } => typeof p.lat === "number" && typeof p.lon === "number");

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
    res.setHeader("Content-Disposition", `attachment; filename="motoguard-trip-${trip.id}.gpx"`);
    res.status(200).send(gpx);
  } catch (err) {
    console.error(`[GPX] Erro ao exportar viagem ${tripId}:`, (err as Error).message);
    res.status(500).json({ error: "Erro interno ao exportar GPX" });
  }
}
