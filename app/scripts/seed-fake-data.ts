import { prisma } from '../backend/src/services/prisma.service';
import { TripSource, TripStatus, TripCategory, DrivingStyle, EventType, EventSeverity } from '../backend/src/generated/prisma/client';
import bcrypt from 'bcryptjs';

// coordinates near Lisbon and Porto, Portugal
const routePoints = [
  { lat: 38.71667, lon: -9.13333 }, // Lisbon
  { lat: 38.73694, lon: -9.14268 }, // Saldanha
  { lat: 38.74812, lon: -9.16001 }, // Campo Grande
  { lat: 38.75923, lon: -9.17992 }, // Benfica
  { lat: 38.78111, lon: -9.18991 }, // Odivelas
  { lat: 38.80222, lon: -9.20012 }, // Loures
  { lat: 38.72234, lon: -9.28123 }, // Oeiras
  { lat: 38.70123, lon: -9.41234 }, // Cascais
  { lat: 38.79812, lon: -9.38912 }, // Sintra
  { lat: 38.96123, lon: -9.32981 }, // Mafra
  { lat: 38.72522, lon: -8.99123 }, // Montijo
  { lat: 38.65912, lon: -9.05981 }, // Barreiro
  { lat: 38.52431, lon: -8.89321 }, // Setúbal
  { lat: 38.56891, lon: -7.90981 }, // Évora
  { lat: 41.14961, lon: -8.61099 }, // Porto
  { lat: 41.16212, lon: -8.62341 }, // Boavista
  { lat: 41.18123, lon: -8.68912 }, // Matosinhos
  { lat: 41.15123, lon: -8.58123 }, // Gondomar
  { lat: 41.22981, lon: -8.62912 }, // Maia
  { lat: 41.33231, lon: -8.72123 }, // Vila do Conde
  { lat: 41.55032, lon: -8.42005 }, // Braga
  { lat: 41.44253, lon: -8.29178 }, // Guimarães
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function getRandomIntInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('Starting seed-fake-data...');

  // Update password to 'password123' for all users
  const users = await prisma.user.findMany();
  const passwordHash = await bcrypt.hash('password123', 12);
  for (const u of users) {
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash }
    });
  }
  console.log(`Updated password to 'password123' for all ${users.length} users.`);

  // 1. Get all motorcycles
  const motorcycles = await prisma.motorcycle.findMany({
    include: { profile: true }
  });

  if (motorcycles.length === 0) {
    console.log('No motorcycles found in the database. Run seed.ts first or create some in the app!');
    return;
  }

  console.log(`Found ${motorcycles.length} motorcycles to seed data for.`);

  // Clean up existing trips & events first to start fresh and clean
  console.log('Cleaning up existing trips and events to start with clean mock data...');
  await prisma.tripEvent.deleteMany({});
  await prisma.trip.deleteMany({});
  console.log('Cleanup done!');

  for (const moto of motorcycles) {
    console.log(`\nGenerating trips for motorcycle: "${moto.name}" (${moto.profile?.name || 'N/A'}) belonging to User ID: ${moto.userId}`);

    // Create 6 completed trips of different styles for each motorcycle
    const tripConfigs = [
      {
        category: TripCategory.COMMUTE,
        drivingStyle: DrivingStyle.DEFENSIVE,
        distanceKm: 12.4,
        avgSpeed: 42.5,
        maxSpeed: 82.0,
        maxRoll: 18.2,
        maxG: 1.1,
        mlScore: 0.08,
        hoursAgoStart: 48,
        durationMinutes: 20
      },
      {
        category: TripCategory.WEEKEND_RIDE,
        drivingStyle: DrivingStyle.AGGRESSIVE,
        distanceKm: 85.6,
        avgSpeed: 78.4,
        maxSpeed: 145.0,
        maxRoll: 42.1,
        maxG: 1.9,
        mlScore: 0.76,
        hoursAgoStart: 36,
        durationMinutes: 75
      },
      {
        category: TripCategory.WEEKEND_RIDE,
        drivingStyle: DrivingStyle.DEFENSIVE,
        distanceKm: 120.3,
        avgSpeed: 68.2,
        maxSpeed: 110.0,
        maxRoll: 29.5,
        maxG: 1.3,
        mlScore: 0.12,
        hoursAgoStart: 24,
        durationMinutes: 110
      },
      {
        category: TripCategory.COMMUTE,
        drivingStyle: DrivingStyle.ECONOMY,
        distanceKm: 8.2,
        avgSpeed: 32.1,
        maxSpeed: 65.0,
        maxRoll: 12.4,
        maxG: 0.95,
        mlScore: 0.03,
        hoursAgoStart: 12,
        durationMinutes: 15
      },
      {
        category: TripCategory.COMMUTE,
        drivingStyle: DrivingStyle.AGGRESSIVE,
        distanceKm: 14.8,
        avgSpeed: 52.0,
        maxSpeed: 98.0,
        maxRoll: 32.0,
        maxG: 1.6,
        mlScore: 0.45,
        hoursAgoStart: 4,
        durationMinutes: 18
      },
      {
        category: TripCategory.OFF_ROAD,
        drivingStyle: DrivingStyle.DEFENSIVE,
        distanceKm: 24.5,
        avgSpeed: 28.6,
        maxSpeed: 62.0,
        maxRoll: 25.4,
        maxG: 1.8,
        mlScore: 0.28,
        hoursAgoStart: 2,
        durationMinutes: 45
      }
    ];

    for (let i = 0; i < tripConfigs.length; i++) {
      const config = tripConfigs[i];
      const startedAt = new Date();
      startedAt.setHours(startedAt.getHours() - config.hoursAgoStart);
      const endedAt = new Date(startedAt.getTime() + config.durationMinutes * 60 * 1000);

      const trip = await prisma.trip.create({
        data: {
          userId: moto.userId,
          motorcycleId: moto.id,
          source: TripSource.SIMULATOR,
          startedAt,
          endedAt,
          distanceKm: config.distanceKm,
          maxSpeedKmh: config.maxSpeed,
          avgSpeedKmh: config.avgSpeed,
          maxRollDeg: config.maxRoll,
          maxGForce: config.maxG,
          status: TripStatus.COMPLETED,
          mlScore: config.mlScore,
          mlModelVersion: 'motoguard-xgboost-v1.4',
          category: config.category,
          categoryConfidence: 0.92,
          drivingStyle: config.drivingStyle,
        }
      });

      console.log(`  Created trip ID: ${trip.id} - Category: ${config.category}, Distance: ${config.distanceKm} km`);

      // Add a few realistic events during the trip depending on the style
      let numEvents = 0;
      if (config.drivingStyle === DrivingStyle.AGGRESSIVE) {
        numEvents = getRandomIntInRange(3, 5);
      } else if (config.drivingStyle === DrivingStyle.DEFENSIVE) {
        numEvents = getRandomIntInRange(0, 2);
      } else {
        numEvents = getRandomIntInRange(0, 1);
      }

      for (let j = 0; j < numEvents; j++) {
        const routePoint = getRandomElement(routePoints);
        const eventOffsetMs = getRandomIntInRange(1 * 60 * 1000, (config.durationMinutes - 1) * 60 * 1000);
        const occurredAt = new Date(startedAt.getTime() + eventOffsetMs);

        // Event type configuration
        let eventType = EventType.HARD_BRAKING;
        let severity = EventSeverity.WARNING;
        let message = 'Travagem brusca detetada';
        let rollDeg = getRandomInRange(10, 25);
        let gForce = getRandomInRange(1.2, 1.8);
        let speed = getRandomInRange(45, 90);
        let engineTemp = getRandomInRange(75, 98);
        let voltage = getRandomInRange(13.2, 14.1);

        const eventChoice = getRandomIntInRange(1, 6);
        if (eventChoice === 1) {
          eventType = EventType.HARD_BRAKING;
          severity = EventSeverity.WARNING;
          gForce = getRandomInRange(1.4, 2.0);
          message = `Travagem brusca de ${gForce.toFixed(2)}G detetada`;
        } else if (eventChoice === 2) {
          eventType = EventType.RAPID_ACCELERATION;
          severity = EventSeverity.INFO;
          gForce = getRandomInRange(1.1, 1.5);
          message = `Aceleração rápida de ${gForce.toFixed(2)}G detetada`;
        } else if (eventChoice === 3) {
          eventType = EventType.EXCESSIVE_LEAN;
          severity = config.drivingStyle === DrivingStyle.AGGRESSIVE ? EventSeverity.CRITICAL : EventSeverity.WARNING;
          rollDeg = getRandomInRange(35, 52);
          message = `Inclinação extrema de ${rollDeg.toFixed(1)}° registada`;
        } else if (eventChoice === 4) {
          eventType = EventType.SPEEDING;
          severity = EventSeverity.WARNING;
          speed = getRandomInRange(125, 155);
          message = `Excesso de velocidade registado: ${speed.toFixed(0)} km/h`;
        } else if (eventChoice === 5) {
          eventType = EventType.ENGINE_OVERREV;
          severity = EventSeverity.WARNING;
          message = 'Rotação excessiva do motor detetada (Redline)';
        } else {
          eventType = EventType.HIGH_VIBRATION;
          severity = EventSeverity.INFO;
          message = 'Vibração anómala no chassis detetada';
        }

        await prisma.tripEvent.create({
          data: {
            tripId: trip.id,
            type: eventType,
            severity,
            message,
            latitude: routePoint.lat + getRandomInRange(-0.005, 0.005),
            longitude: routePoint.lon + getRandomInRange(-0.005, 0.005),
            speedKmh: speed,
            rollDeg,
            gForce,
            engineTempC: engineTemp,
            voltage,
            occurredAt
          }
        });
      }
    }
  }

  // Create one active trip for the first motorcycle to showcase active real-time status in Dashboard/Map!
  const activeMoto = motorcycles[0];
  const activeTrip = await prisma.trip.create({
    data: {
      userId: activeMoto.userId,
      motorcycleId: activeMoto.id,
      source: TripSource.SIMULATOR,
      startedAt: new Date(),
      status: TripStatus.ACTIVE,
    }
  });

  // Add an initial event to the active trip
  const activePoint = routePoints[0];
  await prisma.tripEvent.create({
    data: {
      tripId: activeTrip.id,
      type: EventType.SAFETY_SYSTEM_ACTIVE,
      severity: EventSeverity.INFO,
      message: 'Sistema de monitorização ativo em tempo real',
      latitude: activePoint.lat,
      longitude: activePoint.lon,
      speedKmh: 45.0,
      rollDeg: 5.2,
      gForce: 1.0,
      engineTempC: 82.0,
      voltage: 13.8,
      occurredAt: new Date()
    }
  });

  console.log(`\nSuccessfully created active trip ID: ${activeTrip.id} for motorcycle ${activeMoto.name}`);

  console.log('\nSeed completed successfully!');
}

main()
  .catch(e => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
