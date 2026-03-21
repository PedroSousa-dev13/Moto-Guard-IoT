// =============================================================================
// MotoGuard IoT — ML Pipeline Service
// =============================================================================
// Orquestra a chamada ao Python ML Pipeline (ml/infer.py) via child_process.spawn.
// Agrega Heuristic_Score + ML_Score e produz um Comparison_Report.
// Fallback automático para heurístico quando ML não está disponível.
// =============================================================================

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "./prisma.service";
import { evaluateTripHeuristic, type TripEvaluation } from "./trip-evaluation.service";
import { env } from "../config/env";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ComparisonReport {
  heuristicScore: number;
  mlScore: number;
  scoreDelta: number;
  agreement: boolean;
  agreementLevel: "HIGH" | "MEDIUM" | "LOW";
  dominantFactors: string[];
  note: string | null;
}

export interface TripMlPipelineResult extends TripEvaluation {
  mlScore: number | null;
  mlFeedback: string;
  comparisonReport: ComparisonReport | null;
}

export interface MlStatusResult {
  enabled: boolean;
  modelLoaded: boolean;
  modelVersion: string | null;
  trainedAt: string | null;
  nSamples: number | null;
}

interface MlInferenceResult {
  mlScore: number;
  anomalyScore: number;
  feedbackLabel: string;
  dominantFeatures: string[];
  modelVersion: string;
  inferenceMs: number;
  error?: string;
}

// ── Caminhos ──────────────────────────────────────────────────────────────────

const ML_INFER_SCRIPT = path.resolve(process.cwd(), "..", "ml", "infer.py");
const ML_MODEL_PATH = path.resolve(process.cwd(), "..", env.ML_MODEL_PATH);
const ML_METADATA_PATH = ML_MODEL_PATH; // metadados estão no mesmo .pkl — lidos via Python

// ── Inferência via child_process ──────────────────────────────────────────────

function runMlInference(tripData: object): Promise<MlInferenceResult> {
  return new Promise((resolve, reject) => {
    const timeout = 5000; // 5 segundos (Req 3.5)

    const proc = spawn("python", [ML_INFER_SCRIPT], {
      env: {
        ...process.env,
        ML_MODEL_PATH: ML_MODEL_PATH,
        PYTHONPATH: path.resolve(process.cwd(), "..", "ml"),
      },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error(`ML inference timeout após ${timeout}ms`));
    }, timeout);

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (stderr) {
        console.log(`[ml-pipeline] Python stderr: ${stderr.trim()}`);
      }

      try {
        const result = JSON.parse(stdout.trim()) as MlInferenceResult;
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (e) {
        reject(new Error(`Falha ao parsear output do ML pipeline (code=${code}): ${stdout.slice(0, 200)}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Falha ao iniciar processo Python: ${err.message}`));
    });

    // Enviar dados da viagem via stdin
    proc.stdin.write(JSON.stringify(tripData));
    proc.stdin.end();
  });
}

// ── Comparison Report ─────────────────────────────────────────────────────────

export function buildComparisonReport(
  heuristicScore: number,
  mlScore: number,
  dominantFactors: string[],
): ComparisonReport {
  const scoreDelta = mlScore - heuristicScore;
  const absDelta = Math.abs(scoreDelta);
  const agreement = absDelta < 15;

  let agreementLevel: "HIGH" | "MEDIUM" | "LOW";
  if (absDelta < 10) agreementLevel = "HIGH";
  else if (absDelta <= 25) agreementLevel = "MEDIUM";
  else agreementLevel = "LOW";

  // Nota explicativa quando ML deteta anomalias não capturadas pelo heurístico (Req 4.4)
  let note: string | null = null;
  if (!agreement && scoreDelta < -20) {
    note =
      "O modelo ML detetou padrões anómalos não capturados pelas regras heurísticas. " +
      "Recomenda-se revisão dos dados da viagem.";
  }

  return { heuristicScore, mlScore, scoreDelta, agreement, agreementLevel, dominantFactors, note };
}

// ── Pipeline principal ────────────────────────────────────────────────────────

