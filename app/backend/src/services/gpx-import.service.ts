import { XMLParser } from "fast-xml-parser";

export type GpxWaypoint = { lat: number; lon: number; ele?: number; time?: string };
export type GpxBounds = { minLat: number; maxLat: number; minLon: number; maxLon: number };

export type ParsedGpx = {
  waypoints: GpxWaypoint[];
  bounds: GpxBounds;
  startedAt: Date | null;
  endedAt: Date | null;
  totalTimeSec: number | null;
  distanceKm: number;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
};

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeBoundsFromWaypoints(waypoints: GpxWaypoint[]): GpxBounds | null {
  if (waypoints.length === 0) return null;
  let minLat = waypoints[0].lat;
  let maxLat = waypoints[0].lat;
  let minLon = waypoints[0].lon;
  let maxLon = waypoints[0].lon;

  for (const p of waypoints) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }

  return { minLat, maxLat, minLon, maxLon };
}

export function parseGpx(xml: string): ParsedGpx {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
  });

  const parsed = parser.parse(xml) as any;
  const gpx = parsed?.gpx;

  const trks = asArray(gpx?.trk);
  const trkpts = trks.flatMap((trk) =>
    asArray(trk?.trkseg).flatMap((seg) => asArray(seg?.trkpt)),
  );

  const waypoints: GpxWaypoint[] = [];
  for (const pt of trkpts) {
    const lat = toNumber(pt?.["@_lat"]);
    const lon = toNumber(pt?.["@_lon"]);
    if (lat === null || lon === null) continue;
    const ele = toNumber(pt?.ele ?? null) ?? undefined;
    const timeStr = typeof pt?.time === "string" ? pt.time : undefined;
    waypoints.push({ lat, lon, ele, time: timeStr });
  }

  const metaBounds = gpx?.metadata?.bounds;
  const boundsFromMeta: GpxBounds | null =
    metaBounds && typeof metaBounds === "object"
      ? (() => {
          const maxLat = toNumber(metaBounds["@_maxlat"]);
          const maxLon = toNumber(metaBounds["@_maxlon"]);
          const minLat = toNumber(metaBounds["@_minlat"]);
          const minLon = toNumber(metaBounds["@_minlon"]);
          if (maxLat === null || maxLon === null || minLat === null || minLon === null) {
            return null;
          }
          return { minLat, maxLat, minLon, maxLon };
        })()
      : null;

  const bounds = boundsFromMeta ?? computeBoundsFromWaypoints(waypoints) ?? {
    minLat: 0,
    maxLat: 0,
    minLon: 0,
    maxLon: 0,
  };

  let startedAt: Date | null = null;
  let endedAt: Date | null = null;
  for (const p of waypoints) {
    const d = toDate(p.time);
    if (!d) continue;
    if (!startedAt || d < startedAt) startedAt = d;
    if (!endedAt || d > endedAt) endedAt = d;
  }

  const metaTime = toDate(gpx?.metadata?.time);
  if (!startedAt) startedAt = metaTime;
  if (!endedAt) endedAt = metaTime;

  const totalTimeSec =
    startedAt && endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : null;

  let distanceKm = 0;
  let maxSpeedKmh: number | null = null;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const dKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
    distanceKm += dKm;

    const ta = toDate(a.time);
    const tb = toDate(b.time);
    if (!ta || !tb) continue;
    const dtSec = (tb.getTime() - ta.getTime()) / 1000;
    if (dtSec <= 0) continue;
    const speedKmh = (dKm / dtSec) * 3600;
    if (maxSpeedKmh === null || speedKmh > maxSpeedKmh) maxSpeedKmh = speedKmh;
  }

  const avgSpeedKmh = totalTimeSec && totalTimeSec > 0 ? (distanceKm / totalTimeSec) * 3600 : null;

  return {
    waypoints,
    bounds,
    startedAt,
    endedAt,
    totalTimeSec,
    distanceKm,
    avgSpeedKmh,
    maxSpeedKmh,
  };
}

