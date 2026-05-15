# Decisões Pendentes — MotoGuard IoT

> Itens detetados na análise pente fino que **requerem decisão tua ou trabalho mais extenso**.
> Marca a caixa quando decidires.

---

## 🔴 Segurança

- [ ] **#8 — Reset token como JWT (replay risk)**
  - **Problema:** Tokens de reset são JWTs assinados com o mesmo `JWT_SECRET`. Se o segredo for comprometido, todos os tokens podem ser forjados.
  - **Risco:** Médio-Alto.
  - **Opções:**
    - [ ] Mudar para `crypto.randomBytes(32).toString('hex')` (requer migração DB + alteração controller)
    - [ ] Manter JWT mas adicionar `jti` unique + invalidar na BD (já feito parcialmente)
    - [ ] Outra: ___________________
  - **Localização:** `app/backend/src/controllers/auth-reset.controller.ts:18-19`

---

## 🟡 Arquitetura / Performance

- [ ] **#11 — Memory leak: Maps crescem sem limite no SocketService**
  - **Problema:** 12+ `Map` objects armazenam estado por device. Se devices conectam/desconectam sem cleanup adequado, crescem indefinidamente.
  - **Risco:** Médio (já existe `clearDeviceRuntimeState` mas pode não cobrir todos os edge cases).
  - **Opções:**
    - [ ] Adicionar eviction periódica de entries stale (ex: TTL de 1h)
    - [ ] Adicionar métrica de monitoring para tamanho das Maps
    - [ ] Manter como está (cleanup já cobre casos normais)
    - [ ] Outra: ___________________
  - **Localização:** `app/backend/src/services/socket.service.ts:64-81`

- [ ] **#39 — Python spawn per-request para ML inference**
  - **Problema:** Cada inferência ML faz spawn de um novo processo Python (~100-500ms overhead). Impraticável a 10Hz em tempo real.
  - **Risco:** Performance.
  - **Opções:**
    - [ ] Usar processo Python persistente com IPC (socket/pipe)
    - [ ] Portar Isolation Forest para TypeScript (biblioteca `ml-isolation-forest`)
    - [ ] Manter como está (funcional mas lento)
    - [ ] Outra: ___________________
  - **Localização:** `app/backend/src/services/realtime-anomaly.service.ts:143-178`

---

## 🟠 Qualidade / Manutenção

- [ ] **#12 — Ownership check fragil no endpoint de alertas**
  - **Problema:** `tripId` query parameter é usado diretamente no `where`. Prisma relations protegem, mas a lógica é frágil.
  - **Risco:** Baixo (Prisma relations já validam ownership).
  - **Opções:**
    - [ ] Adicionar verificação explícita de ownership antes da query
    - [ ] Manter como está (Prisma já protege)
    - [ ] Outra: ___________________
  - **Localização:** `app/backend/src/controllers/trip.controller.ts:319`

- [ ] **#19 — Lógica duplicada entre `listTrips` e `listTripFeed`**
  - **Problema:** Ambas têm pagination, filtering e query logic quase idênticos.
  - **Risco:** Manutenção (bug fix num lado, esquecido no outro).
  - **Opções:**
    - [ ] Extrair query logic para helper function partilhada
    - [ ] Manter como está (diferenças suficientes para justificar duplicação)
    - [ ] Outra: ___________________
  - **Localização:** `app/backend/src/controllers/trip.controller.ts:32-112` vs `114-185`

- [ ] **#40 — Trip clustering: $transaction vs Promise.all**
  - **Problema:** `Promise.all(updates)` dispara updates concorrentes. Para muitos trips, pode overwhelmar connection pool.
  - **Risco:** Baixo (número de trips por user é tipicamente pequeno).
  - **Status:** ✅ **Corrigido** — Mudado para `prisma.$transaction(updates)` para atomicidade e melhor gestão de recursos.
  - **Localização:** `app/backend/src/services/trip-clustering.service.ts:68`

---

## 🔵 Cosmético / Infraestrutura

- [ ] **#43 — .gitignore é template Visual Studio (~400 linhas)**
  - **Problema:** Maioria das regras são irrelevantes para Node.js/Python.
  - **Risco:** Nenhum (funcional).
  - **Opções:**
    - [ ] Substituir por .gitignore focado em Node.js + Python
    - [ ] Manter como está
    - [ ] Outra: ___________________
  - **Localização:** `.gitignore` (root)

- [ ] **#47 — perfLogger pode logar dados sensíveis**
  - **Problema:** Performance logging middleware pode logar URLs com tokens ou request bodies.
  - **Risco:** Baixo.
  - **Opções:**
    - [ ] Auditar e adicionar redaction de campos sensíveis
    - [ ] Manter como está
    - [ ] Outra: ___________________
  - **Localização:** `app/backend/src/middleware/perf-logger.middleware.ts`

- [ ] **#48 — Error messages em idiomas inconsistentes**
  - **Problema:** Mensagens em Português e Inglês misturados.
  - **Status:** ✅ **Corrigido** — Padronizado para Português em `gpx.routes.ts`.
  - **Localização:** `app/backend/src/routes/gpx.routes.ts`

- [ ] **#49 — Python dependencies não pinned**
  - **Problema:** `requirements.txt` não pina versões exatas, risco de supply chain.
  - **Risco:** Baixo-Médio.
  - **Opções:**
    - [ ] Pinar versões e gerar `requirements.lock`
    - [ ] Adicionar `pip-audit` ou `safety` ao CI
    - [ ] Manter como está
    - [ ] Outra: ___________________
  - **Localização:** `ml/requirements.txt`, `simulador/requirements.txt`

- [ ] **#50 — No API versioning**
  - **Problema:** Rotas sem prefixo de versão (ex: `/api/v1/`). Breaking changes afetam todos os clients.
  - **Risco:** Baixo (API ainda em desenvolvimento).
  - **Opções:**
    - [ ] Adicionar `/api/v1/` quando API estabilizar
    - [ ] Manter como está (v1 implícita)
    - [ ] Outra: ___________________
  - **Localização:** Todas as rotas (`app/backend/src/routes/`)

---

## ✅ Resolvidos nesta sessão

| # | Problema | Fix |
|---|----------|-----|
| #14 | GPX export sem time-range filter | Já usava `range(start, stop)` estrito — sem alteração necessária |
| #15/16 | ML Python sem input size limit | Adicionado `MAX_INPUT_BYTES` (10MB / 1MB) em ambos os services |
| #34 | Magic numbers em heuristics | Extraídos para ~50 constantes nomeadas com comentários |
| #40 | Promise.all → $transaction | Mudado para `prisma.$transaction` no clustering |
| #48 | Error messages inconsistentes | Padronizado para Português em `gpx.routes.ts` |
| #7 | GPX sem content validation | Adicionada validação básica de XML structure |

---

## 📋 Resumo

| Categoria | Total | ✅ Resolvidos | ⏳ Pendentes |
|-----------|-------|---------------|-------------|
| 🔴 Segurança | 1 | 0 | 1 |
| 🟡 Arquitetura | 2 | 0 | 2 |
| 🟠 Qualidade | 3 | 1 | 2 |
| 🔵 Cosmético | 5 | 1 | 4 |
| **Total** | **11** | **2** | **9** |
