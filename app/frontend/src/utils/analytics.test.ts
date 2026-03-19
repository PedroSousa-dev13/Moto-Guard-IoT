import { describe, expect, it } from "vitest";
import { aggregateFeedSeries } from "./analytics";
import type { TripFeedItem } from "../types";

function makeFeed(partial: Partial<TripFeedItem>): TripFeedItem {
  return {
    id: partial.id ?? "t",
    startedAt: partial.startedAt ?? "2026-03-15T10:00:00.000Z",
    endedAt: partial.endedAt ?? "2026-03-15T11:00:00.000Z",
    status: partial.status ?? "COMPLETED",
    source: partial.source ?? "SIMULATOR",
    distanceKm: partial.distanceKm ?? 10,
    avgSpeedKmh: partial.avgSpeedKmh ?? 60,
    maxSpeedKmh: partial.maxSpeedKmh ?? 120,
    motorcycle: partial.motorcycle ?? { id: "m1", name: "Moto" },
    eventCounts:
      partial.eventCounts ??
      {
        total: 2,
        bySeverity: { INFO: 1, WARNING: 1, CRITICAL: 0 },
        byType: { HARD_BRAKING: 2 },
      },
    safetyScore: partial.safetyScore ?? 80,
    performanceScore: partial.performanceScore ?? 70,
    labels: partial.labels ?? [],
    buckets: partial.buckets ?? { safety: "good", performance: "warn" },
  };
}

describe("aggregateFeedSeries", () => {
  it("aggregates by day and filters by range", () => {
    const feed = [
      makeFeed({ id: "a", startedAt: "2026-03-10T12:00:00.000Z", distanceKm: 10, eventCounts: { total: 1, bySeverity: { INFO: 1, WARNING: 0, CRITICAL: 0 }, byType: {} }, safetyScore: 90, avgSpeedKmh: 50 }),
      makeFeed({ id: "b", startedAt: "2026-03-10T18:00:00.000Z", distanceKm: 20, eventCounts: { total: 3, bySeverity: { INFO: 1, WARNING: 2, CRITICAL: 0 }, byType: {} }, safetyScore: 70, avgSpeedKmh: 70 }),
      makeFeed({ id: "c", startedAt: "2026-03-11T09:00:00.000Z", distanceKm: 5, eventCounts: { total: 2, bySeverity: { INFO: 0, WARNING: 1, CRITICAL: 1 }, byType: {} }, safetyScore: 60, avgSpeedKmh: 30 }),
    ];

    const out = aggregateFeedSeries(feed, {
      range: "custom",
      granularity: "day",
      customFrom: "2026-03-10",
      customTo: "2026-03-11",
      now: new Date("2026-03-20T00:00:00.000Z"),
    });

    expect(out.filtered.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
    expect(out.points).toHaveLength(2);
    expect(out.points[0].distanceKm).toBe(30);
    expect(out.points[0].events).toBe(4);
    expect(out.points[0].safetyAvg).toBe(80);
    expect(out.points[0].avgSpeed).toBe(60);
  });
});

