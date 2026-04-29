# Ultra‑wide Project Gap & Bug‑Risk Analysis

**Project:** Moto‑Guard‑IoT  
**Date:** 2026‑04‑29

---

## 1. Arquitetura geral
| Área | Possível lacuna / risco | Sintoma típico | Possível solução |
|------|------------------------|----------------|------------------|
| **Docker / Compose** | Imagens base desatualizadas ou vulneráveis | Falha ao iniciar containers, alertas de segurança | Atualizar `Dockerfile`/`docker‑compose.yml` para usar versões LTS e rodar `docker scan` periodicamente |
| **CI / Testes** | Cobertura de testes baixa (especialmente nos serviços críticos) | Bugs que só aparecem em produção | Adicionar testes unitários e de integração para `backend/src/services/*` e `frontend/*`; usar `vitest` e `pytest` conforme linguagem |
| **Banco de dados (Prisma)** | Migrações não aplicadas ou schema drift | Erros de `prisma` ao iniciar a API | Automatizar migrações com `prisma migrate deploy` no container de produção e validar schema com `prisma db pull` |
| **MQTT (Mosquitto)** | Falta de reconexão automática e tratamento de mensagens perdidas | Dados de sensores desaparecem | Implementar lógica de reconexão exponencial e QoS = 1/2 nos clientes; usar `retain` quando apropriado |
| **Modelos de ML** | Modelos treinados fora do container podem ser incompatíveis com a versão de `torch`/`tensorflow` | Exceções ao inferir GPX ou anomalias | Versionar modelos junto ao código (`models/`), usar `requirements.txt` fixo e validar com testes de inferência |
| **API REST / GraphQL** | Falta de validação de entrada e sanitização | Injeção de dados, crashes inesperados | Utilizar schemas (e.g. `zod` ou `pydantic`) para validar payloads antes de processar |
| **Autenticação / Autorização** | Tokens expirados não renovados, permissões mal definidas | Usuário perde sessão ou acessa recursos indevidos | Implementar refresh‑token flow e revisar policies no `backend/src/middleware/*` |
| **Logs & Monitoring** | Logs insuficientes ou sem correlação entre serviços | Dificuldade para reproduzir bugs | Centralizar logs (e.g. Loki/Elastic) e incluir `requestId` em todas as camadas |
| **Configurações** | Variáveis de ambiente não documentadas ou valores padrão inseguros | Comportamento inesperado em diferentes ambientes | Criar `.env.example` completo e validar com `dotenv‑safe` |
| **Frontend** | Falta de tratamento de erros de API | UI trava ou mostra mensagens genéricas | Mostrar feedback amigável e fallback UI; usar `try/catch` em chamadas `fetch` |
| **Tipos (TypeScript)** | Uso de `any` ou tipos implícitos | Erros em tempo de execução | Habilitar `noImplicitAny` e `strict` no `tsconfig.json`; refatorar para tipos explícitos |
| **Scripts de utilidade** | Scripts `check_trips.js`, `train_gpx.py` etc. não têm tratamento de exceções | Falha silenciosa ao processar dados | Envolver lógica principal em `try/except` (Python) ou `try/catch` (JS) e registrar erros |
| **Dependências** | Dependências desatualizadas ou vulneráveis | Falhas de segurança ou incompatibilidade | Rodar `npm audit` e `pip-audit` regularmente; fixar versões no `package.json`/`requirements.txt` |
| **Documentação** | README incompleto, falta de diagramas de fluxo | Novos desenvolvedores não entendem o fluxo | Manter `README.md` e criar diagramas de arquitetura (Mermaid) |
| **Teste de performance** | Não há testes de carga para a API ou para o broker MQTT | Saturação em produção | Utilizar `k6` ou `locust` para simular carga e ajustar limites de recursos |
| **Segurança de rede** | Portas expostas sem firewall | Ataques externos | Configurar regras de firewall no `docker‑compose.yml` e usar redes internas Docker |
| **Gerenciamento de estado** | Estado da simulação (ex.: `simulador/`) armazenado em memória volátil | Perda de estado ao reiniciar containers | Persistir estado em banco ou volume Docker |
| **Integração de GPX** | Falta de validação de arquivos GPX | Crash ao ler GPX mal‑formado | Usar biblioteca de validação GPX e capturar exceções ao parsear |
| **Teste de hardware** | Código que interage com sensores reais não tem mocks | Falha ao rodar testes CI | Criar camadas de abstração e mocks para sensores |

---

## 2. Checklist de ação rápida
1. **Atualizar Dockerfiles** – usar `node:20‑alpine` e `python:3.11‑slim` como base.
2. **Rodar auditorias** – `npm audit --audit-level=high` e `pip-audit`.
3. **Adicionar validação de entrada** – integrar `zod` nos endpoints Express.
4. **Cobertura de testes** – alcançar >80 % nas pastas `backend/src/services` e `ml/`.
5. **Centralizar logs** – instalar `winston` (Node) e `loguru` (Python) com saída JSON.
6. **Documentar variáveis** – criar `.env.example` e validar com `dotenv‑safe`.
7. **Implementar reconexão MQTT** – lógica exponencial + back‑off.
8. **Versionar modelos ML** – mover arquivos `.pt/.h5` para `models/` e registrar hash no `README`.
9. **Adicionar diagramas** – usar Mermaid para arquitetura de micro‑serviços.
10. **Revisar permissões** – garantir que rotas sensíveis usem middleware de autorização.

---

## 3. Próximos passos recomendados
- **Sprint 1:** Segurança e auditoria de dependências.
- **Sprint 2:** Testes de integração + cobertura de tipos.
- **Sprint 3:** Monitoramento e logging centralizado.
- **Sprint 4:** Refatoração de serviços críticos (device‑association, MQTT client).

---

*Este documento serve como ponto de partida para identificar lacunas e priorizar correções. Cada item deve ser revisado pelo time de desenvolvimento e alocado em tickets no backlog.*
