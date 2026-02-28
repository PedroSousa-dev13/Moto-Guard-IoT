# =============================================================================
# MotoGuard IoT — Dockerfile (Backend TypeScript + Frontend Build)
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# ─── Backend ─────────────────────────────────────────────────────────────────
# Instalar dependências do backend primeiro (cache de camadas)
COPY package*.json ./
RUN npm install

# Copiar código do backend e compilar TypeScript
COPY backend/ ./backend/
RUN npm run build

# ─── Frontend ────────────────────────────────────────────────────────────────
# Instalar dependências e fazer build do React
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ─── Arrancar ────────────────────────────────────────────────────────────────
EXPOSE 3000
CMD ["npm", "run", "start"]
