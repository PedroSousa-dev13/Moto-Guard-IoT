import { describe, it, expect } from "vitest";
import { applyTripFilters, groupTripsBySource, paginate } from "./trips";
import type { Trip } from "../types";

function makeTrip(partial: Partial<Trip>): Trip {
  return {
    id: partial.id ?? "t",
    userId: partial.userId ?? "u",
    motorcycleId: partial.motorcycleId ?? "m1",
    source: partial.source ?? "SIMULATOR",
    startedAt: partial.startedAt ?? "2026-03-15T08:00:00.000Z",
    endedAt: partial.endedAt,
    distanceKm: partial.distanceKm,
    maxSpeedKmh: partial.maxSpeedKmh,
    avgSpeedKmh: partial.avgSpeedKmh,
    maxRollDeg: partial.maxRollDeg,
    maxGForce: partial.maxGForce,
    status: partial.status ?? "COMPLETED",
    createdAt: partial.createdAt ?? "2026-03-15T10:00:00.000Z",
    motorcycle: partial.motorcycle ?? { id: "m1", name: "Moto", brand: "X" },
    gpxData: partial.gpxData,
    events: partial.events,
    _count: partial._count,
  };
}

describe("applyTripFilters", () => {
  it("filters by status and motorcycle and date range", () => {
    const trips = [
      makeTrip({ id: "a", status: "ACTIVE", motorcycle: { id: "m1", name: "M1" }, startedAt: "2026-03-10T10:00:00.000Z" }),
      makeTrip({ id: "b", status: "COMPLETED", motorcycle: { id: "m2", name: "M2" }, startedAt: "2026-03-11T10:00:00.000Z" }),
      makeTrip({ id: "c", status: "COMPLETED", motorcycle: { id: "m1", name: "M1" }, startedAt: "2026-03-20T10:00:00.000Z" }),
    ];

    const out = applyTripFilters(trips, {
      status: "COMPLETED",
      motorcycleId: "m1",
      fromDate: "2026-03-01",
      toDate: "2026-03-15",
      onlyWithEvents: false,
    });

    expect(out).toEqual([]);
  });

  it("filters only trips with events (events or _count)", () => {
    const trips = [
      makeTrip({ id: "a", events: [] }),
      makeTrip({ id: "b", events: [{ id: "e1" } as any] }),
      makeTrip({ id: "c", events: undefined, _count: { events: 2 } }),
    ];

    const out = applyTripFilters(trips, {
      status: "ALL",
      motorcycleId: "ALL",
      fromDate: "",
      toDate: "",
      onlyWithEvents: true,
    });

    expect(out.map((t) => t.id)).toEqual(["b", "c"]);
  });
});

describe("paginate", () => {
  it("returns safe page and slices items", () => {
    const items = Array.from({ length: 21 }, (_, i) => i + 1);
    const p = paginate(items, 3, 10);
    expect(p.totalPages).toBe(3);
    expect(p.page).toBe(3);
    expect(p.items).toEqual([21]);
  });
});

describe("groupTripsBySource", () => {
  it("groups trips into three sources", () => {
    const trips = [
      makeTrip({ id: "a", source: "SIMULATOR" }),
      makeTrip({ id: "b", source: "GPX_IMPORTED" }),
      makeTrip({ id: "c", source: "DEVICE_REAL" }),
    ];
    const grouped = groupTripsBySource(trips);
    expect(grouped.SIMULATOR.map((t) => t.id)).toEqual(["a"]);
    expect(grouped.GPX_IMPORTED.map((t) => t.id)).toEqual(["b"]);
    expect(grouped.DEVICE_REAL.map((t) => t.id)).toEqual(["c"]);
  });
});

