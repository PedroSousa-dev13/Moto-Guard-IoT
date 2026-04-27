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
  // Check if we have at least some timing information
  const hasTiming = points.some(p => p.time && !Number.isNaN(new Date(p.time).getTime()));

  let timed: { p: GpxPoint; t: number }[] = [];

  if (hasTiming) {
    timed = points
      .map((p) => ({ p, t: toTimeMs(p.time) }))
      .filter((x): x is { p: GpxPoint; t: number } => x.t !== null)
      .sort((a, b) => a.t - b.t);
  } else {
    // If no timing, assign synthetic timing (1s apart) to allow plotting
    const now = Date.now();
    timed = points.map((p, i) => ({
      p,
      t: now + i * 1000
    }));
  }

  const out: DerivedGpxSample[] = [];
  let cumKm = 0;
  let prev: { lat: number; lon: number; t: number } | null = null;

  for (const { p, t } of timed) {
    let speedKmh: number | null = null;

    if (prev) {
      const dtSec = (t - prev.t) / 1000;
      const dKm = haversineKm(prev.lat, prev.lon, p.lat, p.lon);
      // Always accumulate distance
      cumKm += dKm;
      
      // Only compute speed if we have real timing or if it's our synthetic timing (which is always 1s)
      if (dtSec > 0) {
        const candidateSpeed = (dKm / dtSec) * 3600;
        // Basic filtering for realistic speeds (0-250 km/h)
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
