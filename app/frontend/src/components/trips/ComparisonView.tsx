import { useEffect, useState } from "react";
import type { Trip, TripTelemetryResponse, TripEvaluationResponse } from "../../types";
import { tripsAPI } from "../../services/api";
import {
  normalizeTelemetryToPercent,
  calcAvgSpeed,
  compareValues,
  findWinnerIndex,
  formatDiff,
  scoreStyle as scoreStyleUtil,
} from "../../utils/tripComparison";
import { OverlaySpeedChart } from "./OverlaySpeedChart";
import { GitCompare } from "lucide-react";

export interface ComparisonViewProps {
  tripIds: string[];
  trips: Trip[];
}

const COLORS = ["#5b6af0", "#f472b6", "#10b981", "#f59e0b"];
const LETTERS = ["A", "B", "C", "D"];

interface TripData {
  trip: Trip;
  telemetry: TripTelemetryResponse | null;
  evaluation: TripEvaluationResponse | null;
  telemetryError: string | null;
  evaluationError: string | null;
  telemetryLoading: boolean;
  evaluationLoading: boolean;
}

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

function ScoreRing({ score, label, color, isWinner }: { score: number | null; label: string; color: string; isWinner: boolean }) {
  if (score == null) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-[72px] h-[72px] rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-xs font-black text-muted">N/D</span>
        </div>
        <span className="text-[0.55rem] font-black uppercase tracking-widest text-muted opacity-60">{label}</span>
      </div>
    );
  }
  const style = scoreStyleUtil(score);
  const pct = Math.min(100, Math.max(0, score));
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className={`flex flex-col items-center gap-2 ${isWinner ? 'scale-110' : ''}`}>
      <div className="relative">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={style.color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black" style={{ color: style.color }}>{score.toFixed(0)}</span>
        </div>
        {isWinner && <span className="absolute -top-1 -right-1 text-sm">👑</span>}
      </div>
      <span className="text-[0.55rem] font-black uppercase tracking-widest" style={{ color }}>{label}</span>
    </div>
  );
}

function StatCell({ value, isWinner }: { value: string; isWinner: boolean }) {
  return (
    <div className={`p-3 rounded-xl text-center transition-all ${isWinner ? 'bg-accent/10 border border-accent/20' : 'bg-white/5 border border-white/5'}`}>
      <span className={`text-sm font-black tabular-nums ${isWinner ? 'text-accent' : 'text-text'}`}>{value}</span>
      {isWinner && <span className="ml-1.5 text-xs" aria-label="Melhor">👑</span>}
    </div>
  );
}

function WinnerDot({ isWinner }: { isWinner: boolean }) {
  if (!isWinner) return null;
  return <span className="w-2 h-2 rounded-full bg-accent shadow-lg shadow-accent/40 inline-block" />;
}

// ─── Header ─────────────────────────────────────────────────────────────────

