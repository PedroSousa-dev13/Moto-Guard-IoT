# Page Design — P0 (Dashboard, Analytics, Alertas, Settings)

## Global (todas as páginas)
- Abordagem: desktop-first.
- Layout: Grid (12 col) para conteúdo + Flexbox para alinhamentos internos.
- Breakpoints: desktop (>=1024), tablet (>=768), mobile (<768) com empilhamento de colunas.
- Meta (base):
  - title: “Moto-Guard” + nome da página
  - description: resumo curto do propósito da página
  - Open Graph: título/descrição iguais; imagem opcional do produto
- Design tokens (sugestão):
  - Background: #0B1220 (dark) / #FFFFFF (light)
  - Surface/card: #111B2E / #F6F7FB
  - Text: #E6EAF2 / #101828
  - Accent: #2F80ED
  - Success/Warning/Danger: #27AE60 / #F2C94C / #EB5757
  - Tipografia: escala 12/14/16/20/24/32; headings semibold
  - Botões: primary (accent), secondary (surface), disabled (opacity 0.5)
  - Hover/focus: outline 2px accent + transição 150ms
- Componentes globais:
  - Top bar: logo, navegação (Dashboard/Analytics/Alertas/Settings), indicador de estado (online/offline se existir), área de utilizador (opcional).
  - Content container: max-width 1200–1440px, padding 24px desktop.
  - Estados: loading skeleton; empty state com mensagem; error state com retry.

## 1) Dashboard
- Meta:
  - title: “Dashboard | Moto-Guard”
  - description: “Resumo do estado atual e KPIs principais.”
- Page structure (stacked sections):
  1. Header da página: título + (opcional) seletor temporal rápido (se partilhado com Analytics)
  2. KPI card grid: 3–4 cards por linha (desktop), 2 (tablet), 1 (mobile)
  3. Secção “Estado atual”: card largo com lista curta de sinais/estados (ex.: últimos eventos, estado do dispositivo)
  4. Secção “Atalhos”: cards/CTAs para Analytics e Alertas
- Alinhamento (requisito):
  - Todos os cards com mesma altura mínima, padding, radius e header.
  - Tipos de títulos/valores consistentes (ex.: H2 para seção, H3 para card title).

## 2) Analytics
- Meta:
  - title: “Analytics | Moto-Guard”
  - description: “Tendências e métricas com filtros por tempo.”
- Layout:
  - Toolbar no topo: date range (presets + custom), granularidade (se existir), botão “Atualizar”.
  - Grid de gráficos: 2 colunas (desktop), 1 coluna (mobile).
  - Cada gráfico em card: header (título + legenda/ações), body (chart), footer (notas/última atualização).

## 3) Alertas
- Meta:
  - title: “Alertas | Moto-Guard”
  - description: “Lista e detalhe de alertas do sistema.”
- Layout (master-detail desktop):
  - Coluna esquerda (lista): search + filtros (status/severidade) + lista paginada/scroll.
  - Coluna direita (detalhe): card com conteúdo do alerta selecionado + ações (marcar como lido/reconhecido).
  - Mobile: lista -> detalhe em navegação separada (push).
- Estados:
  - Sem seleção: placeholder no painel de detalhe (“Seleciona um alerta”).

## 4) Settings
- Meta:
  - title: “Settings | Moto-Guard”
  - description: “Preferências e configurações.”
- Layout:
  - Form em cards por categoria (ex.: Aparência, Unidades, Preferências de alertas).
  - Controlo de formulário: labels acima, help text abaixo, validação inline.
  - Footer fixo (desktop): botões “Guardar” (primary) e “Repor” (secondary), com feedback de sucesso/erro.
- Interações:
  - Ao carregar: preencher valores atuais.
  - Ao guardar: bloquear botão, mostrar loading, e confirmar resultado.