// =============================================================================
// MotoGuard — Trip Comparison Utilities
// =============================================================================
// Funções utilitárias puras para a funcionalidade de comparação de viagens.
// =============================================================================

import type { TripTelemetryPoint, TripTelemetryResponse, TripEvaluationResponse, Trip, TripSource, TripStatus } from "../types";

export type TripSourceFilter = "ALL" | TripSource;
export type TripStatusFilter = "ALL" | TripStatus;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface NormalizedSpeedPoint {
  /** Posição normalizada na viagem: 0–100 */
  pct: number;
  /** Velocidade em km/h */
  speed: number;
}

export interface TripComparisonData {
  trip: Trip;
  telemetry: TripTelemetryResponse | null;
  evaluation: TripEvaluationResponse | null;
  telemetryError: string | null;
  evaluationError: string | null;
  telemetryLoading: boolean;
  evaluationLoading: boolean;
}

export interface ListStateSnapshot {
  page: number;
  pageSize: number;
  statusFilter: TripStatusFilter;
  sourceFilter: TripSourceFilter;
  selectedMotoId: string;
  fromDate: string;
  toDate: string;
  onlyWithEvents: boolean;
  expandedId: string | null;
}

// ─── Funções Utilitárias ──────────────────────────────────────────────────────

/**
 * Normaliza um array de pontos de telemetria para eixo X [0, 100].
 * Retorna array vazio se `points` for vazio.
 */
export function normalizeTelemetryToPercent(
  points: TripTelemetryPoint[]
): NormalizedSpeedPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ pct: 0, speed: points[0].speed_kmh ?? 0 }];
  }
  const last = points.length - 1;
  return points.map((p, i) => ({
    pct: (i / last) * 100,
    speed: p.speed_kmh ?? 0,
  }));
}

/**
 * Calcula a velocidade média aritmética de uma série normalizada.
 * Retorna 0 se a série for vazia.
 */
export function calcAvgSpeed(points: NormalizedSpeedPoint[]): number {
  if (points.length === 0) return 0;
  const sum = points.reduce((acc, p) => acc + p.speed, 0);
  return sum / points.length;
}

/**
 * Compara dois valores numéricos e retorna o vencedor.
 * - "A" se a > b
 * - "B" se b > a
 * - "tie" se a === b
 * - "none" se algum dos valores for null
 */
export function compareValues(
  a: number | null,
  b: number | null
): "A" | "B" | "tie" | "none" {
  if (a === null || b === null) return "none";
  if (a > b) return "A";
  if (b > a) return "B";
  return "tie";
}

/**
 * Retorna o índice do maior valor num array, ou -1 se todos forem null.
 * Usado para determinar o vencedor entre N viagens.
 */
export function findWinnerIndex(values: (number | null)[]): number {
  const max = Math.max(...values.map((v) => v ?? -Infinity));
  if (max === -Infinity) return -1;
  return values.findIndex((v) => v === max);
}

/**
 * Formata a diferença absoluta entre dois valores com unidade.
 * Retorna "—" se algum dos valores for null.
 */
export function formatDiff(
  a: number | null,
  b: number | null,
  unit: string
): string {
  if (a === null || b === null) return "—";
  const diff = Math.abs(a - b);
  return `${diff.toFixed(1)} ${unit}`;
}

/**
 * Retorna o estilo de cor para um score numérico.
 * - Verde (#22c55e) para score ≥ 80
 * - Amarelo (#ca8a04) para score ≥ 60
 * - Vermelho (#ef4444) para score < 60
 */
export function scoreStyle(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: "rgba(34,197,94,0.12)",  color: "#22c55e" };
  if (score >= 60) return { bg: "rgba(202,138,4,0.14)",  color: "#ca8a04" };
  return              { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" };
}
