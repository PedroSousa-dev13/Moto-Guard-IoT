// =============================================================================
// MotoGuard IoT — Prisma Service (PostgreSQL)
// =============================================================================
// Singleton do Prisma Client para acesso à base de dados PostgreSQL.
// Usado por controllers e outros services para queries a:
//   · users, motorcycles, trips, trip_events
// =============================================================================

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export { prisma };
