import { spawn } from "child_process";
import * as path from "path";
import { prisma } from "./prisma.service";

const CLUSTERING_SCRIPT = path.resolve(__dirname, "..", "..", "..", "..", "ml", "clustering.py");

export interface ClusteringResult {
  tripId: string;
  drivingStyle: "AGGRESSIVE" | "DEFENSIVE" | "ECONOMY";
  clusterId: number;
}

class TripClusteringService {
  /**
   * Executa o clustering para todas as viagens de um utilizador.
   * Geralmente chamado após uma nova viagem ou periodicamente.
   */
  async clusterUserTrips(userId: string): Promise<void> {
    try {
      // 1. Verificar rapidamente se há pelo menos 3 viagens antes de carregar tudo
      const tripCount = await prisma.trip.count({
        where: { userId, status: "COMPLETED" },
      });
      if (tripCount < 3) {
        console.log(`[clustering] Utilizador ${userId} tem apenas ${tripCount} viagens. Aguardando mais dados.`);
        return;
      }

      // 2. Carregar viagens com dados suficientes
      const trips = await prisma.trip.findMany({
        where: { userId, status: "COMPLETED" },
        include: {
          motorcycle: { include: { profile: true } },
          events: true,
        },
      });

      // 2. Preparar payload para o Python
      const payload = trips.map((t) => ({
        trip: {
          id: t.id,
          maxSpeedKmh: t.maxSpeedKmh ?? 0,
          maxRollDeg: t.maxRollDeg ?? 0,
          maxGForce: t.maxGForce ?? 0,
          distanceKm: t.distanceKm ?? 0,
          avgSpeedKmh: t.avgSpeedKmh ?? 0,
          startedAt: t.startedAt.toISOString(),
          endedAt: t.endedAt?.toISOString() ?? null,
        },
        events: t.events.map((e) => ({ type: e.type, severity: e.severity })),
        profile: t.motorcycle.profile ? {
          maxSpeedKmh: t.motorcycle.profile.maxSpeedKmh,
          typicalMaxRollDeg: t.motorcycle.profile.typicalMaxRollDeg,
        } : null,
      }));

      // 3. Invocar script Python
      const results = await this.runPythonClustering(payload);

      // 4. Atualizar base de dados
      const updates = results.map((res) => 
        prisma.trip.update({
          where: { id: res.tripId },
          data: { drivingStyle: res.drivingStyle as any },
        })
      );

      await Promise.all(updates);
      console.log(`[clustering] Atualizados estilos de condução para ${updates.length} viagens do utilizador ${userId}`);

    } catch (err) {
      console.error("[clustering] Erro ao executar clustering:", err);
    }
  }

  private runPythonClustering(payload: any): Promise<ClusteringResult[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn("python", [CLUSTERING_SCRIPT], {
        env: {
          ...process.env,
          PYTHONPATH: path.resolve(__dirname, "..", "..", "..", "..", "ml"),
        },
      });

      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("Timeout: clustering excedeu 30s"));
      }, 30_000);

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => { stdout += data.toString(); });
      proc.stderr.on("data", (data) => { stderr += data.toString(); });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          return reject(new Error(`Clustering script falhou (code ${code}): ${stderr}`));
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (err) {
          reject(new Error("Falha ao parsear output do clustering"));
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    });
  }
}

export const tripClusteringService = new TripClusteringService();
