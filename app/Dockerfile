# =============================================================================
# MotoGuard IoT — Dockerfile (Backend apenas)
# =============================================================================
# Opção A (dev): o frontend é servido pelo container dedicado (Vite dev server).
# Este Dockerfile apenas compila e arranca o backend Node.js na porta 3000.
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# ─── Dependências ─────────────────────────────────────────────────────────────
COPY package*.json ./
RUN npm install

# ─── Prisma ───────────────────────────────────────────────────────────────────
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# ─── Backend ──────────────────────────────────────────────────────────────────
COPY backend/ ./backend/
RUN npm run build

# ─── Arrancar ─────────────────────────────────────────────────────────────────
EXPOSE 3000

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
