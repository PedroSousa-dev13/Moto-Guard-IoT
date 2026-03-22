// =============================================================================
// Property-Based Tests — Trip Comparison Utilities
// Feature: trip-comparison
// =============================================================================

import { describe, test } from "vitest";
import fc from "fast-check";
import {
  normalizeTelemetryToPercent,
  calcAvgSpeed,
  compareValues,
  formatDiff,
  scoreStyle,
} from "./tripComparison";
import type { TripTelemetryPoint } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const telemetryPointArb = fc.record<TripTelemetryPoint>({
  time: fc.constant("2024-01-01T00:00:00Z"),
  speed_kmh: fc.float({ min: 0, max: 300, noNaN: true }),
});

// ─── Property 7: Normalização do eixo X para [0, 100] ────────────────────────
// Validates: Requirements 4.2

describe("normalizeTelemetryToPercent", () => {
  test("Property 7: pct está sempre em [0, 100] para qualquer array não vazio", () => {
    fc.assert(
      fc.property(
        fc.array(telemetryPointArb, { minLength: 1 }),
        (points) => {
          const result = normalizeTelemetryToPercent(points);
          return result.every((p) => p.pct >= 0 && p.pct <= 100);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 7: primeiro ponto tem pct === 0 e último tem pct === 100 (array com ≥ 2 pontos)", () => {
    fc.assert(
      fc.property(
        fc.array(telemetryPointArb, { minLength: 2 }),
        (points) => {
          const result = normalizeTelemetryToPercent(points);
          return result[0].pct === 0 && result[result.length - 1].pct === 100;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 7: array vazio retorna array vazio", () => {
    const result = normalizeTelemetryToPercent([]);
    return result.length === 0;
  });

  test("Property 7: comprimento do resultado é igual ao comprimento do input", () => {
    fc.assert(
      fc.property(
        fc.array(telemetryPointArb, { minLength: 0, maxLength: 500 }),
        (points) => {
          const result = normalizeTelemetryToPercent(points);
          return result.length === points.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 8: Velocidade média de referência é a média aritmética ─────────
// Validates: Requirements 4.6

describe("calcAvgSpeed", () => {
  test("Property 8: resultado é a média aritmética dos valores speed", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ pct: fc.float({ min: 0, max: 100, noNaN: true }), speed: fc.float({ min: 0, max: 300, noNaN: true }) }),
          { minLength: 1 }
        ),
        (points) => {
          const result = calcAvgSpeed(points);
          const expected = points.reduce((acc, p) => acc + p.speed, 0) / points.length;
          return Math.abs(result - expected) < 1e-9;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 8: array vazio retorna 0", () => {
    return calcAvgSpeed([]) === 0;
  });
});

// ─── Property 9: Destaque do vencedor é correto ───────────────────────────────
// Validates: Requirements 5.2, 6.4, 7.3

describe("compareValues", () => {
  test("Property 9: retorna 'A' quando a > b", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1e6, max: 1e6, noNaN: true }),
        fc.float({ min: -1e6, max: 1e6, noNaN: true }),
        (a, b) => {
          if (a <= b) return true; // skip
          return compareValues(a, b) === "A";
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 9: retorna 'B' quando b > a", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1e6, max: 1e6, noNaN: true }),
        fc.float({ min: -1e6, max: 1e6, noNaN: true }),
        (a, b) => {
          if (b <= a) return true; // skip
          return compareValues(a, b) === "B";
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 9: retorna 'tie' quando a === b", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1e6, max: 1e6, noNaN: true }),
        (v) => compareValues(v, v) === "tie"
      ),
      { numRuns: 100 }
    );
  });

  test("Property 9: retorna 'none' quando algum valor é null", () => {
    fc.assert(
      fc.property(
        fc.option(fc.float({ noNaN: true }), { nil: null }),
        fc.option(fc.float({ noNaN: true }), { nil: null }),
        (a, b) => {
          if (a !== null && b !== null) return true; // skip
          return compareValues(a, b) === "none";
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10: Diferença absoluta é correta ───────────────────────────────
// Validates: Requirements 5.3, 7.5

describe("formatDiff", () => {
  test("Property 10: diferença exibida é |a - b|", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1e6, max: 1e6, noNaN: true }),
        fc.float({ min: -1e6, max: 1e6, noNaN: true }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (a, b, unit) => {
          const result = formatDiff(a, b, unit);
          const expected = Math.abs(a - b).toFixed(1);
          return result === `${expected} ${unit}`;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 10: retorna '—' quando algum valor é null", () => {
    fc.assert(
      fc.property(
        fc.option(fc.float({ noNaN: true }), { nil: null }),
        fc.option(fc.float({ noNaN: true }), { nil: null }),
        (a, b) => {
          if (a !== null && b !== null) return true; // skip
          return formatDiff(a, b, "km/h") === "—";
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 11: Codificação de cor de score ─────────────────────────────────
// Validates: Requirements 5.5

describe("scoreStyle", () => {
  test("Property 11: verde (#22c55e) para score ≥ 80", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 100 }),
        (score) => scoreStyle(score).color === "#22c55e"
      ),
      { numRuns: 100 }
    );
  });

  test("Property 11: amarelo (#ca8a04) para 60 ≤ score < 80", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 79 }),
        (score) => scoreStyle(score).color === "#ca8a04"
      ),
      { numRuns: 100 }
    );
  });

  test("Property 11: vermelho (#ef4444) para score < 60", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 59 }),
        (score) => scoreStyle(score).color === "#ef4444"
      ),
      { numRuns: 100 }
    );
  });
});
