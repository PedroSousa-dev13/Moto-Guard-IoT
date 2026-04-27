#!/bin/sh

# =============================================================================
# MotoGuard IoT - Docker Entrypoint (Dev)
# =============================================================================
# Corre migrations, seed e arranca o backend com hot reload (tsx watch).
# =============================================================================

echo "MotoGuard IoT Backend a arrancar..."

# Aguardar pelo PostgreSQL
echo "A aguardar pelo PostgreSQL em postgres:5432..."
until pg_isready -h postgres -p 5432 -U ${POSTGRES_USER:-motoguard}; do
  echo "PostgreSQL ainda não está pronto. A tentar novamente em 2 segundos..."
  sleep 2
done
echo "PostgreSQL está pronto!"

echo "A executar migrations do Prisma..."
npx prisma migrate deploy

echo "A executar seed dos perfis de mota..."
npx tsx prisma/seed.ts

echo "A arrancar backend com hot reload (tsx watch)..."
exec npm run dev:watch
