// =============================================================================
// MotoGuard IoT — Seed: Perfis de Motas (config.py → PostgreSQL)
// =============================================================================
// Insere os 8 perfis de classe de mota na tabela motorcycle_profiles.
// Dados extraídos de simulador/config.py — PERFIS_MOTO.
// Executar com: npx tsx prisma/seed.ts
// =============================================================================

import { prisma } from "../backend/src/services/prisma.service";

const profiles = [
  {
    name: "Scooter",
    example: "Honda PCX 125, Yamaha XMAX 300",
    ccMin: 50,
    ccMax: 300,
    maxSpeedKmh: 120,
    maxRpm: 9000,
    engineTempMin: 60,
    engineTempMax: 90,
    voltageMin: 11.5,
    voltageMax: 14.5,
    typicalMaxRollDeg: 25,
    avgWeightKg: 130,
    crashRollThreshold: 55,
    crashPitchThreshold: 45,
    crashGForce: 2.0,
    crashConfirmSec: 2,
    criticalRpm: 8500,
    criticalTemp: 95,
    criticalVoltage: 11.0,
  },
  {
    name: "Naked",
    example: "Yamaha MT-07, KTM Duke 890",
    ccMin: 300,
    ccMax: 1000,
    maxSpeedKmh: 200,
    maxRpm: 12000,
    engineTempMin: 70,
    engineTempMax: 105,
    voltageMin: 11.5,
    voltageMax: 14.5,
    typicalMaxRollDeg: 40,
    avgWeightKg: 190,
    crashRollThreshold: 70,
    crashPitchThreshold: 55,
    crashGForce: 2.5,
    crashConfirmSec: 2,
    criticalRpm: 11000,
    criticalTemp: 110,
    criticalVoltage: 11.0,
  },
  {
    name: "Desportiva",
    example: "Yamaha R1, Honda CBR1000RR",
    ccMin: 600,
    ccMax: 1000,
    maxSpeedKmh: 299,
    maxRpm: 15000,
    engineTempMin: 80,
    engineTempMax: 110,
    voltageMin: 11.5,
    voltageMax: 14.5,
    typicalMaxRollDeg: 55,
    avgWeightKg: 200,
    crashRollThreshold: 85,
    crashPitchThreshold: 65,
    crashGForce: 3.0,
    crashConfirmSec: 2,
    criticalRpm: 14000,
    criticalTemp: 115,
    criticalVoltage: 11.0,
  },
  {
    name: "Trail / Adventure",
    example: "BMW R1250GS, Honda Africa Twin",
    ccMin: 650,
    ccMax: 1250,
    maxSpeedKmh: 200,
    maxRpm: 10000,
    engineTempMin: 70,
    engineTempMax: 100,
    voltageMin: 11.5,
    voltageMax: 14.5,
    typicalMaxRollDeg: 35,
    avgWeightKg: 230,
    crashRollThreshold: 65,
    crashPitchThreshold: 50,
    crashGForce: 2.0,
    crashConfirmSec: 3,
    criticalRpm: 9000,
    criticalTemp: 105,
    criticalVoltage: 11.0,
  },
  {
    name: "Custom / Cruiser",
    example: "Harley Davidson Sportster, Indian Scout",
    ccMin: 800,
    ccMax: 1900,
    maxSpeedKmh: 180,
    maxRpm: 7000,
    engineTempMin: 65,
    engineTempMax: 95,
    voltageMin: 11.5,
    voltageMax: 14.5,
    typicalMaxRollDeg: 30,
    avgWeightKg: 300,
    crashRollThreshold: 50,
    crashPitchThreshold: 40,
    crashGForce: 1.8,
    crashConfirmSec: 2,
    criticalRpm: 6500,
    criticalTemp: 100,
    criticalVoltage: 11.0,
  },
  {
    name: "Motocross / Enduro",
    example: "KTM 450 EXC, Honda CRF250",
    ccMin: 125,
    ccMax: 450,
    maxSpeedKmh: 130,
    maxRpm: 13000,
    engineTempMin: 80,
    engineTempMax: 115,
    voltageMin: 11.5,
    voltageMax: 14.5,
    typicalMaxRollDeg: 40,
    avgWeightKg: 110,
    crashRollThreshold: 75,
    crashPitchThreshold: 60,
    crashGForce: 3.5,
    crashConfirmSec: 3,
    criticalRpm: 12500,
    criticalTemp: 120,
    criticalVoltage: 11.0,
  },
  {
    name: "Touring",
    example: "Honda Gold Wing, BMW K1600GTL",
    ccMin: 1000,
    ccMax: 1800,
    maxSpeedKmh: 220,
    maxRpm: 8000,
    engineTempMin: 60,
    engineTempMax: 95,
    voltageMin: 11.5,
    voltageMax: 14.5,
    typicalMaxRollDeg: 30,
    avgWeightKg: 350,
    crashRollThreshold: 45,
    crashPitchThreshold: 35,
    crashGForce: 1.5,
    crashConfirmSec: 2,
    criticalRpm: 7500,
    criticalTemp: 100,
    criticalVoltage: 11.0,
  },
  {
    name: "Supermotard",
    example: "Husqvarna 701, KTM 690 SMC",
    ccMin: 450,
    ccMax: 700,
    maxSpeedKmh: 160,
    maxRpm: 11000,
    engineTempMin: 75,
    engineTempMax: 110,
    voltageMin: 11.5,
    voltageMax: 14.5,
    typicalMaxRollDeg: 50,
    avgWeightKg: 150,
    crashRollThreshold: 80,
    crashPitchThreshold: 60,
    crashGForce: 3.0,
    crashConfirmSec: 2,
    criticalRpm: 10500,
    criticalTemp: 115,
    criticalVoltage: 11.0,
  },
];

async function seed() {
  console.log("\nMotoGuard — Seed: Perfis de Motas\n");

  const { count } = await prisma.motorcycleProfile.createMany({
    data: profiles,
    skipDuplicates: true,
  });

  console.log(`  ${count} perfis inseridos (${profiles.length - count} já existiam)`);

  const total = await prisma.motorcycleProfile.count();
  console.log(`\n  Total de perfis na BD: ${total}\n`);

  await prisma.$disconnect();
}

seed().catch(async (e) => {
  console.error("❌ Erro no seed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
