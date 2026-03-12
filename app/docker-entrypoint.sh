#!/bin/sh

# =============================================================================
# MotoGuard IoT - Docker Entrypoint (Dev)
# =============================================================================
# Corre migrations, seed e arranca o backend com hot reload (tsx watch).
# =============================================================================

echo "MotoGuard IoT Backend a arrancar..."

echo "A executar migrations do Prisma..."
npx prisma migrate deploy

echo "A executar seed dos perfis de mota..."
npx tsx prisma/seed.ts

echo "A arrancar backend com hot reload (tsx watch)..."
exec npm run dev:watch
