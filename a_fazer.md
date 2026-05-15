🔴 BUGS (Comportamento Incorreto)

| # | Problema | Localização |
|---|----------|-------------|
| 1 | **Reset password: backend gera query param, frontend espera path param** | `auth-reset.controller.ts:68` vs `App.tsx:48` |
| 2 | **Tailwind v4 incompatível com `tailwind.config.js`** | `frontend/package.json` (v4.2.4) vs `tailwind.config.js` (formato v3) |
| 3 | **`ENCRYPTION_KEY` default difere entre `env.ts` e `docker-compose.yml`** | `env.ts:39` vs `docker-compose.yml:106` |
| 4 | **`@types/swagger-jsdoc` e `@types/swagger-ui-express` em `dependencies` (devDependencies)** | `app/package.json:28-29` |

---

### 🟡 Problemas de Arquitetura / Segurança

| # | Problema | Localização |
|---|----------|-------------|
| 5 | **Demo mode bypassa autenticação total** (H1) | `frontend/src/components/auth/ProtectedRoute.tsx:16` |
| 6 | **Ficheiros de planeamento no root do repo** (H2) | `plan.md`, `a_fazer.txt`, etc. |
| 7 | **Código legado não removido** (H3) | `app/backend/legacy/index.js`, `check_trips.js` |
| 8 | **Prisma generated code committed** (H4) | `app/backend/src/generated/prisma/` (14 ficheiros) |
| 9 | **`ENCRYPTION_KEY` em falta no docker-compose.yml** (H5) | `docker-compose.yml` backend service |
| 10 | **`localStorage` para user ID no socket** (H6) | `frontend/src/hooks/useSocket.ts:23-35` |
| 11 | **`localStorage.clear()` sem confirmação** (H7) | `frontend/src/pages/Settings.tsx:460` |
| 12 | **`DEVICE_ID` hardcoded no simulador** (H8) | `simulador/config.py:29` |
| 13 | **Rotas auth (`/auth/me`, `/auth/profile`) sem proteção CSRF** | `routes/index.ts:21-23` |
| 14 | **Volume `./app/backend:/app/backend` sobrescreve `dist/` compilado** | `docker-compose.yml:129` |

---

### 🟠 Problemas de Qualidade / Manutenção

| # | Problema | Localização |
|---|----------|-------------|
| 15 | **Ficheiros órfãos: `VR-Mobil.glb`, `Model.fbx`** | `app/models/`, root `models/` |
| 16 | **Imagens duplicadas com espaços** | `imagens/trail (2).jpg` etc. |
| 17 | **`app/.env` commitado — risco de leak** (L4) | `app/.env` no disco |
| 18 | **`app/frontend/public/fonts/helvetiker_regular.typeface.json` — ficheiro grande desnecessário em VCS** | |
| 19 | **README com versões desatualizadas** (L1): React 18 (real: 19), Prisma 5 (real: 7) | `README.md` |
| 20 | **Coverage thresholds a 80% — provavelmente falha** | `vitest.config.ts:18-23` |
| 21 | **`prisma.config.ts` importa `dotenv/config` mas `dotenv` não está em `package.json`** (funciona por transitive no CLI, mas é frágil) | `prisma.config.ts:3