export async function runTripMlPipeline(
  tripId: string,
  userId: string,
): Promise<TripMlPipelineResult | null> {
  // Carregar viagem com eventos e perfil
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
    include: {
      motorcycle: { include: { profile: true } },
      events: true,
      gpxData: true,
    },
  });

  if (!trip) return null;

  // Calcular Heuristic_Score (sempre disponível)
  const heuristicResult = evaluateTripHeuristic({
    trip: {
      maxSpeedKmh: trip.maxSpeedKmh,
      maxRollDeg: trip.maxRollDeg,
      maxGForce: trip.maxGForce,
    },
    profile: trip.motorcycle.profile,
    events: trip.events,
  });

  // Fallback se ML desativado (Req 9.1, 9.2)
  if (!env.ML_ENABLED) {
    console.log("[ml-pipeline] ML_ENABLED=false — a usar apenas heurístico");
    return {
      ...heuristicResult,
      mlScore: null,
      mlFeedback: "Modelo ML não disponível",
      comparisonReport: null,
    };
  }

  // Fallback se model.pkl não existe (Req 3.3)
  if (!fs.existsSync(ML_MODEL_PATH)) {
    console.warn(`[ml-pipeline] Model artifact não encontrado: ${ML_MODEL_PATH}`);
    return {
      ...heuristicResult,
      mlScore: null,
      mlFeedback: "Modelo ML não disponível",
      comparisonReport: null,
    };
  }

  // Preparar dados para o Python
  const profile = trip.motorcycle.profile;
  const tripData = {
    trip: {
      id: trip.id,
      source: trip.source,
      maxSpeedKmh: trip.maxSpeedKmh ?? 0,
      maxRollDeg: trip.maxRollDeg ?? 0,
      maxGForce: trip.maxGForce ?? 0,
      distanceKm: trip.distanceKm ?? 0,
      avgSpeedKmh: trip.avgSpeedKmh ?? 0,
      startedAt: trip.startedAt.toISOString(),
      endedAt: trip.endedAt?.toISOString() ?? null,
    },
    events: trip.events.map((e) => ({ type: e.type, severity: e.severity })),
    profile: profile
      ? {
          maxSpeedKmh: profile.maxSpeedKmh,
          typicalMaxRollDeg: profile.typicalMaxRollDeg,
          crashRollThreshold: profile.crashRollThreshold,
          crashGForce: profile.crashGForce,
        }
      : null,
    // Para viagens GPX, incluir waypoints
    gpx_waypoints: trip.source === "GPX_IMPORTED" && trip.gpxData
      ? (trip.gpxData.waypoints as any) || []
      : undefined,
  };

  try {
    const mlResult = await runMlInference(tripData);

    const comparisonReport = buildComparisonReport(
      heuristicResult.score,
      mlResult.mlScore,
      mlResult.dominantFeatures,
    );

    // Persistir mlScore e mlModelVersion (Req 4.5)
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        mlScore: mlResult.mlScore,
        mlModelVersion: mlResult.modelVersion,
      },
    });

    return {
      ...heuristicResult,
      mlScore: mlResult.mlScore,
      mlFeedback: mlResult.feedbackLabel,
      comparisonReport,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[ml-pipeline] Falha na inferência ML — fallback heurístico: ${reason}`);
    return {
      ...heuristicResult,
      mlScore: null,
      mlFeedback: "Modelo ML não disponível",
      comparisonReport: null,
    };
  }
}

// ── Status do ML Pipeline ─────────────────────────────────────────────────────

export async function getMlStatus(): Promise<MlStatusResult> {
  const enabled = env.ML_ENABLED;
  const modelExists = fs.existsSync(ML_MODEL_PATH);

  if (!modelExists) {
    return { enabled, modelLoaded: false, modelVersion: null, trainedAt: null, nSamples: null };
  }

  // Ler metadados do artifact via Python (rápido — só carrega metadados)
  try {
    const metaResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const script = `
import joblib, json, sys
a = joblib.load(sys.argv[1])
m = a.get('metadata', {})
print(json.dumps({'modelVersion': m.get('model_version'), 'trainedAt': m.get('trained_at'), 'nSamples': m.get('n_samples')}))
`.trim();

      const proc = spawn("python", ["-c", script, ML_MODEL_PATH]);
      let out = "";
      proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
      proc.on("close", () => {
        try { resolve(JSON.parse(out.trim())); }
        catch { resolve({}); }
      });
      proc.on("error", reject);
      setTimeout(() => { proc.kill(); reject(new Error("timeout")); }, 3000);
    });

    return {
      enabled,
      modelLoaded: true,
      modelVersion: (metaResult.modelVersion as string) ?? null,
      trainedAt: (metaResult.trainedAt as string) ?? null,
      nSamples: (metaResult.nSamples as number) ?? null,
    };
  } catch {
    return { enabled, modelLoaded: true, modelVersion: null, trainedAt: null, nSamples: null };
  }
}
