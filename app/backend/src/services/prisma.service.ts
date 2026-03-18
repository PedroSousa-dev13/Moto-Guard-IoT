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

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "../config/env";

// Pool explícito para podermos ouvir eventos de erro
const pool = new Pool({ connectionString: env.DATABASE_URL });

// Sem este handler, um erro inesperado no pool (ex: ligação cortada pelo
// servidor, timeout, etc.) emite um evento 'error' que o Node.js trata como
// uma excepção não capturada — matando o processo inteiro.
pool.on("error", (err) => {
  console.error("[pg pool] Erro inesperado no pool de ligações:", err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export { prisma, pool };
