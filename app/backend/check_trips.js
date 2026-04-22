const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTrips() {
  const trips = await prisma.trip.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5,
    include: {
      motorcycle: true,
      user: true
    }
  });

  console.log(JSON.stringify(trips, null, 2));
  await prisma.$disconnect();
}

checkTrips();
