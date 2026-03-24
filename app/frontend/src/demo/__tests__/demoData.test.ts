import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  demoMotorcycles,
  demoTrips,
  demoAlerts,
  demoFeedItems,
  demoTelemetry,
} from "../demoData";

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("demoData — unit tests", () => {
  it("demoMotorcycles has length 2", () => {
    expect(demoMotorcycles).toHaveLength(2);
  });

  it("demoTrips has length 5", () => {
    expect(demoTrips).toHaveLength(5);
  });

  it("demoAlerts has 3 items with distinct severities", () => {
    expect(demoAlerts).toHaveLength(3);
    const severities = demoAlerts.map((a) => a.severity);
    expect(severities).toContain("INFO");
    expect(severities).toContain("WARNING");
    expect(severities).toContain("CRITICAL");
    // All distinct
    expect(new Set(severities).size).toBe(3);
  });

  it("demoFeedItems has length 5", () => {
    expect(demoFeedItems).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Property 3: invariantes temporais e de distância das viagens demo
// Feature: demo-mode, Property 3: invariantes temporais e de distância das viagens demo
// ---------------------------------------------------------------------------

describe("Property 3: invariantes temporais e de distância das viagens demo", () => {
  const completedTrips = demoTrips.filter((t) => t.status === "COMPLETED");

  it("all COMPLETED trips have startedAt < endedAt and distanceKm > 0", () => {
    fc.assert(
      fc.property(fc.constantFrom(...completedTrips), (trip) => {
        expect(new Date(trip.startedAt) < new Date(trip.endedAt!)).toBe(true);
        expect(trip.distanceKm).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: cobertura de telemetria por viagem
// Feature: demo-mode, Property 4: cobertura de telemetria por viagem
// ---------------------------------------------------------------------------

describe("Property 4: cobertura de telemetria por viagem", () => {
  it("every trip has at least 50 telemetry points", () => {
    fc.assert(
      fc.property(fc.constantFrom(...demoTrips), (trip) => {
        expect(demoTelemetry[trip.id].length).toBeGreaterThanOrEqual(50);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: conformidade de tipos dos dados demo
// Feature: demo-mode, Property 11: conformidade de tipos dos dados demo
// ---------------------------------------------------------------------------

describe("Property 11: conformidade de tipos dos dados demo", () => {
  it("all motorcycles have required fields", () => {
    fc.assert(
      fc.property(fc.constantFrom(...demoMotorcycles), (moto) => {
        expect(typeof moto.id).toBe("string");
        expect(typeof moto.userId).toBe("string");
        expect(typeof moto.name).toBe("string");
        expect(typeof moto.brand).toBe("string");
        expect(typeof moto.model).toBe("string");
        expect(typeof moto.year).toBe("number");
        expect(typeof moto.category).toBe("string");
        expect(typeof moto.createdAt).toBe("string");
        expect(typeof moto.updatedAt).toBe("string");
      }),
      { numRuns: 100 }
    );
  });

  it("all trips have required fields", () => {
    fc.assert(
      fc.property(fc.constantFrom(...demoTrips), (trip) => {
        expect(typeof trip.id).toBe("string");
        expect(typeof trip.userId).toBe("string");
        expect(typeof trip.motorcycleId).toBe("string");
        expect(typeof trip.startedAt).toBe("string");
        expect(typeof trip.distanceKm).toBe("number");
        expect(["COMPLETED", "ACTIVE", "CANCELLED"]).toContain(trip.status);
      }),
      { numRuns: 100 }
    );
  });

  it("all telemetry points have required numeric fields", () => {
    const allPoints = Object.values(demoTelemetry).flat();
    fc.assert(
      fc.property(fc.constantFrom(...allPoints), (point) => {
        expect(typeof point.speed_kmh).toBe("number");
        expect(typeof point.rpm).toBe("number");
        expect(typeof point.gear).toBe("number");
        expect(typeof point.latitude).toBe("number");
        expect(typeof point.longitude).toBe("number");
        expect(typeof point.time).toBe("string");
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: round-trip de serialização JSON dos dados demo
// Feature: demo-mode, Property 12: round-trip de serialização JSON dos dados demo
// ---------------------------------------------------------------------------

describe("Property 12: round-trip de serialização JSON dos dados demo", () => {
  it("trips and motorcycles survive JSON round-trip without data loss", () => {
    fc.assert(
      fc.property(fc.constantFrom(...demoTrips, ...demoMotorcycles), (obj) => {
        expect(JSON.parse(JSON.stringify(obj))).toEqual(obj);
      }),
      { numRuns: 100 }
    );
  });
});
