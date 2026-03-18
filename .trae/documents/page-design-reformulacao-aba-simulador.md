# Page Design — Aba Simulador (Desktop-first)

## Global Styles (aplicável à aplicação)
- Background: `--bg` cinza-azulado muito claro; superfícies em cards com blur leve.
- Tipografia: system-ui; escala 12/14/16/20/24.
- Cores:
  - Primária (ação): azul (`--accent`), hover com +8% contraste.
  - Sucesso: verde; Aviso: amarelo; Erro: vermelho.
  - Texto secundário: `--muted`.
- Botões:
  - Primary: sólido; Disabled: 40% opacidade + cursor not-allowed.
  - Ghost: fundo transparente, hover com fundo suave.
- Feedback:
  - Toast (top-right) para sucesso/erro.
  - Banner inline (no topo da área de comandos) para erros de ligação.

---

## Página: Simulador (rota atual: /simulator-contexts)

### Meta Information
- Title: "Simulador — MotoGuard"
- Description: "Configura rota, inicia simulação e valida telemetria em tempo real."
- Open Graph: `og:title`, `og:description`, `og:type=website`.

### Layout
- Sistema: CSS Grid (desktop) + flex internos.
- Desktop (≥1200px): grid 12 colunas.
  - Coluna esquerda (8/12): Mapa & Rota.
  - Coluna direita (4/12): Estado + Comandos + Consola.
- Tablet (768–1199px): 1 coluna (Mapa, depois Comandos), mantendo cards.
- Mobile (<768px): 1 coluna; mapa com altura fixa (ex.: 320–420px), consola colapsável.

### Page Structure (stacked sections)
1) Header da página
2) Barra de estado (ligações + dispositivo)
3) Conteúdo principal (2 colunas)

### Sections & Components

#### 1) Header
**Componentes**
- `PageTitle` (ex.: "Simulador")
- `PageSubtitle` (ex.: "Rota, estado e comandos")

**Interação**
- Sem ações críticas no header; ações ficam no painel de comandos.

#### 2) Barra de Estado (Estado da simulação)
**Componentes**
- `StatusPills`: 
  - WS (ligado/desligado)
  - MQTT (ligado/desligado)
  - Dados (hasData + contador `msgCount`)
- `ActiveDeviceSelect` (aparece quando há múltiplos `devices`)
- `LastUpdate` (timestamp da última telemetria)

**Regras de estado**
- Fonte: `useSocket()`:
  - `status.ws`, `status.mqtt`, `status.hasData`, `msgCount`
  - `devices`, `activeDeviceId`, `setActiveDeviceId`
  - `telemetry.system.timestamp`

**Feedback de erro**
- Se `status.ws=false`: mostrar banner vermelho "Sem ligação ao servidor" + desativar botões de envio.
- Se `status.hasData=false` mas `ws=true`: banner amarelo "Ligado, mas sem telemetria".

#### 3) Card: Mapa & Rota (esquerda)
**Componentes (base Leaflet)**
- `RoutePlannerMap` (reaproveita lógica do `MapCard`):
  - Mapa com toggle: Streets/Satellite
  - Pilot Mode (seguir + rodar com yaw)
  - Marker de posição (se houver `location`) + trilho
- `RoutePointChips` (Início/Fim): arrastáveis para o mapa
- `RouteSelectionLine`: linha tracejada entre início e fim
- `RouteActions`:
  - "Limpar" (remove seleção + `localStorage.removeItem('sim_route')`)
  - "Padrão" (envia `{ acao: 'reset_rota' }`)
  - "Enviar Rota" (envia `{ acao: 'definir_rota', route }`)

**Interação (mapa/rota)**
- Clique no mapa:
  - 1º clique define Início; 2º clique define Fim; cliques seguintes atualizam Fim.
- Drag-and-drop:
  - Arrastar chip "Início" ou "Fim" para o mapa define o ponto respetivo.
- Persistência:
  - Ao enviar rota, guardar em `localStorage` (chave `"sim_route"`) para permitir iniciar simulação com rota já definida.

**Validações e erros**
- Botão "Enviar Rota" desativado se `routeStart` ou `routeEnd` estiverem vazios.
- Erro de conversão/parse do `sim_route` (JSON inválido):
  - Mostrar toast "Rota guardada inválida; redefina" e limpar storage.

#### 4) Painel direito: Comandos + Consola (direita)

##### 4.1 Card: Comandos do Simulador
**Componentes** (reaproveita `CommandPanel`)
- `ModelSelect` (lista de modelos)
- CTA primário:
  - "Iniciar Simulação" → `{ acao: 'definir_modelo', modelo }`
- Ações de simulação:
  - "Parar Simulação" → `{ acao: 'parar' }`
- Eventos:
  - "Queda" → `{ acao: 'evento', tipo: 'queda' }`
  - "Alternador" → `{ acao: 'evento', tipo: 'alternador' }`
  - "Calor" → `{ acao: 'evento', tipo: 'sobreaquecimento' }`
  - "Reset" → `{ acao: 'reset_eventos' }`

**Regras de estado (comandos)**
- `running = status.ws && !!telemetry`.
- Quando `running=true`:
  - desativar seleção de modelo e botão de iniciar;
  - manter eventos e parar ativos.
- Quando `running=false`:
  - eventos desativados;
  - iniciar disponível.

**Orquestração modelo → rota (quando existe rota guardada)**
- Se existir `sim_route` válida no storage:
  - ao iniciar, enviar `definir_modelo` e (depois de curto delay) `definir_rota`.

##### 4.2 Card: Consola (logs + erro)
**Componentes**
- `LogStream` (lista invertida, 100 entradas)
- `LogEntry` com timestamp e cor

**Fontes de logs**
- `useSocket.addLog()` para:
  - comandos enviados
  - status (WS/MQTT)
  - alertas
  - `error_msg` do backend

**Feedback de erro (prioridade UX)**
- `error_msg` recebido:
  - Toast vermelho com mensagem resumida (ex.: "Erro ao enviar comando")
  - Entrada no log com detalhe
- Erros de validação local (ex.: iniciar sem modelo; rota incompleta):
  - Toast amarelo (warning) + foco visual no campo em falta.

### Acessibilidade e Estados
- Foco visível em botões/inputs.
- Tooltips nos botões desativados (ex.: "Liga o WebSocket para enviar comandos").
- Texto alternativo/labels para selects e botões com ícones.

### Animações/Transições
- Transição suave (150–250ms) em hover/active.
- Rotação do mapa em Pilot Mode com `transition: transform 0.5s ease-out` (sem animação de pan para evitar lag).