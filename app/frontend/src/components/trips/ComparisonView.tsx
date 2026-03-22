// =============================================================================
// MotoGuard — ComparisonView
// =============================================================================

import { useEffect, useCallback, useState } from "react";
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

export interface ComparisonViewProps {
  tripIds: [string, string];
  trips: Trip[];
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

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

function durationSeconds(startedAt: string, endedAt?: string): number | null {
  if (!endedAt) return null;
  return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;
}

// ─── ScoreRing ────────────────────────────────────────────────────────────────

function ScoreRing({ score, label, isWinner }: { score: number | null; label: string; isWinner: boolean }) {
  if (score == null) {
    return (
      <div className="cv-score-ring cv-score-ring--nd">
        <div className="cv-score-ring-inner">
          <span className="cv-score-ring-val">N/D</span>
          <span className="cv-score-ring-label">{label}</span>
        </div>
      </div>
    );
  }
  const style = scoreStyle(score);
  const pct = Math.min(100, Math.max(0, score));
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className={`cv-score-ring ${isWinner ? "cv-score-ring--winner" : ""}`}>
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={style.color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="cv-score-ring-inner">
        <span className="cv-score-ring-val" style={{ color: style.color }}>{score.toFixed(0)}</span>
        <span className="cv-score-ring-label">{label}</span>
      </div>
      {isWinner && <span className="cv-score-crown" aria-label="Melhor score">👑</span>}
    </div>
  );
}

// ─── StatCell ─────────────────────────────────────────────────────────────────

function StatCell({ value, isWinner, side }: { value: string; isWinner: boolean; side: "A" | "B" }) {
  return (
    <div className={`cv-stat-cell ${isWinner ? "cv-stat-cell--winner" : ""} cv-stat-cell--${side.toLowerCase()}`}>
      {isWinner && <span className="cv-stat-winner-dot" aria-hidden="true" />}
      <span className="cv-stat-cell-val">{value}</span>
    </div>
  );
}

// ─── ComparisonHeader ─────────────────────────────────────────────────────────

function ComparisonHeader({ dataA, dataB, onClose }: {
  dataA: TripComparisonData | null;
  dataB: TripComparisonData | null;
  onClose: () => void;
}) {
  return (
    <div className="cv-header">
      <div className="cv-header-bg" aria-hidden="true" />

      <div className="cv-header-content">
        {/* Trip A */}
        <div className="cv-header-trip">
          <div className="cv-header-badge cv-header-badge--a">A</div>
          <div className="cv-header-trip-info">
            <span className="cv-header-moto">{dataA?.trip.motorcycle?.name ?? "—"}</span>
            <span className="cv-header-date">{dataA ? formatDate(dataA.trip.startedAt) : "—"}</span>
            {dataA?.trip.motorcycle?.brand && (
              <span className="cv-header-brand">{dataA.trip.motorcycle.brand}</span>
            )}
          </div>
        </div>

        {/* VS */}
        <div className="cv-header-vs-block">
          <span className="cv-header-vs">VS</span>
        </div>

        {/* Trip B */}
        <div className="cv-header-trip cv-header-trip--right">
          <div className="cv-header-trip-info cv-header-trip-info--right">
            <span className="cv-header-moto">{dataB?.trip.motorcycle?.name ?? "—"}</span>
            <span className="cv-header-date">{dataB ? formatDate(dataB.trip.startedAt) : "—"}</span>
            {dataB?.trip.motorcycle?.brand && (
              <span className="cv-header-brand">{dataB.trip.motorcycle.brand}</span>
            )}
          </div>
          <div className="cv-header-badge cv-header-badge--b">B</div>
        </div>
      </div>

      <button
        type="button"
        className="cv-close-btn"
        onClick={onClose}
        aria-label="Fechar comparação"
      >
        ✕
      </button>
    </div>
  );
}

// ─── TripStatsSection ─────────────────────────────────────────────────────────

function TripStatsSection({ dataA, dataB }: { dataA: TripComparisonData | null; dataB: TripComparisonData | null }) {
  const tA = dataA?.trip;
  const tB = dataB?.trip;

  const distA = tA?.distanceKm ?? null;
  const distB = tB?.distanceKm ?? null;
  const avgA  = tA?.avgSpeedKmh ?? null;
  const avgB  = tB?.avgSpeedKmh ?? null;
  const maxA  = tA?.maxSpeedKmh ?? null;
  const maxB  = tB?.maxSpeedKmh ?? null;
  const durA  = tA ? durationSeconds(tA.startedAt, tA.endedAt) : null;
  const durB  = tB ? durationSeconds(tB.startedAt, tB.endedAt) : null;

  const rows = [
    {
      icon: "📍", label: "Distância",
      valA: distA != null ? `${distA.toFixed(1)} km` : "—",
      valB: distB != null ? `${distB.toFixed(1)} km` : "—",
      diff: formatDiff(distA, distB, "km"),
      winner: compareValues(distA, distB),
    },
    {
      icon: "⏱️", label: "Duração",
      valA: tA ? formatDuration(tA.startedAt, tA.endedAt) : "—",
      valB: tB ? formatDuration(tB.startedAt, tB.endedAt) : "—",
      diff: durA != null && durB != null ? formatDiff(durA, durB, "s") : "—",
      winner: "none" as const,
    },
    {
      icon: "📊", label: "Vel. Média",
      valA: avgA != null ? `${avgA.toFixed(1)} km/h` : "—",
      valB: avgB != null ? `${avgB.toFixed(1)} km/h` : "—",
      diff: formatDiff(avgA, avgB, "km/h"),
      winner: compareValues(avgA, avgB),
    },
    {
      icon: "⚡", label: "Vel. Máxima",
      valA: maxA != null ? `${maxA.toFixed(1)} km/h` : "—",
      valB: maxB != null ? `${maxB.toFixed(1)} km/h` : "—",
      diff: formatDiff(maxA, maxB, "km/h"),
      winner: compareValues(maxA, maxB),
    },
  ];

  return (
    <div className="cv-section">
      <div className="cv-section-header">
        <span className="cv-section-icon">🏁</span>
        <span className="cv-section-title">Métricas</span>
      </div>
      <div className="cv-compare-grid">
        <div className="cv-compare-col-label cv-col-a-label">Viagem A</div>
        <div className="cv-compare-col-center" />
        <div className="cv-compare-col-label cv-col-b-label">Viagem B</div>
        {rows.map((r) => (
          <div key={r.label} className="cv-compare-row">
            <StatCell value={r.valA} isWinner={r.winner === "A"} side="A" />
            <div className="cv-compare-row-meta">
              <span className="cv-compare-row-icon">{r.icon}</span>
              <span className="cv-compare-row-label">{r.label}</span>
              {r.diff !== "—" && <span className="cv-compare-row-diff">Δ {r.diff}</span>}
            </div>
            <StatCell value={r.valB} isWinner={r.winner === "B"} side="B" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ScoresSection ────────────────────────────────────────────────────────────

function ScoresSection({ dataA, dataB }: { dataA: TripComparisonData | null; dataB: TripComparisonData | null }) {
  const loadingA = dataA?.evaluationLoading ?? false;
  const loadingB = dataB?.evaluationLoading ?? false;
  const errA = dataA?.evaluationError;
  const errB = dataB?.evaluationError;

  if (loadingA || loadingB) {
    return (
      <div className="cv-section">
        <div className="cv-section-header"><span className="cv-section-icon">🎯</span><span className="cv-section-title">Scores</span></div>
        <div className="cv-loading-row"><div className="spinner-small" /><span>A carregar scores…</span></div>
      </div>
    );
  }

  if (errA || errB) {
    return (
      <div className="cv-section">
        <div className="cv-section-header"><span className="cv-section-icon">🎯</span><span className="cv-section-title">Scores</span></div>
        <div className="cv-error-row">Erro ao carregar scores: {errA ?? errB}</div>
      </div>
    );
  }

  const evalA = dataA?.evaluation;
  const evalB = dataB?.evaluation;
  const hA = evalA?.score ?? null;
  const hB = evalB?.score ?? null;
  const mlA = evalA?.mlScore ?? null;
  const mlB = evalB?.mlScore ?? null;

  const hWinner  = compareValues(hA, hB);
  const mlWinner = compareValues(mlA, mlB);

  return (
    <div className="cv-section">
      <div className="cv-section-header">
        <span className="cv-section-icon">🎯</span>
        <span className="cv-section-title">Scores</span>
      </div>

      <div className="cv-scores-grid">
        {/* Heurístico */}
        <div className="cv-scores-group">
          <div className="cv-scores-group-label">Heurístico</div>
          <div className="cv-scores-row">
            <ScoreRing score={hA} label="A" isWinner={hWinner === "A"} />
            <div className="cv-scores-vs">
              {hA != null && hB != null && (
                <span className="cv-scores-diff">Δ {formatDiff(hA, hB, "pts")}</span>
              )}
            </div>
            <ScoreRing score={hB} label="B" isWinner={hWinner === "B"} />
          </div>
        </div>

        <div className="cv-scores-divider" />

        {/* ML */}
        <div className="cv-scores-group">
          <div className="cv-scores-group-label">Machine Learning</div>
          <div className="cv-scores-row">
            <ScoreRing score={mlA} label="A" isWinner={mlWinner === "A"} />
            <div className="cv-scores-vs">
              {mlA != null && mlB != null && (
                <span className="cv-scores-diff">Δ {formatDiff(mlA, mlB, "pts")}</span>
              )}
            </div>
            <ScoreRing score={mlB} label="B" isWinner={mlWinner === "B"} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SpeedSection ─────────────────────────────────────────────────────────────

function SpeedSection({ dataA, dataB }: { dataA: TripComparisonData | null; dataB: TripComparisonData | null }) {
  const loadingA = dataA?.telemetryLoading ?? false;
  const loadingB = dataB?.telemetryLoading ?? false;

  if (loadingA || loadingB) {
    return (
      <div className="cv-section">
        <div className="cv-section-header"><span className="cv-section-icon">📈</span><span className="cv-section-title">Velocidade</span></div>
        <div className="cv-loading-row"><div className="spinner-small" /><span>A carregar telemetria…</span></div>
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
    <div className="cv-section cv-section--dark">
      <div className="cv-section-header">
        <span className="cv-section-icon">📈</span>
        <span className="cv-section-title">Perfil de Velocidade</span>
      </div>
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

// ─── EventsSection ────────────────────────────────────────────────────────────

const SEV_CONFIG = {
  INFO:     { label: "Info",    icon: "ℹ️",  color: "var(--blue)" },
  WARNING:  { label: "Aviso",   icon: "⚠️",  color: "var(--yellow)" },
  CRITICAL: { label: "Crítico", icon: "🚨",  color: "var(--red)" },
} as const;

function EventsSection({ dataA, dataB }: { dataA: TripComparisonData | null; dataB: TripComparisonData | null }) {
  const loadingA = dataA?.evaluationLoading ?? false;
  const loadingB = dataB?.evaluationLoading ?? false;

  if (loadingA || loadingB) {
    return (
      <div className="cv-section">
        <div className="cv-section-header"><span className="cv-section-icon">⚡</span><span className="cv-section-title">Eventos</span></div>
        <div className="cv-loading-row"><div className="spinner-small" /><span>A carregar eventos…</span></div>
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
        <div className="cv-section-header"><span className="cv-section-icon">⚡</span><span className="cv-section-title">Eventos</span></div>
        <div className="cv-empty-events">
          <span className="cv-empty-events-icon">✅</span>
          <span>Sem eventos de risco em ambas as viagens</span>
        </div>
      </div>
    );
  }

  const allTypes = Array.from(new Set([...Object.keys(typesA), ...Object.keys(typesB)])).sort();

  return (
    <div className="cv-section">
      <div className="cv-section-header">
        <span className="cv-section-icon">⚡</span>
        <span className="cv-section-title">Eventos</span>
      </div>

      {/* Severity pills */}
      <div className="cv-events-sev-row">
        {(["INFO", "WARNING", "CRITICAL"] as const).map((key) => {
          const cfg = SEV_CONFIG[key];
          const vA = sevA[key];
          const vB = sevB[key];
          const winner = compareValues(vA, vB);
          return (
            <div key={key} className="cv-events-sev-card">
              <div className="cv-events-sev-header">
                <span>{cfg.icon}</span>
                <span className="cv-events-sev-label" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
              <div className="cv-events-sev-vals">
                <span className={`cv-events-sev-val ${winner === "A" ? "cv-events-sev-val--high" : ""}`}
                  style={winner === "A" ? { color: cfg.color } : undefined}>
                  {vA}
                </span>
                <span className="cv-events-sev-sep">vs</span>
                <span className={`cv-events-sev-val ${winner === "B" ? "cv-events-sev-val--high" : ""}`}
                  style={winner === "B" ? { color: cfg.color } : undefined}>
                  {vB}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* By type */}
      {allTypes.length > 0 && (
        <>
          <div className="cv-subsection-title" style={{ marginTop: 16 }}>Por Tipo</div>
          <div className="cv-compare-grid">
            <div className="cv-compare-col-label cv-col-a-label">A</div>
            <div className="cv-compare-col-center" />
            <div className="cv-compare-col-label cv-col-b-label">B</div>
            {allTypes.map((type) => {
              const vA = typesA[type] ?? 0;
              const vB = typesB[type] ?? 0;
              const winner = compareValues(vA, vB);
              return (
                <div key={type} className="cv-compare-row">
                  <StatCell value={String(vA)} isWinner={winner === "A"} side="A" />
                  <div className="cv-compare-row-meta">
                    <span className="cv-compare-row-label cv-event-type">{type.replace(/_/g, " ")}</span>
                  </div>
                  <StatCell value={String(vB)} isWinner={winner === "B"} side="B" />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── ComparisonView ───────────────────────────────────────────────────────────

export function ComparisonView({ tripIds, trips, onClose }: ComparisonViewProps) {
  const [dataA, setDataA] = useState<TripComparisonData | null>(null);
  const [dataB, setDataB] = useState<TripComparisonData | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    const tripA = trips.find((t) => t.id === tripIds[0]) ?? null;
    const tripB = trips.find((t) => t.id === tripIds[1]) ?? null;

    if (!tripA || !tripB) {
      setFatalError("Uma ou ambas as viagens não foram encontradas.");
      return;
    }

    const init = (trip: Trip): TripComparisonData => ({
      trip, telemetry: null, evaluation: null,
      telemetryError: null, evaluationError: null,
      telemetryLoading: true, evaluationLoading: true,
    });

    setDataA(init(tripA));
    setDataB(init(tripB));

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
        return {
          ...prev,
          telemetry: telResult.status === "fulfilled" ? (telResult.value.data as TripTelemetryResponse) : null,
          evaluation: evalResult.status === "fulfilled" ? (evalResult.value.data as TripEvaluationResponse) : null,
          telemetryError: telResult.status === "rejected" ? ((telResult.reason as Error)?.message ?? "Erro") : null,
          evaluationError: evalResult.status === "rejected" ? ((evalResult.reason as Error)?.message ?? "Erro") : null,
          telemetryLoading: false,
          evaluationLoading: false,
        };
      });
    };

    loadTrip(tripIds[0], setDataA);
    loadTrip(tripIds[1], setDataB);
  }, [tripIds, trips]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (fatalError) {
    return (
      <div className="cv-overlay" role="dialog" aria-modal="true" aria-label="Comparação de viagens">
        <div className="cv-container">
          <div className="cv-fatal-error">
            <span style={{ fontSize: "2rem" }}>⚠️</span>
            <p>{fatalError}</p>
            <button type="button" className="btn btn-primary" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cv-overlay" role="dialog" aria-modal="true" aria-label="Comparação de viagens">
      <div className="cv-container">
        <ComparisonHeader dataA={dataA} dataB={dataB} onClose={onClose} />
        <div className="cv-body">
          <TripStatsSection dataA={dataA} dataB={dataB} />
          <ScoresSection dataA={dataA} dataB={dataB} />
          <SpeedSection dataA={dataA} dataB={dataB} />
          <EventsSection dataA={dataA} dataB={dataB} />
        </div>
      </div>
    </div>
  );
}

export default ComparisonView;
