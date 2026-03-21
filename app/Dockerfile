# =============================================================================
# MotoGuard IoT — Dockerfile (Backend + Frontend Build)
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Instalar Python e dependências ML (usar pacotes apk pré-compilados para Alpine/musl)
RUN apk add --no-cache python3 py3-pip py3-numpy py3-scipy py3-scikit-learn py3-joblib

# ─── Backend ─────────────────────────────────────────────────────────────────
# Instalar dependências do backend primeiro (cache de camadas)
COPY package*.json ./
COPY docker-entrypoint.sh ./
RUN node -e "const fs=require('fs'); for (const file of ['package.json','docker-entrypoint.sh']) { const path='/app/' + file; let data=fs.readFileSync(path); if (data[0]===0xEF && data[1]===0xBB && data[2]===0xBF) data=data.subarray(3); fs.writeFileSync(path, data); }" \
 && sed -i 's/\r$//' docker-entrypoint.sh \
 && chmod +x docker-entrypoint.sh
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
# Executar migrations, seed e arrancar o backend com hot reload
ENTRYPOINT ["/app/docker-entrypoint.sh"]
