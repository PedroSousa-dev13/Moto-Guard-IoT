# MotoGuard IoT — Audit Report

**Date:** 2026-05-13

---

## HIGH SEVERITY

### H1. Demo mode bypasses authentication
`app/frontend/src/components/auth/ProtectedRoute.tsx:16` — Demo mode allows full access to all protected routes without any authentication.

### H2. Planning files littering repository root
`plan.md`, `a_fazer.txt`, `committs.txt`, `organização.txt`, `erors.tsxt`, `implementation_plan.md`, `PROJECT_GAP_ANALYSIS.md`, `irl.txt`, `logs.txt`, `Proposta_Licenciatura.txt`, `Instrucoes_Pitch.txt`, `Instrucoes_Pitch.pdf`, `050 - cristianop - Proposta_Licenciatura_25_26_CGP_AR.pdf`

### H3. Legacy code not removed
`app/backend/legacy/index.js` (210 lines), `app/backend/legacy/check_trips.js` (31 lines) — obsolete files.

### H4. Prisma generated code committed to git
`app/backend/src/generated/prisma/` — 14 files, ~2000+ lines of auto-generated code that should be in `.gitignore`.

### H5. Missing ENCRYPTION_KEY in docker-compose.yml
Backend service missing `ENCRYPTION_KEY`. Falls back to hardcoded `"change-me-generate-random-32-bytes-hex"`.

### H6. getStoredUserId() uses localStorage
`app/frontend/src/hooks/useSocket.ts:23-35` — Reads user ID from `localStorage.getItem("user")` or `sessionStorage`, injectable.

### H7. localStorage.clear() in Settings
`app/frontend/src/pages/Settings.tsx:460` — Destroys all localStorage data without proper confirmation.

### H8. DEVICE_ID hardcoded in simulator
`simulador/config.py:29` — `DEVICE_ID = "MOTOGUARD-SIM-01"`. All simulators use the same device ID.

---

## MEDIUM SEVERITY

### M1. Missing APP_URL and RESEND_API_KEY in docker-compose.yml
Backend service missing these env vars. Email service will not work in Docker.

### M2. Volume mount overrides container build
`docker-compose.yml:121` — `- ./app/backend:/app/backend` mounts local source over compiled `dist/`.

### M3. Auth reset routes lack rate limiting
`forgotPassword`, `verifyResetToken`, `resetPassword` — no rate limiting, no brute-force protection.

### M4. `as any` type safety violations
7+ cases across `auth-reset.controller.ts`, `trip.controller.ts`, `mqtt.service.ts`, `gpx.controller.ts`, `useSocket.ts`.

---

## LOW SEVERITY

### L1. README outdated versions
Claims React 18.x (actual: 19.x), Prisma 5.x (actual: 7.x), Node 20.x (not pinned).

### L2. README placeholder screenshots
8 placeholder blocks with comments like `<!-- ADICIONAR SCREENSHOTS -->`.

### L3. Duplicate images in public/motos/
Files like `trail.jpg`, `trail.png`, `trail (2).jpg` — duplicates and filenames with spaces.

### L4. app/.env on disk — risk of accidental commit

### L5. Orphaned 3D model `app/models/VR-Mobil.glb`

---

## TypeScript: 0 errors
## Tests: 58/58 passing
## Simulator: idle (waiting for command)
