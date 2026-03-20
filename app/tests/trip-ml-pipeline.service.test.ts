import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    trip: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../backend/src/services/trip-evaluation.service", () => ({
  evaluateTripHeuristic: vi.fn(),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn().mockReturnValue(false) };
});

vi.mock("../backend/src/config/env", () => ({
  env: { ML_ENABLED: false, ML_MODEL_PATH: "ml/models/isolation_forest.pkl" },
}));

import { buildComparisonReport } from "../backend/src/services/trip-ml-pipeline.service";
import { evaluateTripHeuristic } from "../backend/src/services/trip-evaluation.service";
import { prisma } from "../backend/src/services/prisma.service";
import { runTripMlPipeline } from "../backend/src/services/trip-ml-pipeline.service";

// ── buildComparisonReport ─────────────────────────────────────────────────────

describe("buildComparisonReport", () => {
  it("agreementLevel HIGH quando delta < 10", () => {
    const report = buildComparisonReport(75, 80, []);
    expect(report.agreementLevel).toBe("HIGH");
    expect(report.agreement).toBe(true);
    expect(report.scoreDelta).toBe(5);
  });

  it("agreementLevel HIGH quando delta = 0", () => {
    const report = buildComparisonReport(70, 70, []);
    expect(report.agreementLevel).toBe("HIGH");
    expect(report.agreement).toBe(true);
  });

  it("agreementLevel MEDIUM quando delta = 15", () => {
    const report = buildComparisonReport(70, 85, []);
    expect(report.agreementLevel).toBe("MEDIUM");
    expect(report.agreement).toBe(false);
    expect(report.scoreDelta).toBe(15);
  });

  it("agreementLevel MEDIUM quando delta = 25 (limite)", () => {
    const report = buildComparisonReport(50, 75, []);
    expect(report.agreementLevel).toBe("MEDIUM");
  });

  it("agreementLevel LOW quando delta = 30", () => {
    const report = buildComparisonReport(40, 70, []);
    expect(report.agreementLevel).toBe("LOW");
    expect(report.agreement).toBe(false);
    expect(report.scoreDelta).toBe(30);
  });

  it("agreementLevel LOW quando delta > 25", () => {
    const report = buildComparisonReport(30, 80, []);
    expect(report.agreementLevel).toBe("LOW");
  });

  it("note preenchida quando ML muito abaixo do heurístico (delta < -20)", () => {
    // mlScore = 40, heuristicScore = 80 → scoreDelta = -40
    const report = buildComparisonReport(80, 40, []);
    expect(report.note).not.toBeNull();
    expect(report.note).toContain("ML");
  });

  it("note nula quando scores concordam", () => {
    const report = buildComparisonReport(75, 78, []);
    expect(report.note).toBeNull();
  });

  it("note nula quando ML acima do heurístico (delta positivo grande)", () => {
    // ML melhor que heurístico — sem nota de aviso
    const report = buildComparisonReport(40, 80, []);
    expect(report.note).toBeNull();
  });

  it("dominantFactors propagados corretamente", () => {
    const factors = ["count_HARD_BRAKING", "maxSpeedKmh"];
    const report = buildComparisonReport(70, 75, factors);
    expect(report.dominantFactors).toEqual(factors);
  });

  it("heuristicScore e mlScore preservados no report", () => {
    const report = buildComparisonReport(65, 80, []);
    expect(report.heuristicScore).toBe(65);
    expect(report.mlScore).toBe(80);
  });
});

// ── runTripMlPipeline — fallback quando ML_ENABLED=false ─────────────────────

describe("runTripMlPipeline — ML desativado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna mlScore null quando ML_ENABLED=false", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue({
      id: "t1",
      userId: "u1",
      maxSpeedKmh: 80,
      maxRollDeg: 20,
      maxGForce: 1.0,
      distanceKm: 10,
      avgSpeedKmh: 60,
      startedAt: new Date("2026-01-01T10:00:00Z"),
      endedAt: new Date("2026-01-01T10:30:00Z"),
      motorcycle: { profile: null },
      events: [],
    } as any);

    vi.mocked(evaluateTripHeuristic).mockReturnValue({
      score: 85,
      model: "heuristic-v1",
      severityCounts: { INFO: 0, WARNING: 0, CRITICAL: 0 },
      typeCounts: {},
      penalties: [],
    });

    const result = await runTripMlPipeline("t1", "u1");

    expect(result).not.toBeNull();
    expect(result!.mlScore).toBeNull();
    expect(result!.comparisonReport).toBeNull();
  });

  it("retorna null quando viagem não encontrada", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(null);

    const result = await runTripMlPipeline("nao-existe", "u1");

    expect(result).toBeNull();
  });

  it("inclui heuristicScore no resultado mesmo sem ML", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue({
      id: "t1",
      userId: "u1",
      maxSpeedKmh: 100,
      maxRollDeg: 30,
      maxGForce: 1.5,
      distanceKm: 20,
      avgSpeedKmh: 70,
      startedAt: new Date("2026-01-01T10:00:00Z"),
      endedAt: new Date("2026-01-01T11:00:00Z"),
      motorcycle: { profile: null },
      events: [],
    } as any);

    vi.mocked(evaluateTripHeuristic).mockReturnValue({
      score: 72,
      model: "heuristic-v1",
      severityCounts: { INFO: 0, WARNING: 0, CRITICAL: 0 },
      typeCounts: {},
      penalties: [],
    });

    const result = await runTripMlPipeline("t1", "u1");

    expect(result!.score).toBe(72);
    expect(result!.model).toBe("heuristic-v1");
  });
});
