#!/bin/sh

# =============================================================================
# MotoGuard IoT — Docker Entrypoint (Opção A — Dev)
# =============================================================================
# Apenas arranca o backend Node.js.
# O frontend é servido pelo container dedicado (Vite dev server).
# =============================================================================

echo "🚀 Iniciando MotoGuard IoT Backend..."

# Executar migrations
echo "📊 Executando migrations do Prisma..."
npx prisma migrate deploy

# Executar seed dos perfis de mota
echo "🌱 Executando seed dos perfis de mota..."
npx tsx prisma/seed.ts

# Arrancar backend (foreground — o container fica vivo enquanto o processo viver)
echo "🔧 Arrancando backend na porta 3000..."
exec npm start
