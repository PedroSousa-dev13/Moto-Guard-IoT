#!/usr/bin/env bash
# =========================================================================
# MotoGuard IoT — Setup Rápido (Linux / macOS)
# =========================================================================

set -euo pipefail

echo ""
echo "=== MotoGuard IoT — Setup ==="
echo ""

# 1. .env
if [ ! -f "app/.env" ] && [ -f "app/.env.example" ]; then
    cp app/.env.example app/.env
    echo "[OK] .env criado a partir de .env.example"
else
    echo "[SKIP] .env já existe"
fi

# 2. npm install
echo ""
echo "A instalar dependências..."
cd app
npm install
echo "[OK] Dependências instaladas"

# 3. Prisma generate
echo ""
echo "A gerar Prisma client..."
npx prisma generate
echo "[OK] Prisma client gerado"

# 4. Migrate
echo ""
echo "A correr migrations..."
npx prisma migrate dev --name init 2>/dev/null || true
echo "[OK] Migrations aplicadas"

# 5. Seed
echo ""
echo "A popular BD..."
npx tsx prisma/seed.ts 2>/dev/null || true
echo "[OK] Seed concluído"

cd ..
echo ""
echo "=== Setup concluído! ==="
echo ""
echo "Comandos:"
echo "  npm run dev       — backend com hot-reload"
echo "  npm run dev:watch — backend com watch"
echo "  npm test          — testes"
echo ""
echo "Swagger UI: http://localhost:3000/api-docs"
echo ""
