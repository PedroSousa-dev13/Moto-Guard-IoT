"use strict";
// =============================================================================
// MotoGuard IoT — Prisma Service (PostgreSQL)
// =============================================================================
// Singleton do Prisma Client para acesso à base de dados PostgreSQL.
// Usado por controllers e outros services para queries a:
//   · users, motorcycles, trips, trip_events
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("../generated/prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const env_1 = require("../config/env");
const adapter = new adapter_pg_1.PrismaPg({ connectionString: env_1.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter });
exports.prisma = prisma;
//# sourceMappingURL=prisma.service.js.map