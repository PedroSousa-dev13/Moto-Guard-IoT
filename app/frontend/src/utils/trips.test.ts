import { describe, it, expect } from "vitest";
import { applyTripFilters, listMotorcyclesForFilter, paginate, groupTripsBySource } from "./trips";
import type { Trip } from "../types";

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    source: "SIMULATOR",
    status: "COMPLETED",
    startedAt: "2024-06-01T10:00:00Z",
    endedAt: "2024-06-01T11:00:00Z",
    motorcycle: { id: "m1", name: "Bandit", brand: "Suzuki" } as any,
    events: [],
    _count: { events: 0 },
    ...overrides,
  } as Trip;
}

// ─── applyTripFilters ─────────────────────────────────────────────────────────

describe("applyTripFilters", () => {
  const base = {
    status: "ALL" as const,
    motorcycleId: "ALL",
    fromDate: "",
    toDate: "",
    onlyWithEvents: false,
  };

  it("returns all trips when all filters are ALL/empty", () => {
    const trips = [makeTrip({ id: "1" }), makeTrip({ id: "2" })];
    expect(applyTripFilters(trips, base)).toHaveLength(2);
  });

  it("filters by status COMPLETED", () => {
    const trips = [
      makeTrip({ id: "1", status: "COMPLETED" }),
      makeTrip({ id: "2", status: "ACTIVE" }),
      makeTrip({ id: "3", status: "CANCELLED" }),
    ];
    const result = applyTripFilters(trips, { ...base, status: "COMPLETED" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by status ACTIVE", () => {
    const trips = [makeTrip({ status: "ACTIVE" }), makeTrip({ status: "COMPLETED" })];
    expect(applyTripFilters(trips, { ...base, status: "ACTIVE" })).toHaveLength(1);
  });

  it("filters by motorcycleId", () => {
    const trips = [
      makeTrip({ id: "1", motorcycle: { id: "m1", name: "A" } as any }),
      makeTrip({ id: "2", motorcycle: { id: "m2", name: "B" } as any }),
    ];
    const result = applyTripFilters(trips, { ...base, motorcycleId: "m1" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by fromDate — excludes trips before the date", () => {
    const trips = [
      makeTrip({ id: "old", startedAt: "2024-01-01T10:00:00Z" }),
      makeTrip({ id: "new", startedAt: "2024-06-01T10:00:00Z" }),
    ];
    const result = applyTripFilters(trips, { ...base, fromDate: "2024-03-01" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("new");
  });

  it("filters by toDate — excludes trips after the date", () => {
    const trips = [
      makeTrip({ id: "old", startedAt: "2024-01-01T10:00:00Z" }),
      makeTrip({ id: "new", startedAt: "2024-12-01T10:00:00Z" }),
    ];
    const result = applyTripFilters(trips, { ...base, toDate: "2024-06-01" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("old");
  });

  it("filters onlyWithEvents using events array", () => {
    const trips = [
      makeTrip({ id: "no-ev", events: [] }),
      makeTrip({ id: "has-ev", events: [{ id: "e1" } as any] }),
    ];
    const result = applyTripFilters(trips, { ...base, onlyWithEvents: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("has-ev");
  });

  it("filters onlyWithEvents using _count.events fallback", () => {
    const trips = [
      makeTrip({ id: "no-ev", events: undefined as any, _count: { events: 0 } }),
      makeTrip({ id: "has-ev", events: undefined as any, _count: { events: 3 } }),
    ];
    const result = applyTripFilters(trips, { ...base, onlyWithEvents: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("has-ev");
  });

  it("combines multiple filters", () => {
    const trips = [
      makeTrip({ id: "1", status: "COMPLETED", startedAt: "2024-06-01T10:00:00Z", motorcycle: { id: "m1" } as any }),
      makeTrip({ id: "2", status: "ACTIVE", startedAt: "2024-06-01T10:00:00Z", motorcycle: { id: "m1" } as any }),
      makeTrip({ id: "3", status: "COMPLETED", startedAt: "2024-01-01T10:00:00Z", motorcycle: { id: "m1" } as any }),
    ];
    const result = applyTripFilters(trips, { ...base, status: "COMPLETED", fromDate: "2024-03-01" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });
});

// ─── listMotorcyclesForFilter ─────────────────────────────────────────────────

describe("listMotorcyclesForFilter", () => {
  it("returns unique motorcycles from trips", () => {
    const trips = [
      makeTrip({ motorcycle: { id: "m1", name: "A" } as any }),
      makeTrip({ motorcycle: { id: "m1", name: "A" } as any }),
      makeTrip({ motorcycle: { id: "m2", name: "B" } as any }),
    ];
    const result = listMotorcyclesForFilter(trips);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("excludes trips without motorcycle", () => {
    const trips = [
      makeTrip({ motorcycle: undefined as any }),
      makeTrip({ motorcycle: { id: "m1", name: "A" } as any }),
    ];
    expect(listMotorcyclesForFilter(trips)).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(listMotorcyclesForFilter([])).toHaveLength(0);
  });
});

// ─── paginate ─────────────────────────────────────────────────────────────────

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("returns first page correctly", () => {
    const result = paginate(items, 1, 3);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(4);
  });

  it("returns last page correctly", () => {
    const result = paginate(items, 4, 3);
    expect(result.items).toEqual([10]);
    expect(result.page).toBe(4);
  });

  it("clamps page to 1 when page < 1", () => {
    const result = paginate(items, 0, 5);
    expect(result.page).toBe(1);
    expect(result.items).toEqual([1, 2, 3, 4, 5]);
  });

  it("clamps page to totalPages when page > totalPages", () => {
    const result = paginate(items, 99, 5);
    expect(result.page).toBe(2);
    expect(result.items).toEqual([6, 7, 8, 9, 10]);
  });

  it("returns totalPages=1 for empty list", () => {
    const result = paginate([], 1, 10);
    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([]);
  });

  it("handles exact page size boundary", () => {
    const result = paginate([1, 2, 3], 1, 3);
    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([1, 2, 3]);
  });
});

// ─── groupTripsBySource ───────────────────────────────────────────────────────

describe("groupTripsBySource", () => {
  it("groups trips by source correctly", () => {
    const trips = [
      makeTrip({ id: "1", source: "SIMULATOR" }),
      makeTrip({ id: "2", source: "GPX_IMPORTED" }),
      makeTrip({ id: "3", source: "DEVICE_REAL" }),
      makeTrip({ id: "4", source: "SIMULATOR" }),
    ];
    const result = groupTripsBySource(trips);
    expect(result.SIMULATOR).toHaveLength(2);
    expect(result.GPX_IMPORTED).toHaveLength(1);
    expect(result.DEVICE_REAL).toHaveLength(1);
  });

  it("returns empty arrays for missing sources", () => {
    const result = groupTripsBySource([makeTrip({ source: "SIMULATOR" })]);
    expect(result.GPX_IMPORTED).toHaveLength(0);
    expect(result.DEVICE_REAL).toHaveLength(0);
  });
});
