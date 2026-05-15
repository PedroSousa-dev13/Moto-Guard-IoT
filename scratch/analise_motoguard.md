# Análise do Código - MotoGuard IoT

Data: 14/05/2026

## Resumo Geral
Plataforma IoT para monitorização de motociclos.
- Backend: Node.js/Express + Prisma + PostgreSQL/InfluxDB
- Frontend: React
- ML: Python

## Estado
- Branch: `Pedro`
- Testes: **58/58 passam** ✅
- Issues de segurança resolvidos: **H1-H8 concluídos**

## O que foi corrigido (ronda 2)

### Testes (13 falhas resolvidas)
| Ficheiro | Correção |
|----------|----------|
| `socket.service.test.ts` | Adicionado `use: vi.fn()` ao mock do Server |
| `trip.routes.test.ts` | Adicionado `count: vi.fn()` ao mock; `body.data` (pagination) |
| `validate-telemetry.test.ts` | Adicionado `abs_active`/`tc_active` ao payload |
| `gpx.routes.test.ts` | Mock do `csrfMiddleware` |
| `motorcycle.routes.test.ts` | Mock do `csrfMiddleware` |
| `vitest.config.ts` | Adicionado `dist/**` ao exclude |

### 🔒 Segurança
- **H1** (resolvido): Demo mode bypass removido (`ProtectedRoute.tsx`)
- **H6** (resolvido): `getStoredUserId()` desativado — backend usa JWT no WebSocket
- **H7** (verificado): `Settings.tsx` já tem `window.confirm()` + chaves específicas
- **H8** (resolvido): `DEVICE_ID` no simulador usa `hostname` em vez de fixo
- Hardcoded `"MOTOGUARD-SIM-01"` removido do frontend (`useSocket.ts`)

### 🟡 Resolvido (qualidade)
- `any` types → Tipos concretos em socket.service, gpx.routes, influx.service, realtime-anomaly, trip-clustering, trip-ml-pipeline, gpx-import
- Validação GPX → MIME type, extensão .gpx consistente, range de coordenadas, limite de 100k waypoints, elevação válida
- Python subprocess → stderr capturado em realtime-anomaly; timer leak corrigido no inline script do ML pipeline
- Prisma versionado → `git rm --cached` dos ficheiros gerados; `dist/` adicionado ao .gitignore
