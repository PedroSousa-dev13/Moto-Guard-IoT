import { prisma } from "../backend/src/services/prisma.service";

async function check() {
  console.log("motorcycle_profiles:", await prisma.motorcycleProfile.count());
  console.log("users:", await prisma.user.count());
  console.log("motorcycles:", await prisma.motorcycle.count());
  console.log("trips:", await prisma.trip.count());
  console.log("trip_events:", await prisma.tripEvent.count());

  const profiles = await prisma.motorcycleProfile.findMany({
    select: { name: true, maxSpeedKmh: true, crashGForce: true },
    orderBy: { name: "asc" },
  });
  console.log("\nPerfis na BD:");
  profiles.forEach((p) => console.log(`  · ${p.name} (${p.maxSpeedKmh} km/h, ${p.crashGForce}G)`));

  await prisma.$disconnect();
}
check();
