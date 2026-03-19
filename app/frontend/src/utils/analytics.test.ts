import { describe, it, expect } from "vitest";
import { rangeWindow, computePeriodStats, aggregateFeedSeries } from "./analytics";
import type { TripFeedItem } from "../types";

const NOW = new Date("2024-06-15T12:00:00Z");

function makeItem(overrides: Partial<TripFeedItem> = {}): TripFeedItem {
  return {
    id: "t1",
    source: "SIMULATOR",
    status: "COMPLETED",
    startedAt: "2024-06-15T10:00:00Z",
    endedAt: "2024-06-15T11:00:00Z",
    distanceKm: 50,
    avgSpeedKmh: 80,
    maxSpeedKmh: 120,
    safetyScore: 90,
    performanceScore: 85,
    eventCounts: { total: 2, bySeverity: { CRITICAL: 1, WARNING: 1, INFO: 0 } },
    labels: [],
    motorcycle: { id: "m1", name: "Bandit" } as any,
    ...overrides,
  } as TripFeedItem;
}

// ─── rangeWindow ──────────────────────────────────────────────────────────────

describe("rangeWindow", () => {
  it("24h returns window of exactly 24 hours", () => {
    const { from, to } = rangeWindow("24h", NOW, "", "");
    expect(to.getTime() - from.getTime()).toBe(24 * 3600 * 1000);
  });

  it("7d returns window of exactly 7 days", () => {
    const { from, to } = rangeWindow("7d", NOW, "", "");
    expect(to.getTime() - from.getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it("30d returns window of exactly 30 days", () => {
    const { from, to } = rangeWindow("30d", NOW, "", "");
    expect(to.getTime() - from.getTime()).toBe(30 * 24 * 3600 * 1000);
  });

  it("365d returns window of exactly 365 days", () => {
    const { from, to } = rangeWindow("365d", NOW, "", "");
    expect(to.getTime() - from.getTime()).toBe(365 * 24 * 3600 * 1000);
  });

  it("custom uses provided dates", () => {
    const { from, to } = rangeWindow("custom", NOW, "2024-01-01", "2024-01-31");
    expect(from.getFullYear()).toBe(2024);
    expect(from.getMonth()).toBe(0); // January
    expect(to.getMonth()).toBe(0);
  });

  it("custom falls back to 7d when customFrom is empty", () => {
    const { from, to } = rangeWindow("custom", NOW, "", "");
    expect(to.getTime() - from.getTime()).toBe(7 * 24 * 3600 * 1000);
  });
});

// ─── computePeriodStats ───────────────────────────────────────────────────────

describe("computePeriodStats", () => {
  it("returns zeros for empty list", () => {
    const stats = computePeriodStats([]);
    expect(stats.trips).toBe(0);
    expect(stats.distanceKm).toBe(0);
    expect(stats.events).toBe(0);
    expect(stats.safetyAvg).toBeNull();
    expect(stats.performanceAvg).toBeNull();
    expect(stats.avgSpeed).toBeNull();
  });

  it("sums distance correctly", () => {
    const items = [makeItem({ distanceKm: 30 }), makeItem({ distanceKm: 20 })];
    expect(computePeriodStats(items).distanceKm).toBe(50);
  });

  it("sums total events", () => {
    const items = [
      makeItem({ eventCounts: { total: 3, bySeverity: { CRITICAL: 1, WARNING: 2, INFO: 0 } } }),
      makeItem({ eventCounts: { total: 2, bySeverity: { CRITICAL: 0, WARNING: 1, INFO: 1 } } }),
    ];
    expect(computePeriodStats(items).events).toBe(5);
  });

  it("sums critical events", () => {
    const items = [
      makeItem({ eventCounts: { total: 2, bySeverity: { CRITICAL: 2, WARNING: 0, INFO: 0 } } }),
      makeItem({ eventCounts: { total: 1, bySeverity: { CRITICAL: 1, WARNING: 0, INFO: 0 } } }),
    ];
    expect(computePeriodStats(items).criticalEvents).toBe(3);
  });

  it("computes safetyAvg correctly", () => {
    const items = [makeItem({ safetyScore: 80 }), makeItem({ safetyScore: 60 })];
    expect(computePeriodStats(items).safetyAvg).toBe(70);
  });

  it("computes performanceAvg correctly", () => {
    const items = [makeItem({ performanceScore: 90 }), makeItem({ performanceScore: 70 })];
    expect(computePeriodStats(items).performanceAvg).toBe(80);
  });

  it("computes avgSpeed correctly", () => {
    const items = [makeItem({ avgSpeedKmh: 100 }), makeItem({ avgSpeedKmh: 60 })];
    expect(computePeriodStats(items).avgSpeed).toBe(80);
  });

  it("counts trips correctly", () => {
    const items = [makeItem(), makeItem(), makeItem()];
    expect(computePeriodStats(items).trips).toBe(3);
  });
});

// ─── aggregateFeedSeries ──────────────────────────────────────────────────────

describe("aggregateFeedSeries", () => {
  const opts = {
    range: "7d" as const,
    granularity: "day" as const,
    customFrom: "",
    customTo: "",
    now: NOW,
  };

  it("filters out trips outside the window", () => {
    const items = [
      makeItem({ id: "in", startedAt: "2024-06-14T10:00:00Z" }),
      makeItem({ id: "out", startedAt: "2024-01-01T10:00:00Z" }),
    ];
    const { filtered } = aggregateFeedSeries(items, opts);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("in");
  });

  it("groups trips into daily buckets", () => {
    const items = [
      makeItem({ id: "1", startedAt: "2024-06-14T08:00:00Z", distanceKm: 10 }),
      makeItem({ id: "2", startedAt: "2024-06-14T18:00:00Z", distanceKm: 20 }),
      makeItem({ id: "3", startedAt: "2024-06-13T10:00:00Z", distanceKm: 5 }),
    ];
    const { points } = aggregateFeedSeries(items, opts);
    // Should have 2 buckets: June 13 and June 14
    expect(points).toHaveLength(2);
    const june14 = points.find((p) => new Date(p.t).getDate() === 14);
    expect(june14?.distanceKm).toBe(30);
    expect(june14?.tripCount).toBe(2);
  });

  it("computes safetyAvg per bucket", () => {
    const items = [
      makeItem({ startedAt: "2024-06-14T08:00:00Z", safetyScore: 80 }),
      makeItem({ startedAt: "2024-06-14T18:00:00Z", safetyScore: 60 }),
    ];
    const { points } = aggregateFeedSeries(items, opts);
    expect(points[0].safetyAvg).toBe(70);
  });

  it("returns empty points for empty feed", () => {
    const { points, filtered } = aggregateFeedSeries([], opts);
    expect(points).toHaveLength(0);
    expect(filtered).toHaveLength(0);
  });
});
