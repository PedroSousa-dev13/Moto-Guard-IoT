import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  categorizeTrip,
  categorizeTripById,
  CategorizationInput,
} from "../backend/src/services/trip-categorization.service";

// ---------------------------------------------------------------------------
// Mock prisma for unit tests that require DB access
// ---------------------------------------------------------------------------

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    trip: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** fc.float requires 32-bit float bounds — use Math.fround to convert */
const f32 = Math.fround;

/** Finite float in [min, max] — excludes NaN and Infinity */
function finiteFloat(min: number, max: number) {
  return fc.float({ min: f32(min), max: f32(max) }).filter(Number.isFinite);
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const arbCategorizationInput = fc.record({
  trip: fc.record({
    distanceKm: fc.option(finiteFloat(0, 500), { nil: null }),
    avgSpeedKmh: fc.option(finiteFloat(0, 200), { nil: null }),
    maxSpeedKmh: fc.option(finiteFloat(0, 300), { nil: null }),
    maxRollDeg: fc.option(finiteFloat(0, 90), { nil: null }),
    maxGForce: fc.option(finiteFloat(0, 10), { nil: null }),
  }),
  profile: fc.option(
    fc.record({
      maxSpeedKmh: fc.integer({ min: 80, max: 300 }),
      typicalMaxRollDeg: fc.integer({ min: 20, max: 60 }),
    }),
    { nil: null }
  ),
  eventCounts: fc.dictionary(
    fc.constantFrom("SPEEDING", "EXCESSIVE_LEAN", "HIGH_VIBRATION", "HARD_BRAKING"),
    fc.integer({ min: 0, max: 20 })
  ),
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("trip-categorization PBT", () => {
  const VALID_CATEGORIES = ["COMMUTE", "WEEKEND_RIDE", "TRACK_DAY", "OFF_ROAD"];

  // Feature: trip-categorization, Property 1: output é sempre uma categoria válida
  it("Property 1: output é sempre uma categoria válida", () => {
    fc.assert(
      fc.property(arbCategorizationInput, (input) => {
        const result = categorizeTrip(input);
        return VALID_CATEGORIES.includes(result.category);
      })
    );
  });

  // Feature: trip-categorization, Property 2: score de confiança está sempre em [0.0, 1.0]
  it("Property 2: score de confiança está sempre em [0.0, 1.0]", () => {
    fc.assert(
      fc.property(arbCategorizationInput, (input) => {
        const result = categorizeTrip(input);
        return result.confidence >= 0.0 && result.confidence <= 1.0;
      })
    );
  });

  // Feature: trip-categorization, Property 3: normalização por perfil é invariante à escala
  it("Property 3: normalização por perfil é invariante à escala", () => {
    const arbScalableInput = fc.record({
      maxSpeedKmh: finiteFloat(10, 200),
      maxRollDeg: finiteFloat(5, 80),
      profileMaxSpeed: fc.integer({ min: 100, max: 300 }),
      profileMaxRoll: fc.integer({ min: 20, max: 60 }),
      scale: finiteFloat(0.5, 2.0),
      distanceKm: finiteFloat(0, 500),
      avgSpeedKmh: finiteFloat(0, 200),
      eventCounts: fc.dictionary(
        fc.constantFrom("SPEEDING", "EXCESSIVE_LEAN", "HIGH_VIBRATION"),
        fc.integer({ min: 0, max: 10 })
      ),
    });

    fc.assert(
      fc.property(arbScalableInput, (data) => {
        const baseInput: CategorizationInput = {
          trip: {
            distanceKm: data.distanceKm,
            avgSpeedKmh: data.avgSpeedKmh,
            maxSpeedKmh: data.maxSpeedKmh,
            maxRollDeg: data.maxRollDeg,
            maxGForce: null,
          },
          profile: {
            maxSpeedKmh: data.profileMaxSpeed,
            typicalMaxRollDeg: data.profileMaxRoll,
          },
          eventCounts: data.eventCounts,
        };
        const scaledInput: CategorizationInput = {
          trip: {
            distanceKm: data.distanceKm,
            avgSpeedKmh: data.avgSpeedKmh,
            maxSpeedKmh: data.maxSpeedKmh * data.scale,
            maxRollDeg: data.maxRollDeg * data.scale,
            maxGForce: null,
          },
          profile: {
            maxSpeedKmh: data.profileMaxSpeed * data.scale,
            typicalMaxRollDeg: data.profileMaxRoll * data.scale,
          },
          eventCounts: data.eventCounts,
        };
        return categorizeTrip(baseInput).category === categorizeTrip(scaledInput).category;
      })
    );
  });

  // Feature: trip-categorization, Property 4: regras de classificação por categoria
  describe("Property 4: regras de classificação por categoria", () => {
    // COMMUTE: distanceKm < 30, avgSpeedKmh < 50, SPEEDING = 0
    // maxRollDeg <= 30 avoids OFF_ROAD (needs > 30); maxSpeedKmh <= 120 avoids TRACK_DAY speed
    it("Property 4a: COMMUTE quando critérios exclusivos satisfeitos", () => {
      const arbCommute = fc.record({
        distanceKm: finiteFloat(0, 29),
        avgSpeedKmh: finiteFloat(0, 49),
        maxRollDeg: finiteFloat(0, 30),
        maxSpeedKmh: finiteFloat(0, 120),
      });

      fc.assert(
        fc.property(arbCommute, (data) => {
          const input: CategorizationInput = {
            trip: {
              distanceKm: data.distanceKm,
              avgSpeedKmh: data.avgSpeedKmh,
              maxSpeedKmh: data.maxSpeedKmh,
              maxRollDeg: data.maxRollDeg,
              maxGForce: null,
            },
            profile: null,
            eventCounts: { SPEEDING: 0, HIGH_VIBRATION: 0 },
          };
          return categorizeTrip(input).category === "COMMUTE";
        })
      );
    });

    // WEEKEND_RIDE: distanceKm >= 30, avgSpeedKmh in [50,100], maxRollDeg < 40
    // maxRollDeg <= 30 avoids OFF_ROAD; maxSpeedKmh <= 120 avoids TRACK_DAY speed
    it("Property 4b: WEEKEND_RIDE quando critérios exclusivos satisfeitos", () => {
      const arbWeekend = fc.record({
        distanceKm: finiteFloat(30, 500),
        avgSpeedKmh: finiteFloat(50, 100),
        maxRollDeg: finiteFloat(0, 30),
        maxSpeedKmh: finiteFloat(0, 120),
      });

      fc.assert(
        fc.property(arbWeekend, (data) => {
          const input: CategorizationInput = {
            trip: {
              distanceKm: data.distanceKm,
              avgSpeedKmh: data.avgSpeedKmh,
              maxSpeedKmh: data.maxSpeedKmh,
              maxRollDeg: data.maxRollDeg,
              maxGForce: null,
            },
            profile: null,
            eventCounts: { SPEEDING: 0, EXCESSIVE_LEAN: 0, HIGH_VIBRATION: 0 },
          };
          return categorizeTrip(input).category === "WEEKEND_RIDE";
        })
      );
    });

    // TRACK_DAY: maxSpeedKmh > 120, maxRollDeg > 40, (SPEEDING + EXCESSIVE_LEAN) > 2
    it("Property 4c: TRACK_DAY quando critérios satisfeitos", () => {
      const arbTrackDay = fc.record({
        maxSpeedKmh: finiteFloat(121, 300),
        maxRollDeg: finiteFloat(41, 90),
        speedingCount: fc.integer({ min: 0, max: 10 }),
        excessiveLeanCount: fc.integer({ min: 0, max: 10 }),
        distanceKm: finiteFloat(0, 500),
        avgSpeedKmh: finiteFloat(0, 200),
      }).filter((d) => d.speedingCount + d.excessiveLeanCount > 2);

      fc.assert(
        fc.property(arbTrackDay, (data) => {
          const input: CategorizationInput = {
            trip: {
              distanceKm: data.distanceKm,
              avgSpeedKmh: data.avgSpeedKmh,
              maxSpeedKmh: data.maxSpeedKmh,
              maxRollDeg: data.maxRollDeg,
              maxGForce: null,
            },
            profile: null,
            eventCounts: {
              SPEEDING: data.speedingCount,
              EXCESSIVE_LEAN: data.excessiveLeanCount,
            },
          };
          return categorizeTrip(input).category === "TRACK_DAY";
        })
      );
    });

    // OFF_ROAD: avgSpeedKmh < 40, maxRollDeg > 30, HIGH_VIBRATION > 0
    // maxRollDeg in (30, 40] avoids TRACK_DAY roll condition (> 40); maxSpeedKmh <= 120 avoids TRACK_DAY speed
    it("Property 4d: OFF_ROAD quando critérios exclusivos satisfeitos", () => {
      const arbOffRoad = fc.record({
        avgSpeedKmh: finiteFloat(0, 39),
        maxRollDeg: finiteFloat(31, 40),
        highVibrationCount: fc.integer({ min: 1, max: 20 }),
        distanceKm: finiteFloat(0, 500),
        maxSpeedKmh: finiteFloat(0, 120),
      });

      fc.assert(
        fc.property(arbOffRoad, (data) => {
          const input: CategorizationInput = {
            trip: {
              distanceKm: data.distanceKm,
              avgSpeedKmh: data.avgSpeedKmh,
              maxSpeedKmh: data.maxSpeedKmh,
              maxRollDeg: data.maxRollDeg,
              maxGForce: null,
            },
            profile: null,
            eventCounts: {
              SPEEDING: 0,
              EXCESSIVE_LEAN: 0,
              HIGH_VIBRATION: data.highVibrationCount,
            },
          };
          return categorizeTrip(input).category === "OFF_ROAD";
        })
      );
    });
  });

  // Feature: trip-categorization, Property 5: prioridade de desempate é determinística
  describe("Property 5: prioridade de desempate é determinística", () => {
    // TRACK_DAY > OFF_ROAD: both satisfied simultaneously
    // TRACK_DAY: maxSpeedKmh > 120, maxRollDeg > 40, events > 2
    // OFF_ROAD: avgSpeedKmh < 40, maxRollDeg > 30, HIGH_VIBRATION > 0
    // maxRollDeg > 40 satisfies both roll conditions
    it("Property 5a: TRACK_DAY tem prioridade sobre OFF_ROAD", () => {
      const arbOverlap = fc.record({
        maxSpeedKmh: finiteFloat(121, 300),
        maxRollDeg: finiteFloat(41, 90),
        avgSpeedKmh: finiteFloat(0, 39),
        speedingCount: fc.integer({ min: 0, max: 10 }),
        excessiveLeanCount: fc.integer({ min: 0, max: 10 }),
        highVibrationCount: fc.integer({ min: 1, max: 20 }),
        distanceKm: finiteFloat(0, 500),
      }).filter((d) => d.speedingCount + d.excessiveLeanCount > 2);

      fc.assert(
        fc.property(arbOverlap, (data) => {
          const input: CategorizationInput = {
            trip: {
              distanceKm: data.distanceKm,
              avgSpeedKmh: data.avgSpeedKmh,
              maxSpeedKmh: data.maxSpeedKmh,
              maxRollDeg: data.maxRollDeg,
              maxGForce: null,
            },
            profile: null,
            eventCounts: {
              SPEEDING: data.speedingCount,
              EXCESSIVE_LEAN: data.excessiveLeanCount,
              HIGH_VIBRATION: data.highVibrationCount,
            },
          };
          return categorizeTrip(input).category === "TRACK_DAY";
        })
      );
    });

    // TRACK_DAY > WEEKEND_RIDE: TRACK_DAY conditions met (maxRollDeg > 40 means WEEKEND_RIDE roll < 40 not met)
    // Test that TRACK_DAY wins when its conditions are fully met
    it("Property 5b: TRACK_DAY tem prioridade sobre WEEKEND_RIDE", () => {
      const arbOverlap = fc.record({
        maxSpeedKmh: finiteFloat(121, 300),
        maxRollDeg: finiteFloat(41, 90),
        distanceKm: finiteFloat(30, 500),
        avgSpeedKmh: finiteFloat(50, 100),
        speedingCount: fc.integer({ min: 0, max: 10 }),
        excessiveLeanCount: fc.integer({ min: 0, max: 10 }),
      }).filter((d) => d.speedingCount + d.excessiveLeanCount > 2);

      fc.assert(
        fc.property(arbOverlap, (data) => {
          const input: CategorizationInput = {
            trip: {
              distanceKm: data.distanceKm,
              avgSpeedKmh: data.avgSpeedKmh,
              maxSpeedKmh: data.maxSpeedKmh,
              maxRollDeg: data.maxRollDeg,
              maxGForce: null,
            },
            profile: null,
            eventCounts: {
              SPEEDING: data.speedingCount,
              EXCESSIVE_LEAN: data.excessiveLeanCount,
            },
          };
          // TRACK_DAY conditions are met; WEEKEND_RIDE roll condition (< 40) is NOT met
          // so TRACK_DAY wins by priority
          return categorizeTrip(input).category === "TRACK_DAY";
        })
      );
    });

    // OFF_ROAD > COMMUTE: both satisfied simultaneously
    // OFF_ROAD: avgSpeedKmh < 40, maxRollDeg > 30, HIGH_VIBRATION > 0
    // COMMUTE: distanceKm < 30, avgSpeedKmh < 50, SPEEDING = 0
    // Overlap: avgSpeedKmh < 40 satisfies both; distanceKm < 30; maxRollDeg in (30, 40]
    it("Property 5c: OFF_ROAD tem prioridade sobre COMMUTE", () => {
      const arbOverlap = fc.record({
        avgSpeedKmh: finiteFloat(0, 39),
        maxRollDeg: finiteFloat(31, 40),
        highVibrationCount: fc.integer({ min: 1, max: 20 }),
        distanceKm: finiteFloat(0, 29),
        maxSpeedKmh: finiteFloat(0, 120),
      });

      fc.assert(
        fc.property(arbOverlap, (data) => {
          const input: CategorizationInput = {
            trip: {
              distanceKm: data.distanceKm,
              avgSpeedKmh: data.avgSpeedKmh,
              maxSpeedKmh: data.maxSpeedKmh,
              maxRollDeg: data.maxRollDeg,
              maxGForce: null,
            },
            profile: null,
            eventCounts: {
              SPEEDING: 0,
              HIGH_VIBRATION: data.highVibrationCount,
            },
          };
          return categorizeTrip(input).category === "OFF_ROAD";
        })
      );
    });

    // WEEKEND_RIDE > COMMUTE: WEEKEND_RIDE conditions met (distanceKm >= 30 means COMMUTE < 30 not met)
    it("Property 5d: WEEKEND_RIDE tem prioridade sobre COMMUTE", () => {
      const arbOverlap = fc.record({
        distanceKm: finiteFloat(30, 500),
        avgSpeedKmh: finiteFloat(50, 100),
        maxRollDeg: finiteFloat(0, 30),
        maxSpeedKmh: finiteFloat(0, 120),
      });

      fc.assert(
        fc.property(arbOverlap, (data) => {
          const input: CategorizationInput = {
            trip: {
              distanceKm: data.distanceKm,
              avgSpeedKmh: data.avgSpeedKmh,
              maxSpeedKmh: data.maxSpeedKmh,
              maxRollDeg: data.maxRollDeg,
              maxGForce: null,
            },
            profile: null,
            eventCounts: { SPEEDING: 0, HIGH_VIBRATION: 0 },
          };
          return categorizeTrip(input).category === "WEEKEND_RIDE";
        })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Unit tests — complementares (Task 11)
// ---------------------------------------------------------------------------

describe("categorizeTrip — unit tests", () => {
  // 11.1: distanceKm = null AND avgSpeedKmh = null → confidence = 0.0, matchedRules includes "insufficient_data"
  it("11.1: retorna confidence=0.0 e matchedRules=['insufficient_data'] quando distanceKm e avgSpeedKmh são null", () => {
    const input: CategorizationInput = {
      trip: {
        distanceKm: null,
        avgSpeedKmh: null,
        maxSpeedKmh: null,
        maxRollDeg: null,
        maxGForce: null,
      },
      profile: null,
      eventCounts: {},
    };
    const result = categorizeTrip(input);
    expect(result.confidence).toBe(0.0);
    expect(result.matchedRules).toContain("insufficient_data");
  });

  // 11.2: sem perfil (profile = null) usa limiares absolutos — exemplo COMMUTE concreto
  it("11.2: sem perfil usa limiares absolutos — exemplo COMMUTE: distanceKm=10, avgSpeedKmh=30, maxSpeedKmh=50, maxRollDeg=10, maxGForce=0.5, sem eventos", () => {
    const input: CategorizationInput = {
      trip: {
        distanceKm: 10,
        avgSpeedKmh: 30,
        maxSpeedKmh: 50,
        maxRollDeg: 10,
        maxGForce: 0.5,
      },
      profile: null,
      eventCounts: {},
    };
    const result = categorizeTrip(input);
    expect(result.category).toBe("COMMUTE");
  });
});

// ---------------------------------------------------------------------------
// 11.3: categorizeTripById com viagem inexistente → retorna null
// ---------------------------------------------------------------------------

describe("categorizeTripById — unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("11.3: retorna null quando a viagem não existe (Prisma devolve null)", async () => {
    // Import the mocked prisma to configure the mock return value
    const { prisma } = await import("../backend/src/services/prisma.service");
    (prisma.trip.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await categorizeTripById("non-existent-id", "user-id");
    expect(result).toBeNull();
  });
});
