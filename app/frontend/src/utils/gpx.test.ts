import { describe, it, expect } from "vitest";
import { deriveGpxSeries } from "./gpx";

describe("deriveGpxSeries", () => {
  it("derives distance and speed from trackpoints", () => {
    const series = deriveGpxSeries([
      { lat: 41.0, lon: -7.0, ele: 100, time: "2026-03-15T08:00:00.000Z" },
      { lat: 41.0, lon: -7.0009, ele: 105, time: "2026-03-15T08:01:00.000Z" },
      { lat: 41.0, lon: -7.0018, ele: 110, time: "2026-03-15T08:02:00.000Z" },
    ]);

    expect(series.length).toBe(3);
    expect(series[0].distanceKm).toBe(0);
    expect(series[0].speedKmh).toBeNull();
    expect(series[1].distanceKm).toBeGreaterThan(0);
    expect(series[1].speedKmh).toBeTypeOf("number");
    expect(series[2].distanceKm).toBeGreaterThan(series[1].distanceKm);
  });

  it("skips points without valid time", () => {
    const series = deriveGpxSeries([
      { lat: 41.0, lon: -7.0 },
      { lat: 41.0, lon: -7.1, time: "2026-03-15T08:00:00.000Z" },
    ]);
    expect(series.length).toBe(1);
  });

  it("sorts by time to avoid backward plots", () => {
    const series = deriveGpxSeries([
      { lat: 41.0, lon: -7.0, time: "2026-03-15T08:02:00.000Z" },
      { lat: 41.0, lon: -7.0009, time: "2026-03-15T08:00:00.000Z" },
      { lat: 41.0, lon: -7.0018, time: "2026-03-15T08:01:00.000Z" },
    ]);

    expect(series.map((s) => s.t)).toEqual([...series.map((s) => s.t)].sort((a, b) => a - b));
    for (let i = 1; i < series.length; i++) {
      expect(series[i].distanceKm).toBeGreaterThanOrEqual(series[i - 1].distanceKm);
    }
  });
});
