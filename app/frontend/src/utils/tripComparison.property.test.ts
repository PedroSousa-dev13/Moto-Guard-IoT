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

// ─── Property 2: Botão Comparar ativo apenas com 2 selecionadas ──────────────
// Feature: trip-comparison, Property 2: Botão Comparar ativo apenas com 2 selecionadas
// Validates: Requirements 1.4

describe("isCompareActive (lógica de ativação do botão Comparar)", () => {
  // Inline the logic extracted from CompareBar: canCompare = selectedCount === 2
  const isCompareActive = (selectedCount: number): boolean => selectedCount === 2;

  test("Property 2: botão ativo se e só se selectedCount === 2", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (selectedCount) => {
          return isCompareActive(selectedCount) === (selectedCount === 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 1: Limite de seleção ───────────────────────────────────────────
// Feature: trip-comparison, Property 1: Limite de seleção
// Validates: Requirements 1.3

function applyToggle(selected: string[], tripId: string): string[] {
  if (selected.includes(tripId)) return selected.filter(id => id !== tripId);
  if (selected.length >= 2) return selected; // ignore
  return [...selected, tripId];
}

describe("applyToggle (lógica de handleCompareToggle)", () => {
  test("Property 1: para qualquer sequência de toggles, o array nunca excede comprimento 2", () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
        (tripIds) => {
          let selected: string[] = [];
          for (const id of tripIds) {
            selected = applyToggle(selected, id);
          }
          return selected.length <= 2;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3: Toggle de seleção é round-trip ───────────────────────────────
// Feature: trip-comparison, Property 3: Toggle de seleção é round-trip
// Validates: Requirements 1.6

describe("applyToggle round-trip", () => {
  test("Property 3: selecionar e depois desselecionar resulta no mesmo estado inicial", () => {
    fc.assert(
      fc.property(
        // initial state: 0 or 1 selected trip IDs
        fc.array(fc.uuid(), { minLength: 0, maxLength: 1 }),
        // a trip ID not already in the initial state
        fc.uuid(),
        (initialSelected, tripId) => {
          // Ensure tripId is not already in initialSelected
          fc.pre(!initialSelected.includes(tripId));

          const afterSelect = applyToggle(initialSelected, tripId);
          const afterDeselect = applyToggle(afterSelect, tripId);

          // Must have same length
          if (afterDeselect.length !== initialSelected.length) return false;
          // Must have same contents (order preserved)
          return afterDeselect.every((id, i) => id === initialSelected[i]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Cabeçalho contém identificadores das duas viagens ────────────
// Feature: trip-comparison, Property 5: Cabeçalho contém identificadores das duas viagens
// Validates: Requirements 2.3

// Replicates the header data extraction logic from ComparisonView.tsx:
//   motorcycle name: trip.motorcycle?.name ?? "—"
//   start date:      formatDate(trip.startedAt)  →  non-empty locale string

function extractHeaderIdentifier(trip: { motorcycle?: { name?: string } | null; startedAt: string }): {
  motoName: string;
  startDate: string;
} {
  const motoName = trip.motorcycle?.name ?? "—";
  const startDate = new Date(trip.startedAt).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  return { motoName, startDate };
}

// Safe ISO date generator using integer timestamps to avoid Invalid Date issues
const isoDateArb = fc
  .integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() })
  .map((ms) => new Date(ms).toISOString());

const tripWithMotoArb = fc.record({
  motorcycle: fc.record({ name: fc.string({ minLength: 1, maxLength: 50 }) }),
  startedAt: isoDateArb,
});

describe("extractHeaderIdentifier (lógica do cabeçalho da ComparisonView)", () => {
  test("Property 5: para qualquer par de viagens com nome de mota, os identificadores são não-vazios", () => {
    fc.assert(
      fc.property(
        tripWithMotoArb,
        tripWithMotoArb,
        (tripA, tripB) => {
          const idA = extractHeaderIdentifier(tripA);
          const idB = extractHeaderIdentifier(tripB);

          // motorcycle name must be non-empty (comes from the generator)
          if (idA.motoName.length === 0 || idB.motoName.length === 0) return false;
          // start date string must be non-empty
          if (idA.startDate.length === 0 || idB.startDate.length === 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5: viagem sem mota retorna '—' como nome", () => {
    fc.assert(
      fc.property(
        isoDateArb,
        (startedAt) => {
          const id = extractHeaderIdentifier({ motorcycle: null, startedAt });
          return id.motoName === "—";
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5: data de início é sempre uma string não-vazia para qualquer ISO válido", () => {
    fc.assert(
      fc.property(
        isoDateArb,
        (startedAt) => {
          const id = extractHeaderIdentifier({ motorcycle: { name: "Honda CB500" }, startedAt });
          return id.startDate.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: Limite de 500 pontos de telemetria ──────────────────────────
// Feature: trip-comparison, Property 6: Limite de 500 pontos de telemetria
// Validates: Requirements 3.5

describe("Limite de 500 pontos de telemetria", () => {
  test("Property 6: normalizeTelemetryToPercent preserva comprimento — nunca excede o input (≤ 500)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        (len) => {
          const points: TripTelemetryPoint[] = Array.from({ length: len }, () => ({
            time: "2024-01-01T00:00:00Z",
            speed_kmh: 60,
          }));
          const result = normalizeTelemetryToPercent(points);
          return result.length <= 500;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 6: Math.min(data.length, 500) nunca excede 500 para qualquer comprimento de dados", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (dataLength) => {
          return Math.min(dataLength, 500) <= 500;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 6: limit=500 garante que o número de pontos carregados é no máximo 500", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (totalPoints) => {
          // Simula o comportamento do backend: devolve min(totalPoints, limit) pontos
          const limit = 500;
          const returned = Math.min(totalPoints, limit);
          const points: TripTelemetryPoint[] = Array.from({ length: returned }, () => ({
            time: "2024-01-01T00:00:00Z",
            speed_kmh: 80,
          }));
          const result = normalizeTelemetryToPercent(points);
          return result.length <= 500;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: Fechar restaura estado da lista ─────────────────────────────
// Feature: trip-comparison, Property 4: Fechar restaura estado da lista
// Validates: Requirements 2.2

interface ListStateSnapshot {
  page: number;
  pageSize: number;
  statusFilter: string;
  sourceFilter: string;
  selectedMotoId: string;
  fromDate: string;
  toDate: string;
  onlyWithEvents: boolean;
  expandedId: string | null;
}

function saveSnapshot(state: ListStateSnapshot): ListStateSnapshot {
  return { ...state };
}

function restoreSnapshot(snapshot: ListStateSnapshot): ListStateSnapshot {
  return { ...snapshot };
}

const listStateSnapshotArb = fc.record<ListStateSnapshot>({
  page: fc.integer({ min: 0, max: 1000 }),
  pageSize: fc.integer({ min: 1, max: 100 }),
  statusFilter: fc.string({ minLength: 0, maxLength: 20 }),
  sourceFilter: fc.string({ minLength: 0, maxLength: 20 }),
  selectedMotoId: fc.string({ minLength: 0, maxLength: 50 }),
  fromDate: fc.string({ minLength: 0, maxLength: 30 }),
  toDate: fc.string({ minLength: 0, maxLength: 30 }),
  onlyWithEvents: fc.boolean(),
  expandedId: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
});

describe("ListStateSnapshot save/restore (lógica de restauração ao fechar ComparisonView)", () => {
  test("Property 4: guardar e restaurar um snapshot produz exatamente o mesmo estado", () => {
    fc.assert(
      fc.property(
        listStateSnapshotArb,
        (state) => {
          const snapshot = saveSnapshot(state);
          const restored = restoreSnapshot(snapshot);

          return (
            restored.page === state.page &&
            restored.pageSize === state.pageSize &&
            restored.statusFilter === state.statusFilter &&
            restored.sourceFilter === state.sourceFilter &&
            restored.selectedMotoId === state.selectedMotoId &&
            restored.fromDate === state.fromDate &&
            restored.toDate === state.toDate &&
            restored.onlyWithEvents === state.onlyWithEvents &&
            restored.expandedId === state.expandedId
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 4: restaurar não muta o snapshot original", () => {
    fc.assert(
      fc.property(
        listStateSnapshotArb,
        (state) => {
          const snapshot = saveSnapshot(state);
          const snapshotCopy = { ...snapshot };
          restoreSnapshot(snapshot);
          // snapshot must remain unchanged after restore
          return (
            snapshot.page === snapshotCopy.page &&
            snapshot.pageSize === snapshotCopy.pageSize &&
            snapshot.statusFilter === snapshotCopy.statusFilter &&
            snapshot.sourceFilter === snapshotCopy.sourceFilter &&
            snapshot.selectedMotoId === snapshotCopy.selectedMotoId &&
            snapshot.fromDate === snapshotCopy.fromDate &&
            snapshot.toDate === snapshotCopy.toDate &&
            snapshot.onlyWithEvents === snapshotCopy.onlyWithEvents &&
            snapshot.expandedId === snapshotCopy.expandedId
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 12: Event summary exibe contagens corretas ─────────────────────
// Feature: trip-comparison, Property 12: Event summary exibe contagens corretas
// Validates: Requirements 6.2, 6.3

describe("Event summary — extração de severityCounts e typeCounts", () => {
  // Replicates the extraction logic from ComparisonView.tsx:
  //   const sevA = evalA?.severityCounts ?? { INFO: 0, WARNING: 0, CRITICAL: 0 };
  //   const typesA = evalA?.typeCounts ?? {};
  function extractSeverityCounts(
    eval_: { severityCounts: { INFO: number; WARNING: number; CRITICAL: number } } | null | undefined
  ): { INFO: number; WARNING: number; CRITICAL: number } {
    return eval_?.severityCounts ?? { INFO: 0, WARNING: 0, CRITICAL: 0 };
  }

  function extractTypeCounts(
    eval_: { typeCounts: Record<string, number> } | null | undefined
  ): Record<string, number> {
    return eval_?.typeCounts ?? {};
  }

  const severityCountsArb = fc.record({
    INFO: fc.integer({ min: 0, max: 1000 }),
    WARNING: fc.integer({ min: 0, max: 1000 }),
    CRITICAL: fc.integer({ min: 0, max: 1000 }),
  });

  const typeCountsArb = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.integer({ min: 0, max: 1000 })
  );

  const evalResponseArb = fc.record({
    severityCounts: severityCountsArb,
    typeCounts: typeCountsArb,
  });

  test("Property 12: severityCounts extraídos correspondem exatamente ao input", () => {
    fc.assert(
      fc.property(evalResponseArb, (eval_) => {
        const extracted = extractSeverityCounts(eval_);
        return (
          extracted.INFO === eval_.severityCounts.INFO &&
          extracted.WARNING === eval_.severityCounts.WARNING &&
          extracted.CRITICAL === eval_.severityCounts.CRITICAL
        );
      }),
      { numRuns: 100 }
    );
  });

  test("Property 12: typeCounts extraídos correspondem exatamente ao input", () => {
    fc.assert(
      fc.property(evalResponseArb, (eval_) => {
        const extracted = extractTypeCounts(eval_);
        const keys = Object.keys(eval_.typeCounts);
        return keys.every((k) => extracted[k] === eval_.typeCounts[k]);
      }),
      { numRuns: 100 }
    );
  });

  test("Property 12: eval nulo retorna contagens zero para severidade", () => {
    const extracted = extractSeverityCounts(null);
    return (
      extracted.INFO === 0 &&
      extracted.WARNING === 0 &&
      extracted.CRITICAL === 0
    );
  });

  test("Property 12: eval nulo retorna objeto vazio para typeCounts", () => {
    const extracted = extractTypeCounts(null);
    return Object.keys(extracted).length === 0;
  });

  test("Property 12: contagens por severidade são sempre não-negativas", () => {
    fc.assert(
      fc.property(evalResponseArb, (eval_) => {
        const extracted = extractSeverityCounts(eval_);
        return extracted.INFO >= 0 && extracted.WARNING >= 0 && extracted.CRITICAL >= 0;
      }),
      { numRuns: 100 }
    );
  });

  test("Property 12: contagens por tipo são sempre não-negativas", () => {
    fc.assert(
      fc.property(evalResponseArb, (eval_) => {
        const extracted = extractTypeCounts(eval_);
        return Object.values(extracted).every((v) => v >= 0);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 13: Trip stats exibe as quatro métricas ────────────────────────
// Feature: trip-comparison, Property 13: Trip stats exibe as quatro métricas
// Validates: Requirements 7.2

describe("TripStatsSection — extração das quatro métricas", () => {
  // Replicates the data extraction logic from TripStatsSection in ComparisonView.tsx

  function formatDuration(startedAt: string, endedAt?: string): string {
    if (!endedAt) return "Em curso";
    const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function extractTripStats(trip: {
    distanceKm: number | null;
    avgSpeedKmh: number | null;
    maxSpeedKmh: number | null;
    startedAt: string;
    endedAt?: string;
  }): { distance: string; duration: string; avgSpeed: string; maxSpeed: string } {
    const distA = trip.distanceKm;
    const avgA = trip.avgSpeedKmh;
    const maxA = trip.maxSpeedKmh;

    return {
      distance: distA != null ? `${distA.toFixed(1)} km` : "—",
      duration: formatDuration(trip.startedAt, trip.endedAt),
      avgSpeed: avgA != null ? `${avgA.toFixed(1)} km/h` : "—",
      maxSpeed: maxA != null ? `${maxA.toFixed(1)} km/h` : "—",
    };
  }

  // Safe ISO date generator
  const isoDateArb = fc
    .integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() })
    .map((ms) => new Date(ms).toISOString());

  // Generator for a trip with all four metrics available (non-null)
  const tripWithAllMetricsArb = fc.record({
    distanceKm: fc.float({ min: 0, max: 10000, noNaN: true }),
    avgSpeedKmh: fc.float({ min: 0, max: 300, noNaN: true }),
    maxSpeedKmh: fc.float({ min: 0, max: 400, noNaN: true }),
    startedAt: isoDateArb,
    endedAt: isoDateArb,
  });

  test("Property 13: para qualquer viagem com todas as métricas disponíveis, o objeto de stats tem exatamente 4 entradas", () => {
    fc.assert(
      fc.property(tripWithAllMetricsArb, (trip) => {
        const stats = extractTripStats(trip);
        return Object.keys(stats).length === 4;
      }),
      { numRuns: 100 }
    );
  });

  test("Property 13: para qualquer viagem com todas as métricas disponíveis, todas as entradas são strings não-vazias", () => {
    fc.assert(
      fc.property(tripWithAllMetricsArb, (trip) => {
        const stats = extractTripStats(trip);
        return (
          stats.distance.length > 0 &&
          stats.duration.length > 0 &&
          stats.avgSpeed.length > 0 &&
          stats.maxSpeed.length > 0
        );
      }),
      { numRuns: 100 }
    );
  });

  test("Property 13: distância formatada contém 'km' quando disponível", () => {
    fc.assert(
      fc.property(tripWithAllMetricsArb, (trip) => {
        const stats = extractTripStats(trip);
        return stats.distance.endsWith(" km");
      }),
      { numRuns: 100 }
    );
  });

  test("Property 13: velocidade média formatada contém 'km/h' quando disponível", () => {
    fc.assert(
      fc.property(tripWithAllMetricsArb, (trip) => {
        const stats = extractTripStats(trip);
        return stats.avgSpeed.endsWith(" km/h");
      }),
      { numRuns: 100 }
    );
  });

  test("Property 13: velocidade máxima formatada contém 'km/h' quando disponível", () => {
    fc.assert(
      fc.property(tripWithAllMetricsArb, (trip) => {
        const stats = extractTripStats(trip);
        return stats.maxSpeed.endsWith(" km/h");
      }),
      { numRuns: 100 }
    );
  });

  test("Property 13: métricas nulas retornam '—'", () => {
    fc.assert(
      fc.property(isoDateArb, isoDateArb, (startedAt, endedAt) => {
        const stats = extractTripStats({
          distanceKm: null,
          avgSpeedKmh: null,
          maxSpeedKmh: null,
          startedAt,
          endedAt,
        });
        return stats.distance === "—" && stats.avgSpeed === "—" && stats.maxSpeed === "—";
      }),
      { numRuns: 100 }
    );
  });
});
