// =============================================================================
// MotoGuard IoT — Script: Limpar Viagens
// =============================================================================
// Remove todas as viagens, eventos e dados GPX da base de dados PostgreSQL.
// Remove também toda a telemetria correspondente no InfluxDB.
// Mantém as contas de utilizador e as motas registadas intactas.
// =============================================================================

import { prisma } from "../backend/src/services/prisma.service";
import { InfluxDB } from "@influxdata/influxdb-client";
import { env } from "../backend/src/config/env";

async function main() {
  console.log("🧼 Iniciando limpeza de viagens no MotoGuard...");

  try {
    // 1. Contar registos existentes
    const tripsCount = await prisma.trip.count();
    const eventsCount = await prisma.tripEvent.count();
    const gpxCount = await prisma.gpxData.count();

    console.log(`\nRegistos atuais no PostgreSQL:`);
    console.log(`  - Viagens: ${tripsCount}`);
    console.log(`  - Eventos de risco: ${eventsCount}`);
    console.log(`  - Ficheiros GPX: ${gpxCount}`);

    // 2. Eliminar dados no PostgreSQL
    if (tripsCount > 0 || eventsCount > 0 || gpxCount > 0) {
      console.log("\nEliminando dados no PostgreSQL...");
      
      // Eliminar explicitamente tabelas filhas para garantir, seguido de trips
      const deletedGpx = await prisma.gpxData.deleteMany({});
      const deletedEvents = await prisma.tripEvent.deleteMany({});
      const deletedTrips = await prisma.trip.deleteMany({});

      console.log(`✔️ Eliminados no PostgreSQL:`);
      console.log(`  - ${deletedGpx.count} registos GPX`);
      console.log(`  - ${deletedEvents.count} eventos de risco`);
      console.log(`  - ${deletedTrips.count} viagens`);
    } else {
      console.log("✔️ Nenhum dado de viagem encontrado no PostgreSQL.");
    }

    // 3. Eliminar dados no InfluxDB
    console.log("\nLimpando telemetria no InfluxDB...");
    try {
      const url = `${env.INFLUXDB_URL}/api/v2/delete?org=${encodeURIComponent(env.INFLUXDB_ORG)}&bucket=${encodeURIComponent(env.INFLUXDB_BUCKET)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Token ${env.INFLUXDB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start: "1970-01-01T00:00:00Z",
          stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // amanhã
        }),
      });

      if (res.ok) {
        console.log(`✔️ Bucket InfluxDB "${env.INFLUXDB_BUCKET}" limpo com sucesso.`);
      } else {
        const text = await res.text();
        console.error(`⚠️ Falha ao limpar o InfluxDB: ${res.status} - ${text}`);
      }
    } catch (influxErr) {
      console.error("⚠️ Aviso: Falha ao limpar o InfluxDB (o InfluxDB está a correr?):", (influxErr as Error).message);
    }

    // 4. Mostrar estatísticas finais para confirmação
    const finalUsersCount = await prisma.user.count();
    const finalMotosCount = await prisma.motorcycle.count();
    const finalTripsCount = await prisma.trip.count();

    console.log(`\nEstadísticas finais na BD:`);
    console.log(`  - Utilizadores (preservados): ${finalUsersCount}`);
    console.log(`  - Motas (preservadas): ${finalMotosCount}`);
    console.log(`  - Viagens (limpas): ${finalTripsCount}`);

    console.log("\n✨ Limpeza concluída com sucesso!");

  } catch (error) {
    console.error("❌ Erro fatal durante a limpeza:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
