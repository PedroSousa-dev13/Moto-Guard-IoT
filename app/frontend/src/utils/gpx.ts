export interface GpxPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

function toTimeMs(time?: string): number | null {
  if (!time) return null;
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
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

export interface DerivedGpxSample {
  t: number;
  time: string;
  lat: number;
  lon: number;
  ele: number | null;
  distanceKm: number;
  speedKmh: number | null;
}

export function deriveGpxSeries(points: GpxPoint[]): DerivedGpxSample[] {
  const timed = points
    .map((p) => ({ p, t: toTimeMs(p.time) }))
    .filter((x): x is { p: GpxPoint; t: number } => x.t !== null)
    .sort((a, b) => a.t - b.t);

  const out: DerivedGpxSample[] = [];
  let cumKm = 0;
  let prev: { lat: number; lon: number; t: number } | null = null;

  for (const { p, t } of timed) {
    let speedKmh: number | null = null;

    if (prev) {
      const dtSec = (t - prev.t) / 1000;
      const dKm = haversineKm(prev.lat, prev.lon, p.lat, p.lon);
      // Always accumulate distance; only compute speed when timing is valid
      cumKm += dKm;
      if (dtSec > 0) {
        const candidateSpeed = (dKm / dtSec) * 3600;
        if (Number.isFinite(candidateSpeed) && candidateSpeed >= 0 && candidateSpeed <= 250) {
          speedKmh = candidateSpeed;
        }
      }
    }

    out.push({
      t,
      time: new Date(t).toISOString(),
      lat: p.lat,
      lon: p.lon,
      ele: typeof p.ele === "number" ? p.ele : null,
      distanceKm: cumKm,
      speedKmh,
    });

    prev = { lat: p.lat, lon: p.lon, t };
  }

  return out;
}
