// =============================================================================
// MotoGuard — ComparisonView
// =============================================================================
// Overlay de ecrã completo para comparação lado a lado de duas viagens.
// Carrega telemetria + avaliação em paralelo para ambas as viagens.
// =============================================================================

import { useEffect, useCallback } from "react";
import type { Trip, TripTelemetryResponse, TripEvaluationResponse } from "../../types";
import { tripsAPI } from "../../services/api";
import {
  normalizeTelemetryToPercent,
  calcAvgSpeed,
  compareValues,
  formatDiff,
  scoreStyle,
  type TripComparisonData,
} from "../../utils/tripComparison";
import { OverlaySpeedChart } from "./OverlaySpeedChart";
import { useState } from "react";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ComparisonViewProps {
  tripIds: [string, string];
  trips: Trip[];
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string, endedAt?: string): string {
  if (!endedAt) return "—";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function durationSeconds(startedAt: string, endedAt?: string): number | null {
  if (!endedAt) return null;
  return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface WinnerBadgeProps {
  winner: "A" | "B" | "tie" | "none";
  side: "A" | "B";
}

function WinnerBadge({ winner, side }: WinnerBadgeProps) {
  if (winner === "none" || winner === "tie") return null;
  if (winner !== side) return null;
  return <span className="cv-winner-badge">▲</span>;
}

// ─── ComparisonHeader ─────────────────────────────────────────────────────────

interface ComparisonHeaderProps {
  dataA: TripComparisonData | null;
  dataB: TripComparisonData | null;
  onClose: () => void;
}

function ComparisonHeader({ dataA, dataB, onClose }: ComparisonHeaderProps) {
  return (
    <div className="cv-header">
      <div className="cv-header-trips">
        {/* Viagem A */}
        <div className="cv-header-trip cv-col-a">
          <span className="cv-trip-label cv-label-a">A</span>
          <div className="cv-trip-info">
            <span className="cv-trip-moto">
              {dataA?.trip.motorcycle?.name ?? "—"}
            </span>
            <span className="cv-trip-date">
              {dataA ? formatDate(dataA.trip.startedAt) : "—"}
            </span>
          </div>
        </div>

        <div className="cv-header-vs">VS</div>

        {/* Viagem B */}
        <div className="cv-header-trip cv-col-b">
          <span className="cv-trip-label cv-label-b">B</span>
          <div className="cv-trip-info">
            <span className="cv-trip-moto">
              {dataB?.trip.motorcycle?.name ?? "—"}
            </span>
            <span className="cv-trip-date">
              {dataB ? formatDate(dataB.trip.startedAt) : "—"}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-ghost cv-close-btn"
        onClick={onClose}
        aria-label="Fechar comparação"
        tabIndex={0}
      >
        ✕
      </button>
    </div>
  );
}

// ─── TripStatsRow ─────────────────────────────────────────────────────────────

interface TripStatsRowProps {
  dataA: TripComparisonData | null;
  dataB: TripComparisonData | null;
}

function TripStatsRow({ dataA, dataB }: TripStatsRowProps) {
  const tripA = dataA?.trip;
  const tripB = dataB?.trip;

  const distA = tripA?.distanceKm ?? null;
  const distB = tripB?.distanceKm ?? null;
  const avgA = tripA?.avgSpeedKmh ?? null;
  const avgB = tripB?.avgSpeedKmh ?? null;
  const maxA = tripA?.maxSpeedKmh ?? null;
  const maxB = tripB?.maxSpeedKmh ?? null;
  const durA = tripA ? durationSeconds(tripA.startedAt, tripA.endedAt) : null;
  const durB = tripB ? durationSeconds(tripB.startedAt, tripB.endedAt) : null;

  const distWinner = compareValues(distA, distB);
  const avgWinner = compareValues(avgA, avgB);
  const maxWinner = compareValues(maxA, maxB);

  const stats = [
    {
      label: "Distância",
      valA: distA != null ? `${distA.toFixed(1)} km` : "—",
      valB: distB != null ? `${distB.toFixed(1)} km` : "—",
      diff: formatDiff(distA, distB, "km"),
      winner: distWinner,
    },
    {
      label: "Duração",
      valA: tripA ? formatDuration(tripA.startedAt, tripA.endedAt) : "—",
      valB: tripB ? formatDuration(tripB.startedAt, tripB.endedAt) : "—",
      diff: durA != null && durB != null ? formatDiff(durA, durB, "s") : "—",
      winner: "none" as const,
    },
    {
      label: "Vel. Média",
      valA: avgA != null ? `${avgA.toFixed(1)} km/h` : "—",
      valB: avgB != null ? `${avgB.toFixed(1)} km/h` : "—",
      diff: formatDiff(avgA, avgB, "km/h"),
      winner: avgWinner,
    },
    {
      label: "Vel. Máxima",
      valA: maxA != null ? `${maxA.toFixed(1)} km/h` : "—",
      valB: maxB != null ? `${maxB.toFixed(1)} km/h` : "—",
      diff: formatDiff(maxA, maxB, "km/h"),
      winner: maxWinner,
    },
  ];

  return (
    <div className="cv-section">
      <div className="cv-section-title">Métricas da Viagem</div>
      <div className="cv-stats-table">
        {stats.map((s) => (
          <div key={s.label} className="cv-stats-row">
            <div className="cv-stats-label">{s.label}</div>
            <div
              className={`cv-stats-val ${s.winner === "A" ? "cv-winner" : ""}`}
            >
              {s.valA}
              <WinnerBadge winner={s.winner} side="A" />
            </div>
            <div className="cv-stats-diff">{s.diff}</div>
            <div
              className={`cv-stats-val ${s.winner === "B" ? "cv-winner" : ""}`}
            >
              {s.valB}
              <WinnerBadge winner={s.winner} side="B" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ScoresRow ────────────────────────────────────────────────────────────────

interface ScoresRowProps {
  dataA: TripComparisonData | null;
  dataB: TripComparisonData | null;
}

function ScoresRow({ dataA, dataB }: ScoresRowProps) {
  const evalA = dataA?.evaluation;
  const evalB = dataB?.evaluation;

  const hA = evalA?.score ?? null;
  const hB = evalB?.score ?? null;
  const mlA = evalA?.mlScore ?? null;
  const mlB = evalB?.mlScore ?? null;

  const hWinner = compareValues(hA, hB);
  const mlWinner = compareValues(mlA, mlB);

  const loadingA = dataA?.evaluationLoading ?? false;
  const loadingB = dataB?.evaluationLoading ?? false;
  const errA = dataA?.evaluationError;
  const errB = dataB?.evaluationError;

  if (loadingA || loadingB) {
    return (
      <div className="cv-section">
        <div className="cv-section-title">Scores</div>
        <div className="cv-loading-row">
          <div className="spinner-small" />
          <span>A carregar scores…</span>
        </div>
      </div>
    );
  }

  if (errA || errB) {
    return (
      <div className="cv-section">
        <div className="cv-section-title">Scores</div>
        <div className="cv-error-row">
          Erro ao carregar scores: {errA ?? errB}
        </div>
      </div>
    );
  }

  const rows = [
    {
      label: "Score Heurístico",
      valA: hA,
      valB: hB,
      winner: hWinner,
      diff: formatDiff(hA, hB, "pts"),
    },
    {
      label: "Score ML",
      valA: mlA,
      valB: mlB,
      winner: mlWinner,
      diff: mlA != null && mlB != null ? formatDiff(mlA, mlB, "pts") : "—",
    },
  ];

  return (
    <div className="cv-section">
      <div className="cv-section-title">Scores</div>
      <div className="cv-stats-table">
        {rows.map((r) => {
          const styleA = r.valA != null ? scoreStyle(r.valA) : null;
          const styleB = r.valB != null ? scoreStyle(r.valB) : null;
          return (
            <div key={r.label} className="cv-stats-row">
              <div className="cv-stats-label">{r.label}</div>
              <div
                className={`cv-stats-val cv-score-val ${r.winner === "A" ? "cv-winner" : ""}`}
                style={styleA ? { color: styleA.color } : undefined}
              >
                {r.valA != null ? r.valA.toFixed(1) : "N/D"}
                <WinnerBadge winner={r.winner} side="A" />
              </div>
              <div className="cv-stats-diff">{r.diff}</div>
              <div
                className={`cv-stats-val cv-score-val ${r.winner === "B" ? "cv-winner" : ""}`}
                style={styleB ? { color: styleB.color } : undefined}
              >
                {r.valB != null ? r.valB.toFixed(1) : "N/D"}
                <WinnerBadge winner={r.winner} side="B" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SpeedChartSection ────────────────────────────────────────────────────────

interface SpeedChartSectionProps {
  dataA: TripComparisonData | null;
  dataB: TripComparisonData | null;
}

function SpeedChartSection({ dataA, dataB }: SpeedChartSectionProps) {
  const loadingA = dataA?.telemetryLoading ?? false;
  const loadingB = dataB?.telemetryLoading ?? false;

  if (loadingA || loadingB) {
    return (
      <div className="cv-section">
        <div className="cv-section-title">Velocidade</div>
        <div className="cv-loading-row">
          <div className="spinner-small" />
          <span>A carregar telemetria…</span>
        </div>
      </div>
    );
  }

  const pointsA = dataA?.telemetry?.data ?? [];
  const pointsB = dataB?.telemetry?.data ?? [];
  const seriesA = normalizeTelemetryToPercent(pointsA);
  const seriesB = normalizeTelemetryToPercent(pointsB);
  const avgA = seriesA.length > 0 ? calcAvgSpeed(seriesA) : null;
  const avgB = seriesB.length > 0 ? calcAvgSpeed(seriesB) : null;

  const labelA = dataA?.trip.motorcycle?.name ?? "Viagem A";
  const labelB = dataB?.trip.motorcycle?.name ?? "Viagem B";

  return (
    <div className="cv-section">
      <div className="cv-section-title">Velocidade</div>
      <OverlaySpeedChart
        seriesA={seriesA.length > 0 ? seriesA : null}
        seriesB={seriesB.length > 0 ? seriesB : null}
        labelA={labelA}
        labelB={labelB}
        avgSpeedA={avgA}
        avgSpeedB={avgB}
      />
    </div>
  );
}

// ─── EventSummaryRow ──────────────────────────────────────────────────────────

interface EventSummaryRowProps {
  dataA: TripComparisonData | null;
  dataB: TripComparisonData | null;
}

function EventSummaryRow({ dataA, dataB }: EventSummaryRowProps) {
  const loadingA = dataA?.evaluationLoading ?? false;
  const loadingB = dataB?.evaluationLoading ?? false;

  if (loadingA || loadingB) {
    return (
      <div className="cv-section">
        <div className="cv-section-title">Eventos</div>
        <div className="cv-loading-row">
          <div className="spinner-small" />
          <span>A carregar eventos…</span>
        </div>
      </div>
    );
  }

  const evalA = dataA?.evaluation;
  const evalB = dataB?.evaluation;

  const sevA = evalA?.severityCounts ?? { INFO: 0, WARNING: 0, CRITICAL: 0 };
  const sevB = evalB?.severityCounts ?? { INFO: 0, WARNING: 0, CRITICAL: 0 };
  const typesA = evalA?.typeCounts ?? {};
  const typesB = evalB?.typeCounts ?? {};

  const totalA = sevA.INFO + sevA.WARNING + sevA.CRITICAL;
  const totalB = sevB.INFO + sevB.WARNING + sevB.CRITICAL;

  if (totalA === 0 && totalB === 0) {
    return (
      <div className="cv-section">
        <div className="cv-section-title">Eventos</div>
        <div className="cv-empty-events">Sem eventos registados</div>
      </div>
    );
  }

  const severities: Array<{ key: "INFO" | "WARNING" | "CRITICAL"; label: string }> = [
    { key: "INFO", label: "Info" },
    { key: "WARNING", label: "Aviso" },
    { key: "CRITICAL", label: "Crítico" },
  ];

  // Todos os tipos de evento presentes em qualquer das viagens
  const allTypes = Array.from(
    new Set([...Object.keys(typesA), ...Object.keys(typesB)])
  ).sort();

  return (
    <div className="cv-section">
      <div className="cv-section-title">Eventos</div>

      {/* Por severidade */}
      <div className="cv-subsection-title">Por Severidade</div>
      <div className="cv-stats-table">
        {severities.map(({ key, label }) => {
          const vA = sevA[key];
          const vB = sevB[key];
          const winner = compareValues(vA, vB);
          // Para eventos, menos é melhor — mas mostramos apenas diferença
          return (
            <div key={key} className="cv-stats-row">
              <div className="cv-stats-label">{label}</div>
              <div className={`cv-stats-val ${winner === "A" ? "cv-winner-events" : ""}`}>
                {vA}
              </div>
              <div className="cv-stats-diff">{formatDiff(vA, vB, "")}</div>
              <div className={`cv-stats-val ${winner === "B" ? "cv-winner-events" : ""}`}>
                {vB}
              </div>
            </div>
          );
        })}
      </div>

      {/* Por tipo */}
      {allTypes.length > 0 && (
        <>
          <div className="cv-subsection-title" style={{ marginTop: 12 }}>Por Tipo</div>
          <div className="cv-stats-table">
            {allTypes.map((type) => {
              const vA = typesA[type] ?? 0;
              const vB = typesB[type] ?? 0;
              const winner = compareValues(vA, vB);
              return (
                <div key={type} className="cv-stats-row">
                  <div className="cv-stats-label cv-event-type">{type}</div>
                  <div className={`cv-stats-val ${winner === "A" ? "cv-winner-events" : ""}`}>
                    {vA}
                  </div>
                  <div className="cv-stats-diff">{formatDiff(vA, vB, "")}</div>
                  <div className={`cv-stats-val ${winner === "B" ? "cv-winner-events" : ""}`}>
                    {vB}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function ComparisonView({ tripIds, trips, onClose }: ComparisonViewProps) {
  const [dataA, setDataA] = useState<TripComparisonData | null>(null);
  const [dataB, setDataB] = useState<TripComparisonData | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // Inicializar estado com as trips encontradas
  useEffect(() => {
    const tripA = trips.find((t) => t.id === tripIds[0]) ?? null;
    const tripB = trips.find((t) => t.id === tripIds[1]) ?? null;

    if (!tripA || !tripB) {
      setFatalError("Uma ou ambas as viagens não foram encontradas.");
      return;
    }

    const initA: TripComparisonData = {
      trip: tripA,
      telemetry: null,
      evaluation: null,
      telemetryError: null,
      evaluationError: null,
      telemetryLoading: true,
      evaluationLoading: true,
    };
    const initB: TripComparisonData = {
      trip: tripB,
      telemetry: null,
      evaluation: null,
      telemetryError: null,
      evaluationError: null,
      telemetryLoading: true,
      evaluationLoading: true,
    };

    setDataA(initA);
    setDataB(initB);

    // Carregar dados em paralelo para ambas as viagens
    const loadTrip = async (
      tripId: string,
      setter: React.Dispatch<React.SetStateAction<TripComparisonData | null>>
    ) => {
      const [telResult, evalResult] = await Promise.allSettled([
        tripsAPI.getTelemetry(tripId, { limit: 500 }),
        tripsAPI.getEvaluation(tripId),
      ]);

      setter((prev) => {
        if (!prev) return prev;
        const telemetry: TripTelemetryResponse | null =
          telResult.status === "fulfilled" ? telResult.value.data : null;
        const evaluation: TripEvaluationResponse | null =
          evalResult.status === "fulfilled" ? evalResult.value.data : null;
        const telemetryError =
          telResult.status === "rejected"
            ? (telResult.reason as Error)?.message ?? "Erro desconhecido"
            : null;
        const evaluationError =
          evalResult.status === "rejected"
            ? (evalResult.reason as Error)?.message ?? "Erro desconhecido"
            : null;

        return {
          ...prev,
          telemetry,
          evaluation,
          telemetryError,
          evaluationError,
          telemetryLoading: false,
          evaluationLoading: false,
        };
      });
    };

    loadTrip(tripIds[0], setDataA);
    loadTrip(tripIds[1], setDataB);
  }, [tripIds, trips]);

  // Fechar com tecla Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Erro fatal (viagem não encontrada)
  if (fatalError) {
    return (
      <div className="cv-overlay" role="dialog" aria-modal="true" aria-label="Comparação de viagens">
        <div className="cv-container">
          <div className="cv-fatal-error">
            <p>{fatalError}</p>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cv-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Comparação de viagens"
    >
      <div className="cv-container">
        <ComparisonHeader dataA={dataA} dataB={dataB} onClose={onClose} />

        <div className="cv-body">
          <TripStatsRow dataA={dataA} dataB={dataB} />
          <ScoresRow dataA={dataA} dataB={dataB} />
          <SpeedChartSection dataA={dataA} dataB={dataB} />
          <EventSummaryRow dataA={dataA} dataB={dataB} />
        </div>
      </div>
    </div>
  );
}

export default ComparisonView;
