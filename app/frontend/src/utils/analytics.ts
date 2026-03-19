import type { TripFeedItem } from "../types";

export type PresetRange = "24h" | "7d" | "30d" | "365d" | "custom";
export type Granularity = "hour" | "day" | "week";

function toStartOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toStartOfHour(d: Date) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}

function toStartOfWeek(d: Date) {
  const x = toStartOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function parseCustomDateInput(v: string): Date | null {
  if (!v) return null;
  const x = new Date(v + "T00:00:00");
  if (Number.isNaN(x.getTime())) return null;
  return x;
}

export function rangeWindow(
  range: PresetRange,
  now: Date,
  customFrom: string,
  customTo: string,
): { from: Date; to: Date } {
  const end = new Date(now);
  if (range === "24h") return { from: new Date(end.getTime() - 24 * 3600 * 1000), to: end };
  if (range === "7d") return { from: new Date(end.getTime() - 7 * 24 * 3600 * 1000), to: end };
  if (range === "30d") return { from: new Date(end.getTime() - 30 * 24 * 3600 * 1000), to: end };
  if (range === "365d") return { from: new Date(end.getTime() - 365 * 24 * 3600 * 1000), to: end };

  const f = parseCustomDateInput(customFrom);
  const t = parseCustomDateInput(customTo);
  const from = f ?? new Date(end.getTime() - 7 * 24 * 3600 * 1000);
  const to = t ? new Date(t.getTime() + 24 * 3600 * 1000 - 1) : end;
  return { from, to };
}

export function aggregateFeedSeries(
  feed: TripFeedItem[],
  opts: {
    range: PresetRange;
    granularity: Granularity;
    customFrom: string;
    customTo: string;
    now: Date;
  },
) {
  const win = rangeWindow(opts.range, opts.now, opts.customFrom, opts.customTo);
  const filtered = feed.filter((t) => {
    const ts = new Date(t.startedAt).getTime();
    return ts >= win.from.getTime() && ts <= win.to.getTime();
  });

  const bucketKey = (d: Date) => {
    if (opts.granularity === "hour") return toStartOfHour(d).getTime();
    if (opts.granularity === "week") return toStartOfWeek(d).getTime();
    return toStartOfDay(d).getTime();
  };

  type Bucket = {
    t: number;
    distanceKm: number;
    events: number;
    criticalEvents: number;
    warningEvents: number;
    infoEvents: number;
    safetySum: number;
    safetyN: number;
    speedSum: number;
    speedN: number;
    performanceSum: number;
    performanceN: number;
    tripCount: number;
  };

  const buckets = new Map<number, Bucket>();

  for (const item of filtered) {
    const started = new Date(item.startedAt);
    const key = bucketKey(started);
    const prev = buckets.get(key) ?? {
      t: key,
      distanceKm: 0,
      events: 0,
      criticalEvents: 0,
      warningEvents: 0,
      infoEvents: 0,
      safetySum: 0,
      safetyN: 0,
      speedSum: 0,
      speedN: 0,
      performanceSum: 0,
      performanceN: 0,
      tripCount: 0,
    };
    prev.distanceKm += item.distanceKm ?? 0;
    prev.events += item.eventCounts?.total ?? 0;
    prev.criticalEvents += item.eventCounts?.bySeverity?.CRITICAL ?? 0;
    prev.warningEvents += item.eventCounts?.bySeverity?.WARNING ?? 0;
    prev.infoEvents += item.eventCounts?.bySeverity?.INFO ?? 0;
    prev.tripCount += 1;
    if (typeof item.safetyScore === "number") {
      prev.safetySum += item.safetyScore;
      prev.safetyN += 1;
    }
    if (typeof item.avgSpeedKmh === "number") {
      prev.speedSum += item.avgSpeedKmh;
      prev.speedN += 1;
    }
    if (typeof item.performanceScore === "number") {
      prev.performanceSum += item.performanceScore;
      prev.performanceN += 1;
    }
    buckets.set(key, prev);
  }

  const points = Array.from(buckets.values())
    .sort((a, b) => a.t - b.t)
    .map((b) => ({
      t: b.t,
      distanceKm: Number(b.distanceKm.toFixed(2)),
      events: b.events,
      criticalEvents: b.criticalEvents,
      warningEvents: b.warningEvents,
      infoEvents: b.infoEvents,
      tripCount: b.tripCount,
      safetyAvg: b.safetyN ? Number((b.safetySum / b.safetyN).toFixed(1)) : 0,
      avgSpeed: b.speedN ? Number((b.speedSum / b.speedN).toFixed(1)) : 0,
      performanceAvg: b.performanceN ? Number((b.performanceSum / b.performanceN).toFixed(1)) : 0,
    }));

  return { filtered, points, window: win };
}

export function computePeriodStats(items: TripFeedItem[]) {
  const trips = items.length;
  const distanceKm = items.reduce((acc, t) => acc + (t.distanceKm ?? 0), 0);
  const events = items.reduce((acc, t) => acc + (t.eventCounts?.total ?? 0), 0);
  const criticalEvents = items.reduce((acc, t) => acc + (t.eventCounts?.bySeverity?.CRITICAL ?? 0), 0);
  const safetyScores = items.map((t) => t.safetyScore).filter((v) => typeof v === "number");
  const safetyAvg = safetyScores.length ? safetyScores.reduce((a, b) => a + b, 0) / safetyScores.length : null;
  const perfScores = items.map((t) => t.performanceScore).filter((v) => typeof v === "number");
  const performanceAvg = perfScores.length ? perfScores.reduce((a, b) => a + b, 0) / perfScores.length : null;
  const speedValues = items.map((t) => t.avgSpeedKmh).filter((v): v is number => typeof v === "number");
  const avgSpeed = speedValues.length ? speedValues.reduce((a, b) => a + b, 0) / speedValues.length : null;
  return { trips, distanceKm, events, criticalEvents, safetyAvg, performanceAvg, avgSpeed };
}
