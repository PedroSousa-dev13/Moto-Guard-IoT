const { PrismaClient } = require("./dist/generated/prisma/client");
const prisma = new PrismaClient();

async function check() {
  try {
    const trips = await prisma.trip.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        gpxData: true,
        _count: { select: { events: true } }
      }
    });

    console.log("Latest 5 trips:");
    trips.forEach(t => {
      console.log(`- ID: ${t.id}`);
      console.log(`  Source: ${t.source}`);
      console.log(`  Distance: ${t.distanceKm} km`);
      console.log(`  GPX Points: ${t.gpxData?.waypoints?.length ?? "N/A"}`);
      console.log(`  Events: ${t._count.events}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
