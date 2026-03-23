import { EventSeverity, EventType } from "../generated/prisma/enums";

export interface TripEvaluation {
  score: number;
  model: string;
  severityCounts: Record<EventSeverity, number>;
  typeCounts: Partial<Record<EventType, number>>;
  penalties: Array<{ reason: string; points: number }>;
}

export type TripEvaluationInput = {
  trip: {
    maxSpeedKmh?: number | null;
    maxRollDeg?: number | null;
    maxGForce?: number | null;
  };
  profile?: {
    maxSpeedKmh: number;
    typicalMaxRollDeg: number;
    crashRollThreshold: number;
    crashGForce: number;
  } | null;
  events: Array<{
    severity: EventSeverity;
    type: EventType;
  }>;
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function evaluateTripHeuristic(input: TripEvaluationInput): TripEvaluation {
  const severityCounts: Record<EventSeverity, number> = {
    INFO: 0,
    WARNING: 0,
    CRITICAL: 0,
  };

  const typeCounts: Partial<Record<EventType, number>> = {};
  for (const ev of input.events) {
    severityCounts[ev.severity] = (severityCounts[ev.severity] ?? 0) + 1;
    typeCounts[ev.type] = (typeCounts[ev.type] ?? 0) + 1;
  }

  const penalties: Array<{ reason: string; points: number }> = [];

  let score = 100;
  score -= severityCounts.CRITICAL * 25;
  score -= severityCounts.WARNING * 12;
  score -= severityCounts.INFO * 5;

  // Penalidade extra por excesso de velocidade (por ocorrência)
  // Extra penalty for speeding events (on top of base severity penalty)
  const speedingCriticalCount = input.events.filter(
    (e) => e.type === EventType.SPEEDING && e.severity === EventSeverity.CRITICAL
  ).length;
  const speedingWarningCount = input.events.filter(
    (e) => e.type === EventType.SPEEDING && e.severity === EventSeverity.WARNING
  ).length;
  score -= speedingCriticalCount * 15;
  score -= speedingWarningCount * 8;

  const profile = input.profile;
  if (profile) {
    const maxSpeed = input.trip.maxSpeedKmh ?? 0;
    if (maxSpeed > 0 && profile.maxSpeedKmh > 0) {
      if (maxSpeed > profile.maxSpeedKmh * 1.05) penalties.push({ reason: "Velocidade acima do limite do perfil", points: 20 });
      else if (maxSpeed > profile.maxSpeedKmh * 0.9) penalties.push({ reason: "Velocidade muito alta para o perfil", points: 10 });
    }

    const maxRoll = Math.abs(input.trip.maxRollDeg ?? 0);
    if (maxRoll > 0 && profile.typicalMaxRollDeg > 0) {
      if (maxRoll > profile.crashRollThreshold * 0.9) penalties.push({ reason: "Inclinação próxima de queda", points: 20 });
      else if (maxRoll > profile.typicalMaxRollDeg * 1.15) penalties.push({ reason: "Inclinação acima do típico", points: 10 });
    }

    const maxG = input.trip.maxGForce ?? 0;
    if (maxG > 0) {
      if (maxG >= profile.crashGForce) penalties.push({ reason: "Picos de G-force elevados", points: 12 });
      else if (maxG >= profile.crashGForce * 0.7) penalties.push({ reason: "G-force acima do normal", points: 6 });
    }
  }

  for (const p of penalties) score -= p.points;

  // Queda detectada → score vai sempre a 0, independentemente do resto
  if ((typeCounts[EventType.CRASH_DETECTED] ?? 0) > 0) {
    score = 0;
  } else {
    score = clamp(Math.round(score), 0, 100);
  }

  return {
    score,
    model: "heuristic-v1",
    severityCounts,
    typeCounts,
    penalties,
  };
}

