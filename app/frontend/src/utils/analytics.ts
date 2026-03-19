import type { TripFeedItem } from "../types";

export type PresetRange = "24h" | "7d" | "30d" | "custom";
export type Granularity = "hour" | "day";

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

function parseCustomDateInput(v: string): Date | null {
  if (!v) return null;
  const x = new Date(v + "T00:00:00");
  if (Number.isNaN(x.getTime())) return null;
  return x;
}

function rangeWindow(range: PresetRange, now: Date, customFrom: string, customTo: string) {
  const end = new Date(now);
  if (range === "24h") return { from: new Date(end.getTime() - 24 * 3600 * 1000), to: end };
  if (range === "7d") return { from: new Date(end.getTime() - 7 * 24 * 3600 * 1000), to: end };
  if (range === "30d") return { from: new Date(end.getTime() - 30 * 24 * 3600 * 1000), to: end };

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
    const base = opts.granularity === "hour" ? toStartOfHour(d) : toStartOfDay(d);
    return base.getTime();
  };

  const buckets = new Map<number, { t: number; distanceKm: number; events: number; safetySum: number; safetyN: number; speedSum: number; speedN: number }>();

  for (const item of filtered) {
    const started = new Date(item.startedAt);
    const key = bucketKey(started);
    const prev = buckets.get(key) ?? { t: key, distanceKm: 0, events: 0, safetySum: 0, safetyN: 0, speedSum: 0, speedN: 0 };
    prev.distanceKm += item.distanceKm ?? 0;
    prev.events += item.eventCounts?.total ?? 0;
    if (typeof item.safetyScore === "number") {
      prev.safetySum += item.safetyScore;
      prev.safetyN += 1;
    }
    if (typeof item.avgSpeedKmh === "number") {
      prev.speedSum += item.avgSpeedKmh;
      prev.speedN += 1;
    }
    buckets.set(key, prev);
  }

  const points = Array.from(buckets.values())
    .sort((a, b) => a.t - b.t)
    .map((b) => ({
      t: b.t,
      distanceKm: Number(b.distanceKm.toFixed(2)),
      events: b.events,
      safetyAvg: b.safetyN ? Number((b.safetySum / b.safetyN).toFixed(1)) : 0,
      avgSpeed: b.speedN ? Number((b.speedSum / b.speedN).toFixed(1)) : 0,
    }));

  return { filtered, points, window: win };
}

