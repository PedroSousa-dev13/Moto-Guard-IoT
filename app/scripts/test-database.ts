// =============================================================================
// MotoGuard IoT — Teste da Base de Dados PostgreSQL (Etapa 1.5)
// =============================================================================
// Executa CRUD em todas as 4 tabelas e valida relações + enums + cascata.
// Executar com: npx tsx scripts/test-database.ts
// =============================================================================

import { prisma } from "../backend/src/services/prisma.service";

// ─── Cores para output ──────────────────────────────────────────────────────
const OK = "\x1b[32m✅\x1b[0m";
const FAIL = "\x1b[31m❌\x1b[0m";
const HEAD = "\x1b[36m";
const RESET = "\x1b[0m";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ${OK} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}`);
    failed++;
  }
}

async function main() {
  console.log(`\n${HEAD}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${HEAD} MotoGuard — Teste da Base de Dados (Etapa 1.5)${RESET}`);
  console.log(`${HEAD}═══════════════════════════════════════════════════${RESET}\n`);

  // ─── 1. Conexão ─────────────────────────────────────────────────────────
  console.log(`${HEAD}[1/9] Conexão ao PostgreSQL${RESET}`);
  try {
    await prisma.$connect();
    assert(true, "Conexão estabelecida");
  } catch (e) {
    assert(false, `Conexão falhou: ${e}`);
    process.exit(1);
  }

  // ─── 2. Verificar Perfis de Mota (seed) ───────────────────────────
  console.log(`\n${HEAD}[2/9] Verificar perfis de mota (seed)${RESET}`);
  const profileCount = await prisma.motorcycleProfile.count();
  assert(profileCount === 8, `8 perfis na BD (encontrados: ${profileCount})`);

  const scooter = await prisma.motorcycleProfile.findUnique({ where: { name: "Scooter" } });
  assert(scooter !== null, "Perfil 'Scooter' existe");
  assert(scooter!.maxSpeedKmh === 120, "Scooter: velocidade máx = 120 km/h");
  assert(scooter!.crashRollThreshold === 55, "Scooter: crash roll threshold = 55°");
  assert(scooter!.avgWeightKg === 130, "Scooter: peso médio = 130 kg");

  const desportiva = await prisma.motorcycleProfile.findUnique({ where: { name: "Desportiva" } });
  assert(desportiva !== null, "Perfil 'Desportiva' existe");
  assert(desportiva!.maxRpm === 15000, "Desportiva: RPM máx = 15000");
  assert(desportiva!.crashGForce === 3.0, "Desportiva: crash G-force = 3.0");

  const allNames = (await prisma.motorcycleProfile.findMany({ select: { name: true }, orderBy: { name: "asc" } })).map(p => p.name);
  assert(allNames.length === 8, `Todos os 8 perfis: ${allNames.join(", ")}`);

  // ─── 3. Criar User ─────────────────────────────────────────────────────
  console.log(`\n${HEAD}[3/9] Criar utilizador${RESET}`);
  const user = await prisma.user.create({
    data: {
      email: "teste@motoguard.pt",
      passwordHash: "$2b$10$fakehashparateste1234567890",
      name: "Condutor Teste",
    },
  });
  assert(user.id.length > 0, `User criado (id: ${user.id.slice(0, 8)}...)`);
  assert(user.email === "teste@motoguard.pt", "Email correto");
  assert(user.createdAt instanceof Date, "createdAt é Date");

  // ─── 4. Criar Motorcycle com perfil ───────────────────────────────
  console.log(`\n${HEAD}[4/9] Criar mota associada ao user + perfil${RESET}`);
  const moto = await prisma.motorcycle.create({
    data: {
      userId: user.id,
      profileId: scooter!.id,
      name: "A minha PCX",
      brand: "Honda",
      year: 2024,
      deviceId: "MOTOGUARD-SIM-01",
    },
  });
  assert(moto.id.length > 0, `Motorcycle criada (id: ${moto.id.slice(0, 8)}...)`);
  assert(moto.userId === user.id, "FK userId correta");
  assert(moto.profileId === scooter!.id, "FK profileId correta (Scooter)");

  // ─── 5. Criar Trip ─────────────────────────────────────────────────────
  console.log(`\n${HEAD}[5/9] Criar viagem${RESET}`);
  const trip = await prisma.trip.create({
    data: {
      userId: user.id,
      motorcycleId: moto.id,
      startedAt: new Date("2026-03-05T10:00:00Z"),
      endedAt: new Date("2026-03-05T10:45:00Z"),
      distanceKm: 32.5,
      maxSpeedKmh: 95.3,
      avgSpeedKmh: 43.2,
      maxRollDeg: 28.7,
      maxGForce: 1.8,
      status: "COMPLETED",
    },
  });
  assert(trip.id.length > 0, `Trip criada (id: ${trip.id.slice(0, 8)}...)`);
  assert(trip.status === "COMPLETED", "Enum TripStatus funciona");
  assert(trip.distanceKm === 32.5, "distanceKm correto");

  // ─── 6. Criar TripEvents ───────────────────────────────────────────────
  console.log(`\n${HEAD}[6/9] Criar eventos de risco${RESET}`);
  const event1 = await prisma.tripEvent.create({
    data: {
      tripId: trip.id,
      type: "HARD_BRAKING",
      severity: "WARNING",
      message: "Travagem brusca detetada — desaceleração de 0.9G",
      latitude: 41.2951,
      longitude: -7.7463,
      speedKmh: 72.0,
      gForce: 0.9,
      occurredAt: new Date("2026-03-05T10:12:30Z"),
    },
  });
  assert(event1.type === "HARD_BRAKING", "Enum EventType funciona");
  assert(event1.severity === "WARNING", "Enum EventSeverity funciona");

  const event2 = await prisma.tripEvent.create({
    data: {
      tripId: trip.id,
      type: "EXCESSIVE_LEAN",
      severity: "INFO",
      message: "Inclinação de 28.7° — próximo do limite para Scooter",
      latitude: 41.2960,
      longitude: -7.7480,
      speedKmh: 45.0,
      rollDeg: 28.7,
      occurredAt: new Date("2026-03-05T10:20:15Z"),
    },
  });
  assert(event2.id.length > 0, "Segundo evento criado");

  const event3 = await prisma.tripEvent.create({
    data: {
      tripId: trip.id,
      type: "OVERHEAT",
      severity: "CRITICAL",
      message: "Temperatura do motor a 98°C — acima do limiar de 95°C",
      latitude: 41.2975,
      longitude: -7.7500,
      speedKmh: 12.0,
      engineTempC: 98.0,
      occurredAt: new Date("2026-03-05T10:35:00Z"),
    },
  });
  assert(event3.severity === "CRITICAL", "Evento CRITICAL criado");

  // ─── 7. Queries com relações ──────────────────────────────────────────
  console.log(`\n${HEAD}[7/9] Queries com relações (include/nested)${RESET}`);

  // User com motas e viagens
  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      motorcycles: { include: { profile: true } },
      trips: { include: { events: true } },
    },
  });
  assert(userFull!.motorcycles.length === 1, "User tem 1 mota");
  assert(userFull!.motorcycles[0].profile!.name === "Scooter", "Mota tem perfil 'Scooter' associado");
  assert(userFull!.trips.length === 1, "User tem 1 viagem");
  assert(userFull!.trips[0].events.length === 3, "Viagem tem 3 eventos");

  // Trip com motorcycle e events
  const tripFull = await prisma.trip.findUnique({
    where: { id: trip.id },
    include: { motorcycle: true, events: { orderBy: { occurredAt: "asc" } } },
  });
  assert(tripFull!.motorcycle.name === "A minha PCX", "Relação Trip→Motorcycle OK");
  assert(tripFull!.events[0].type === "HARD_BRAKING", "Primeiro evento ordenado por data");
  assert(tripFull!.events[2].type === "OVERHEAT", "Último evento ordenado por data");

  // Filtrar eventos por severidade
  const criticalEvents = await prisma.tripEvent.findMany({
    where: { severity: "CRITICAL" },
  });
  assert(criticalEvents.length === 1, "Filtro por severity CRITICAL OK");

  // Filtrar eventos por tipo
  const brakingEvents = await prisma.tripEvent.findMany({
    where: { type: "HARD_BRAKING" },
  });
  assert(brakingEvents.length === 1, "Filtro por type HARD_BRAKING OK");

  // ─── 8. Relação Profile → Motorcycles ───────────────────────────────
  console.log(`\n${HEAD}[8/9] Relação Profile → Motorcycles${RESET}`);
  const scooterWithMotos = await prisma.motorcycleProfile.findUnique({
    where: { name: "Scooter" },
    include: { motorcycles: true },
  });
  assert(scooterWithMotos!.motorcycles.length === 1, "Perfil Scooter tem 1 mota associada");
  assert(scooterWithMotos!.motorcycles[0].name === "A minha PCX", "A mota é 'A minha PCX'");

  // ─── 9. Cascade Delete ─────────────────────────────────────────────
  console.log(`\n${HEAD}[9/9] Cascade delete${RESET}`);

  // Apagar o user deve apagar tudo em cascata
  await prisma.user.delete({ where: { id: user.id } });

  const remainingMotos = await prisma.motorcycle.count();
  const remainingTrips = await prisma.trip.count();
  const remainingEvents = await prisma.tripEvent.count();

  assert(remainingMotos === 0, "Cascade: motorcycles apagadas");
  assert(remainingTrips === 0, "Cascade: trips apagadas");
  assert(remainingEvents === 0, "Cascade: trip_events apagados");

  // ─── Resultado ────────────────────────────────────────────────────────
  console.log(`\n${HEAD}═══════════════════════════════════════════════════${RESET}`);
  console.log(`  Total: ${passed + failed} testes | ${OK} ${passed} passed | ${failed > 0 ? FAIL : "⬚"} ${failed} failed`);
  console.log(`${HEAD}═══════════════════════════════════════════════════${RESET}\n`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(`\n${FAIL} Erro inesperado:`, e);
  await prisma.$disconnect();
  process.exit(1);
});
