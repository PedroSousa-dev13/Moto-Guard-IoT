import { prisma } from "./prisma.service";
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

  score = clamp(Math.round(score), 0, 100);

  return {
    score,
    model: "heuristic-v1",
    severityCounts,
    typeCounts,
    penalties,
  };
}

export async function evaluateTrip(tripId: string, userId: string): Promise<TripEvaluation | null> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
    include: {
      motorcycle: { include: { profile: true } },
      events: true,
    },
  });

  if (!trip) return null;

  return evaluateTripHeuristic({
    trip: {
      maxSpeedKmh: trip.maxSpeedKmh,
      maxRollDeg: trip.maxRollDeg,
      maxGForce: trip.maxGForce,
    },
    profile: trip.motorcycle.profile,
    events: trip.events,
  });
}
