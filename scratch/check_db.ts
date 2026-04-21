
import { PrismaClient } from './app/backend/src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const trips = await prisma.trip.findMany({
    take: 10,
    orderBy: { startedAt: 'desc' },
    include: {
        user: { select: { email: true } }
    }
  });

  console.log('Recent Trips:');
  trips.forEach(t => {
    console.log(`- ID: ${t.id}, User: ${t.user.email}, Device: ${t.motorcycleId}, Source: ${t.source}, Status: ${t.status}`);
  });

  const associations = await prisma.motorcycle.findMany({
      where: { deviceId: { contains: 'SIM' } },
      include: { user: { select: { email: true } } }
  });

  console.log('\nSimulator Associations:');
  associations.forEach(a => {
      console.log(`- Device: ${a.deviceId}, User: ${a.user.email}, Moto: ${a.name}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
