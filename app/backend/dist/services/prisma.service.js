"use strict";
// =============================================================================
// MotoGuard IoT — Prisma Service (PostgreSQL)
// =============================================================================
// Singleton do Prisma Client para acesso à base de dados PostgreSQL.
// Usado por controllers e outros services para queries a:
//   · users, motorcycles, trips, trip_events
//
// Nota: criamos um pg.Pool explícito e adicionamos um handler de erro para
// evitar que eventos 'error' não tratados crashem o processo Node.js inteiro.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.prisma = void 0;
const client_1 = require("../generated/prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const env_1 = require("../config/env");
// Pool explícito para podermos ouvir eventos de erro
const pool = new pg_1.Pool({ connectionString: env_1.env.DATABASE_URL });
exports.pool = pool;
// Sem este handler, um erro inesperado no pool (ex: ligação cortada pelo
// servidor, timeout, etc.) emite um evento 'error' que o Node.js trata como
// uma excepção não capturada — matando o processo inteiro.
pool.on("error", (err) => {
    console.error("[pg pool] Erro inesperado no pool de ligações:", err.message);
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
exports.prisma = prisma;
//# sourceMappingURL=prisma.service.js.map