function ComparisonHeader({ data }: { data: TripData[] }) {
  return (
    <div className="relative bg-gradient-to-r from-accent/5 to-transparent border border-white/10 rounded-[2rem] p-8 overflow-hidden">
      <div className="absolute top-[-80px] right-[-80px] w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none" />
      <div className="flex items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-3">
          <GitCompare size={24} className="text-accent" />
          <span className="text-lg font-black text-text tracking-tight">Comparação de Viagens</span>
        </div>
        <div className="flex items-center gap-4">
          {data.map((d, i) => (
            <div key={d.trip.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm" style={{ backgroundColor: COLORS[i] + '20', color: COLORS[i] }}>
                {LETTERS[i]}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-text leading-tight">{d.trip.motorcycle?.name ?? "—"}</span>
                <span className="text-[0.55rem] font-bold text-muted uppercase tracking-widest">{formatDate(d.trip.startedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Metrics Section ─────────────────────────────────────────────────────────

function TripStatsSection({ data }: { data: TripData[] }) {
  const metrics: { icon: string; label: string; key: "distance" | "duration" | "avgSpeed" | "maxSpeed" }[] = [
    { icon: "📍", label: "Distância", key: "distance" },
    { icon: "⏱️", label: "Duração", key: "duration" },
    { icon: "📊", label: "Vel. Média", key: "avgSpeed" },
    { icon: "⚡", label: "Vel. Máxima", key: "maxSpeed" },
  ];

  const getVal = (d: TripData, key: string): { display: string; numeric: number | null } => {
    const t = d.trip;
    switch (key) {
      case "distance": return { display: t.distanceKm != null ? `${t.distanceKm.toFixed(1)} km` : "—", numeric: t.distanceKm ?? null };
      case "duration": return { display: formatDuration(t.startedAt, t.endedAt), numeric: durationSeconds(t.startedAt, t.endedAt) };
      case "avgSpeed": return { display: t.avgSpeedKmh != null ? `${t.avgSpeedKmh.toFixed(1)} km/h` : "—", numeric: t.avgSpeedKmh ?? null };
      case "maxSpeed": return { display: t.maxSpeedKmh != null ? `${t.maxSpeedKmh.toFixed(1)} km/h` : "—", numeric: t.maxSpeedKmh ?? null };
      default: return { display: "—", numeric: null };
    }
  };

  return (
    <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-lg">🏁</span>
        <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Métricas</span>
      </div>
      <div className="flex flex-col gap-4">
        {/* Header row */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `120px repeat(${data.length}, 1fr)` }}>
          <div />
          {data.map((_, i) => (
            <div key={i} className="text-center">
              <span className="text-[0.55rem] font-black uppercase tracking-widest" style={{ color: COLORS[i] }}>Viagem {LETTERS[i]}</span>
            </div>
          ))}
        </div>
        {metrics.map((m) => {
          const vals = data.map((d) => getVal(d, m.key));
          const numerics = vals.map((v) => v.numeric);
          const winnerIdx = findWinnerIndex(numerics);
          return (
            <div key={m.key} className="grid gap-4 items-center" style={{ gridTemplateColumns: `120px repeat(${data.length}, 1fr)` }}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{m.icon}</span>
                <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted opacity-60">{m.label}</span>
              </div>
              {vals.map((v, i) => (
                <StatCell key={i} value={v.display} isWinner={winnerIdx === i && numerics[i] !== null} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scores Section ──────────────────────────────────────────────────────────

function ScoresSection({ data }: { data: TripData[] }) {
  const loading = data.some((d) => d.evaluationLoading);
  const err = data.find((d) => d.evaluationError);

  if (loading) {
    return (
      <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🎯</span>
          <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Scores</span>
        </div>
        <div className="flex items-center justify-center py-8 gap-3">
          <div className="w-6 h-6 rounded-full border-4 border-accent/10 border-t-accent animate-spin" />
          <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted animate-pulse">A carregar scores…</span>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🎯</span>
          <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Scores</span>
        </div>
        <div className="text-[0.7rem] font-bold text-red py-4">Erro ao carregar scores: {err.evaluationError}</div>
      </div>
    );
  }

  const heuristics = data.map((d) => d.evaluation?.score ?? null);
  const mlScores = data.map((d) => d.evaluation?.mlScore ?? null);
  const hWinner = findWinnerIndex(heuristics);
  const mlWinner = findWinnerIndex(mlScores);

  return (
    <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-lg">🎯</span>
        <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Scores</span>
      </div>
      <div className="flex flex-col gap-8">
        <div>
          <div className="text-[0.6rem] font-black uppercase tracking-widest text-muted opacity-60 mb-4">Heurístico</div>
          <div className="flex items-center justify-center gap-8">
            {data.map((d, i) => (
              <ScoreRing key={d.trip.id} score={d.evaluation?.score ?? null} label={LETTERS[i]} color={COLORS[i]} isWinner={hWinner === i} />
            ))}
          </div>
          {heuristics.every((h) => h != null) && (
            <div className="flex justify-center mt-4">
              {heuristics.map((h, i) => i > 0 && (
                <span key={i} className="text-[0.6rem] font-bold text-muted opacity-40 mx-2">
                  Δ {formatDiff(heuristics[0], h, "pts")} ({LETTERS[0]} vs {LETTERS[i]})
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="w-full h-px bg-white/5" />
        <div>
          <div className="text-[0.6rem] font-black uppercase tracking-widest text-muted opacity-60 mb-4">Machine Learning</div>
          <div className="flex items-center justify-center gap-8">
            {data.map((d, i) => (
              <ScoreRing key={d.trip.id} score={d.evaluation?.mlScore ?? null} label={LETTERS[i]} color={COLORS[i]} isWinner={mlWinner === i} />
            ))}
          </div>
          {mlScores.every((m) => m != null) && (
            <div className="flex justify-center mt-4">
              {mlScores.map((m, i) => i > 0 && (
                <span key={i} className="text-[0.6rem] font-bold text-muted opacity-40 mx-2">
                  Δ {formatDiff(mlScores[0], m, "pts")} ({LETTERS[0]} vs {LETTERS[i]})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Speed Section ───────────────────────────────────────────────────────────

function SpeedSection({ data }: { data: TripData[] }) {
  const loading = data.some((d) => d.telemetryLoading);

  if (loading) {
    return (
      <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">📈</span>
          <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Velocidade</span>
        </div>
        <div className="flex items-center justify-center py-8 gap-3">
          <div className="w-6 h-6 rounded-full border-4 border-accent/10 border-t-accent animate-spin" />
          <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted animate-pulse">A carregar telemetria…</span>
        </div>
      </div>
    );
  }

  if (data.length === 2) {
    const dA = data[0];
    const dB = data[1];
    const pointsA = dA.telemetry?.data ?? [];
    const pointsB = dB.telemetry?.data ?? [];
    const seriesA = normalizeTelemetryToPercent(pointsA);
    const seriesB = normalizeTelemetryToPercent(pointsB);
    const avgA = seriesA.length > 0 ? calcAvgSpeed(seriesA) : null;
    const avgB = seriesB.length > 0 ? calcAvgSpeed(seriesB) : null;
    const labelA = dA.trip.motorcycle?.name ?? "Viagem A";
    const labelB = dB.trip.motorcycle?.name ?? "Viagem B";

    return (
      <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-lg">📈</span>
          <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Perfil de Velocidade</span>
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

  return (
    <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-lg">📈</span>
        <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Velocidade Média</span>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: `120px repeat(${data.length}, 1fr)` }}>
        <div />
        {data.map((_, i) => (
          <div key={i} className="text-center">
            <span className="text-[0.55rem] font-black uppercase tracking-widest" style={{ color: COLORS[i] }}>Viagem {LETTERS[i]}</span>
          </div>
        ))}
        {(() => {
          const vals = data.map((d) => {
            const p = d.telemetry?.data ?? [];
            const s = normalizeTelemetryToPercent(p);
            return s.length > 0 ? calcAvgSpeed(s) : null;
          });
          const winner = findWinnerIndex(vals);
          return (
            <div className="grid gap-4 items-center" style={{ gridTemplateColumns: `120px repeat(${data.length}, 1fr)`, gridColumn: `1 / ${data.length + 2}` }}>
              <div className="flex items-center gap-2">
                <span className="text-sm">📊</span>
                <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted opacity-60">Média (km/h)</span>
              </div>
              {vals.map((v, i) => (
                <StatCell key={i} value={v != null ? `${v.toFixed(1)}` : "—"} isWinner={winner === i && v != null} />
              ))}
            </div>
          );
        })()}
      </div>
      <p className="text-[0.55rem] font-medium text-muted opacity-40 mt-4 text-center italic">
        Gráfico de perfil de velocidade disponível apenas para comparação entre 2 viagens.
      </p>
    </div>
  );
}

// ─── Events Section ──────────────────────────────────────────────────────────

const SEV_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  INFO:     { label: "Info",    icon: "ℹ️",  color: "#3b82f6" },
  WARNING:  { label: "Aviso",   icon: "⚠️",  color: "#f59e0b" },
  CRITICAL: { label: "Crítico", icon: "🚨",  color: "#ef4444" },
};

function EventsSection({ data }: { data: TripData[] }) {
  const loading = data.some((d) => d.evaluationLoading);

  if (loading) {
    return (
      <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">⚡</span>
          <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Eventos</span>
        </div>
        <div className="flex items-center justify-center py-8 gap-3">
          <div className="w-6 h-6 rounded-full border-4 border-accent/10 border-t-accent animate-spin" />
          <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted animate-pulse">A carregar eventos…</span>
        </div>
      </div>
    );
  }

  const sevs = data.map((d) => d.evaluation?.severityCounts ?? { INFO: 0, WARNING: 0, CRITICAL: 0 });
  const totalEvents = sevs.map((s) => s.INFO + s.WARNING + s.CRITICAL);

  if (totalEvents.every((t) => t === 0)) {
    return (
      <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">⚡</span>
          <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Eventos</span>
        </div>
        <div className="flex items-center justify-center py-8 gap-3 text-muted opacity-40">
          <span className="text-2xl">✅</span>
          <span className="text-[0.65rem] font-black uppercase tracking-widest">Sem eventos de risco em nenhuma viagem</span>
        </div>
      </div>
    );
  }

  const allTypes = Array.from(new Set(data.flatMap((d) => Object.keys(d.evaluation?.typeCounts ?? {})))).sort();

  return (
    <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-lg">⚡</span>
        <span className="text-[0.65rem] font-black uppercase tracking-widest text-text">Eventos</span>
      </div>

      {/* Severity */}
      <div className="flex flex-wrap gap-4 mb-8">
        {(["INFO", "WARNING", "CRITICAL"] as const).map((key) => {
          const cfg = SEV_LABELS[key];
          const vals = sevs.map((s) => s[key]);
          const winner = findWinnerIndex(vals);
          return (
            <div key={key} className="flex-1 min-w-[140px] bg-white/5 border border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span>{cfg.icon}</span>
                <span className="text-[0.6rem] font-black uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
              <div className="flex flex-col gap-2">
                {vals.map((v, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[0.55rem] font-bold uppercase tracking-widest" style={{ color: COLORS[i] }}>{LETTERS[i]}</span>
                    <span className={`text-sm font-black tabular-nums ${winner === i ? 'text-accent' : 'text-text'}`}>
                      {v} {winner === i && <span className="ml-1 text-xs">👑</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* By type */}
      {allTypes.length > 0 && (
        <>
          <div className="text-[0.6rem] font-black uppercase tracking-widest text-muted opacity-60 mb-4">Por Tipo</div>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr) 120px` }}>
              {data.map((_, i) => (
                <div key={i} className="text-center">
                  <span className="text-[0.55rem] font-black uppercase tracking-widest" style={{ color: COLORS[i] }}>{LETTERS[i]}</span>
                </div>
              ))}
              <div />
            </div>
            {allTypes.map((type) => {
              const vals = data.map((d) => d.evaluation?.typeCounts?.[type] ?? 0);
              const winner = findWinnerIndex(vals);
              return (
                <div key={type} className="grid gap-3 items-center" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr) 120px` }}>
                  {vals.map((v, i) => (
                    <StatCell key={i} value={String(v)} isWinner={winner === i} />
                  ))}
                  <span className="text-[0.6rem] font-bold uppercase tracking-widest text-muted opacity-60">{type.replace(/_/g, " ")}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ComparisonView({ tripIds, trips }: ComparisonViewProps) {
  const [data, setData] = useState<TripData[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    const found = tripIds.map((id) => trips.find((t) => t.id === id) ?? null);

    if (found.some((t) => !t)) {
      setFatalError("Uma ou mais viagens não foram encontradas.");
      return;
    }

    const initData: TripData[] = found.map((t) => ({
      trip: t!,
      telemetry: null, evaluation: null,
      telemetryError: null, evaluationError: null,
      telemetryLoading: true, evaluationLoading: true,
    }));

    setData(initData);

    const loadTrip = async (index: number) => {
      const tripId = tripIds[index];
      const [telResult, evalResult] = await Promise.allSettled([
        tripsAPI.getTelemetry(tripId, { limit: 500 }),
        tripsAPI.getEvaluation(tripId),
      ]);
      setData((prev) => {
        const next = [...prev];
        if (!next[index]) return prev;
        next[index] = {
          ...next[index],
          telemetry: telResult.status === "fulfilled" ? (telResult.value.data as TripTelemetryResponse) : null,
          evaluation: evalResult.status === "fulfilled" ? (evalResult.value.data as TripEvaluationResponse) : null,
          telemetryError: telResult.status === "rejected" ? ((telResult.reason as Error)?.message ?? "Erro") : null,
          evaluationError: evalResult.status === "rejected" ? ((evalResult.reason as Error)?.message ?? "Erro") : null,
          telemetryLoading: false,
          evaluationLoading: false,
        };
        return next;
      });
    };

    tripIds.forEach((_, i) => { void loadTrip(i); });
  }, [tripIds, trips]);

  if (fatalError) {
    return (
      <div className="bg-red/10 border border-red/20 rounded-[2rem] p-8 text-center">
        <p className="text-[0.7rem] font-bold text-red mb-4">{fatalError}</p>
      </div>
    );
  }

  if (data.length === 0) return null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ComparisonHeader data={data} />
      <TripStatsSection data={data} />
      <ScoresSection data={data} />
      <SpeedSection data={data} />
      <EventsSection data={data} />
    </div>
  );
}

export default ComparisonView;
