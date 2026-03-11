# =============================================================================
# MotoGuard IoT — Dockerfile (Backend + Frontend Build)
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# ─── Backend ─────────────────────────────────────────────────────────────────
# Instalar dependências do backend primeiro (cache de camadas)
COPY package*.json ./
RUN npm install

# Copiar Prisma schema e gerar client
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Copiar código do backend
COPY backend/ ./backend/

# Compilar TypeScript → JavaScript
RUN npm run build

# ─── Frontend ────────────────────────────────────────────────────────────────
# Instalar dependências e fazer build do React
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ─── Arrancar ────────────────────────────────────────────────────────────────
EXPOSE 3000
# Executar migrations (1.9), seed dos perfis (1.10) e arrancar o servidor
CMD sh -c "npx prisma migrate deploy && npx tsx prisma/seed.ts && exec npm run start"
