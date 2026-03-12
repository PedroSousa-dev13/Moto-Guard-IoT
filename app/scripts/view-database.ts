// =============================================================================
// MotoGuard IoT — Script: Visualizar Dados da Base de Dados
// =============================================================================
// Comandos úteis para consultar dados das tabelas via Prisma
// =============================================================================

import { prisma } from "../backend/src/services/prisma.service";

async function showTrips(limit = 10) {
  console.log("\n=== VIAGENS (Trips) ===");
  const trips = await prisma.trip.findMany({
    take: limit,
    orderBy: { startedAt: "desc" },
    include: {
      motorcycle: { select: { name: true, deviceId: true } },
      user: { select: { email: true } },
      _count: { select: { events: true } },
    },
  });

  for (const trip of trips) {
    console.log(`\nID: ${trip.id}`);
    console.log(`  User: ${trip.user.email}`);
    console.log(`  Mota: ${trip.motorcycle.name} (${trip.motorcycle.deviceId})`);
    console.log(`  Início: ${trip.startedAt.toISOString()}`);
    console.log(`  Fim: ${trip.endedAt?.toISOString() || "N/A"}`);
    console.log(`  Status: ${trip.status}`);
    console.log(`  Distância: ${trip.distanceKm?.toFixed(2) || "0"} km`);
    console.log(`  Vel. Máx: ${trip.maxSpeedKmh?.toFixed(1) || "0"} km/h`);
    console.log(`  Eventos: ${trip._count.events}`);
  }
}

async function showTripEvents(limit = 20) {
  console.log("\n=== EVENTOS DE RISCO (TripEvents) ===");
  const events = await prisma.tripEvent.findMany({
    take: limit,
    orderBy: { occurredAt: "desc" },
    include: {
      trip: { select: { id: true, motorcycle: { select: { name: true } } } },
    },
  });

  for (const event of events) {
    console.log(`\nID: ${event.id}`);
    console.log(`  Tipo: ${event.type} (${event.severity})`);
    console.log(`  Mensagem: ${event.message}`);
    console.log(`  Viagem: ${event.trip.motorcycle.name}`);
    console.log(`  GPS: ${event.latitude}, ${event.longitude}`);
    console.log(`  Velocidade: ${event.speedKmh} km/h`);
    console.log(`  Roll: ${event.rollDeg}° | G-Force: ${event.gForce}`);
    console.log(`  Timestamp: ${event.occurredAt.toISOString()}`);
  }
}

async function showMotorcycles() {
  console.log("\n=== MOTAS (Motorcycles) ===");
  const motorcycles = await prisma.motorcycle.findMany({
    include: {
      user: { select: { email: true } },
      profile: { select: { name: true } },
      _count: { select: { trips: true } },
    },
  });

  for (const moto of motorcycles) {
    console.log(`\nID: ${moto.id}`);
    console.log(`  Nome: ${moto.name}`);
    console.log(`  Marca: ${moto.brand || "N/A"}`);
    console.log(`  Device ID: ${moto.deviceId || "N/A"}`);
    console.log(`  Perfil: ${moto.profile?.name || "N/A"}`);
    console.log(`  User: ${moto.user.email}`);
    console.log(`  Viagens: ${moto._count.trips}`);
  }
}

async function showUsers() {
  console.log("\n=== UTILIZADORES (Users) ===");
  const users = await prisma.user.findMany({
    include: {
      _count: { select: { motorcycles: true, trips: true } },
    },
  });

  for (const user of users) {
    console.log(`\nID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Nome: ${user.name || "N/A"}`);
    console.log(`  Motas: ${user._count.motorcycles}`);
    console.log(`  Viagens: ${user._count.trips}`);
    console.log(`  Criado: ${user.createdAt.toISOString()}`);
  }
}

async function showStats() {
  console.log("\n=== ESTATÍSTICAS ===");
  const users = await prisma.user.count();
  const motorcycles = await prisma.motorcycle.count();
  const trips = await prisma.trip.count();
  const activeTrips = await prisma.trip.count({ where: { status: "ACTIVE" } });
  const completedTrips = await prisma.trip.count({ where: { status: "COMPLETED" } });
  const events = await prisma.tripEvent.count();

  console.log(`Utilizadores: ${users}`);
  console.log(`Motas: ${motorcycles}`);
  console.log(`Viagens: ${trips} (Ativas: ${activeTrips}, Completadas: ${completedTrips})`);
  console.log(`Eventos de risco: ${events}`);
}

// Comando principal
const command = process.argv[2] || "stats";
const limit = parseInt(process.argv[3]) || 10;

async function main() {
  try {
    switch (command) {
      case "trips":
        await showTrips(limit);
        break;
      case "events":
        await showTripEvents(limit);
        break;
      case "motorcycles":
      case "motas":
        await showMotorcycles();
        break;
      case "users":
        await showUsers();
        break;
      case "stats":
      default:
        await showStats();
        break;
    }
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
