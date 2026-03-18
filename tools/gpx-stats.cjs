const fs = require("node:fs");
const path = require("node:path");

const defaultGpx = path.join(
  __dirname,
  "..",
  "gpx_files",
  "pr2-cdv-trilho-do-carreiro-dos-ss-serra-montejunto.gpx",
);

const filePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultGpx;

const { parseGpx } = require(path.join(
  __dirname,
  "..",
  "app",
  "backend",
  "dist",
  "services",
  "gpx-import.service.js",
));

const xml = fs.readFileSync(filePath, "utf8");
const parsed = parseGpx(xml);

function toTimeMs(time) {
  if (!time) return null;
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

function haversineKm(lat1, lon1, lat2, lon2) {
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

const timed = parsed.waypoints
  .map((p) => ({ p, t: toTimeMs(p.time) }))
  .filter((x) => x.t !== null)
  .sort((a, b) => a.t - b.t);

let movingTimeSec = 0;
let movingDistanceKm = 0;
for (let i = 1; i < timed.length; i++) {
  const a = timed[i - 1];
  const b = timed[i];
  const dtSec = (b.t - a.t) / 1000;
  if (!(dtSec > 0)) continue;
  const dKm = haversineKm(a.p.lat, a.p.lon, b.p.lat, b.p.lon);
  const speedKmh = (dKm / dtSec) * 3600;
  if (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > 250) continue;
  if (dKm <= 0) continue;
  movingTimeSec += dtSec;
  movingDistanceKm += dKm;
}

const movingAvgSpeedKmh = movingTimeSec > 0 ? (movingDistanceKm / movingTimeSec) * 3600 : null;

process.stdout.write(
  JSON.stringify(
    {
      filePath,
      points: parsed.waypoints.length,
      startedAt: parsed.startedAt ? parsed.startedAt.toISOString() : null,
      endedAt: parsed.endedAt ? parsed.endedAt.toISOString() : null,
      totalTimeSec: parsed.totalTimeSec,
      distanceKm: parsed.distanceKm,
      avgSpeedKmh: parsed.avgSpeedKmh,
      maxSpeedKmh: parsed.maxSpeedKmh,
      movingTimeSec: Math.round(movingTimeSec),
      movingDistanceKm,
      movingAvgSpeedKmh,
    },
    null,
    2,
  ) + "\n",
);
