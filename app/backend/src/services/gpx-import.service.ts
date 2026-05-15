import { XMLParser } from "fast-xml-parser";

export type GpxWaypoint = { lat: number; lon: number; ele?: number; time?: string };
export type GpxBounds = { minLat: number; maxLat: number; minLon: number; maxLon: number };
const MAX_WAYPOINTS = 100_000;

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

function isValidLatLon(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function waypointsFromRawPoints(raw: unknown[]): GpxWaypoint[] {
  const waypoints: GpxWaypoint[] = [];
  for (const pt of raw) {
    if (!pt || typeof pt !== "object") continue;
    const p = pt as Record<string, unknown>;
    const lat = toNumber(p["@_lat"]);
    const lon = toNumber(p["@_lon"]);
    if (lat === null || lon === null) continue;
    if (!isValidLatLon(lat, lon)) continue;
    const ele = toNumber(p.ele ?? null) ?? undefined;
    if (ele !== undefined && (ele < -500 || ele > 9000)) continue;
    const timeStr = typeof p.time === "string" ? p.time : undefined;
    waypoints.push({ lat, lon, ele, time: timeStr });
  }
  return waypoints;
}

/** Escolhe trkpt / rtept / wpt: muitos GPX têm a rota real em <rte> e um <trk> quase vazio. */
function pickBestWaypointSource(gpx: Record<string, unknown> | undefined): GpxWaypoint[] {
  if (!gpx) return [];

  const trks = asArray(gpx.trk);
  const trkpts = trks.flatMap((trk) =>
    asArray((trk as Record<string, unknown>)?.trkseg).flatMap((seg) =>
      asArray((seg as Record<string, unknown>)?.trkpt),
    ),
  );

  const rtes = asArray(gpx.rte);
  const rtepts = rtes.flatMap((rte) => asArray((rte as Record<string, unknown>)?.rtept));

  const wpts = asArray(gpx.wpt);

  const trkWaypoints = waypointsFromRawPoints(trkpts);
  const rteWaypoints = waypointsFromRawPoints(rtepts);
  const wptWaypoints = waypointsFromRawPoints(wpts);

  type Candidate = { pts: GpxWaypoint[]; prio: number };
  const candidates: Candidate[] = [
    { pts: trkWaypoints, prio: 3 },
    { pts: rteWaypoints, prio: 2 },
    { pts: wptWaypoints, prio: 1 },
  ].filter((c) => c.pts.length >= 2);

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (b.pts.length !== a.pts.length) return b.pts.length - a.pts.length;
      return b.prio - a.prio;
    });
    return candidates[0].pts;
  }

  if (trkWaypoints.length > 0) return trkWaypoints;
  if (rteWaypoints.length > 0) return rteWaypoints;
  return wptWaypoints;
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

  const parsed = parser.parse(xml) as { gpx?: Record<string, unknown> };
  const gpx = parsed?.gpx;

  const waypoints = pickBestWaypointSource(gpx);

  if (waypoints.length > MAX_WAYPOINTS) {
    waypoints.length = MAX_WAYPOINTS;
  }

  const metaBounds = (gpx?.metadata as Record<string, unknown> | undefined)?.bounds;
  const boundsFromMeta: GpxBounds | null =
    metaBounds && typeof metaBounds === "object"
      ? (() => {
          const b = metaBounds as Record<string, unknown>;
          const maxLat = toNumber(b["@_maxlat"]);
          const maxLon = toNumber(b["@_maxlon"]);
          const minLat = toNumber(b["@_minlat"]);
          const minLon = toNumber(b["@_minlon"]);
          if (maxLat === null || maxLon === null || minLat === null || minLon === null) {
            return null;
          }
          return { minLat, maxLat, minLon, maxLon };
        })()
      : null;

  const bounds =
    computeBoundsFromWaypoints(waypoints) ??
    boundsFromMeta ?? {
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

  const metaTime = toDate((gpx?.metadata as Record<string, unknown> | undefined)?.time);
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
