# Requirements Document

## Introduction

A funcionalidade de comparação de viagens permite ao utilizador selecionar duas viagens na página Trips e visualizá-las lado a lado. A comparação inclui gráficos de velocidade sobrepostos, scores heurístico e ML, contagem de eventos por tipo e severidade, e métricas resumo (distância, duração, velocidade média e máxima). A interface é implementada como uma sub-página ou modal dentro da página Trips, sem necessidade de navegação para uma rota separada.

## Glossary

- **Comparison_View**: O componente de interface (modal ou sub-página) que apresenta a comparação lado a lado de duas viagens.
- **Trip_Selector**: O mecanismo de seleção de viagens na página Trips que permite ao utilizador marcar até duas viagens para comparação.
- **Speed_Chart**: O gráfico de linha que representa a velocidade ao longo do tempo de uma viagem.
- **Overlay_Chart**: O gráfico que sobrepõe as séries de velocidade de duas viagens num único eixo temporal normalizado.
- **Heuristic_Score**: A pontuação calculada pelo modelo heurístico (`heuristic-v1`) para uma viagem, de 0 a 100.
- **ML_Score**: A pontuação calculada pelo modelo de machine learning para uma viagem, de 0 a 100.
- **Event_Summary**: A contagem de eventos agrupada por tipo e por severidade (INFO, WARNING, CRITICAL) para uma viagem.
- **Trip_Stats**: O conjunto de métricas resumo de uma viagem: distância (km), duração, velocidade média (km/h) e velocidade máxima (km/h).
- **Telemetry_API**: O endpoint de backend que fornece os pontos de telemetria de uma viagem (`TripTelemetryResponse`).
- **Evaluation_API**: O endpoint de backend que fornece a avaliação heurística e ML de uma viagem (`TripEvaluationResponse`).

## Requirements

### Requirement 1: Seleção de Viagens para Comparação

**User Story:** Como utilizador, quero selecionar duas viagens na página Trips, para poder iniciá-las em modo de comparação.

#### Acceptance Criteria

1. WHEN o utilizador está na vista Lista da página Trips, THE Trip_Selector SHALL apresentar uma checkbox ou botão de seleção em cada cartão de viagem.
2. WHEN o utilizador seleciona uma viagem, THE Trip_Selector SHALL destacar visualmente o cartão selecionado e mostrar um contador de seleções ativas (ex: "1 de 2 selecionadas").
3. WHEN o utilizador tenta selecionar uma terceira viagem, THE Trip_Selector SHALL ignorar a seleção e apresentar uma mensagem informativa indicando que o máximo é 2 viagens.
4. WHEN exatamente 2 viagens estão selecionadas, THE Trip_Selector SHALL ativar um botão "Comparar Viagens" na interface.
5. WHEN o utilizador clica em "Comparar Viagens" com 2 viagens selecionadas, THE Comparison_View SHALL ser aberto com as duas viagens carregadas.
6. WHEN o utilizador desseleciona uma viagem já selecionada, THE Trip_Selector SHALL remover o destaque e atualizar o contador.
7. THE Trip_Selector SHALL estar disponível apenas na vista Lista (não na vista Feed).

---

### Requirement 2: Abertura e Fecho da Comparison View

**User Story:** Como utilizador, quero abrir e fechar a vista de comparação de forma fluida, para não perder o contexto da lista de viagens.

#### Acceptance Criteria

1. WHEN a Comparison_View é aberta, THE Comparison_View SHALL apresentar-se como um modal de ecrã completo ou sub-página sobreposta à página Trips, sem navegação para uma rota diferente.
2. WHEN o utilizador clica no botão de fechar da Comparison_View, THE Comparison_View SHALL fechar e a página Trips SHALL restaurar o estado anterior (filtros, seleções, página de paginação).
3. WHEN a Comparison_View está aberta, THE Comparison_View SHALL mostrar os identificadores das duas viagens selecionadas (nome da mota, data de início) no cabeçalho.
4. IF a Comparison_View é aberta e uma das viagens não existe ou não pertence ao utilizador, THEN THE Comparison_View SHALL apresentar uma mensagem de erro e um botão para fechar.

---

### Requirement 3: Carregamento de Dados de Comparação

**User Story:** Como utilizador, quero que os dados das duas viagens sejam carregados automaticamente ao abrir a comparação, para não ter de fazer ações adicionais.

#### Acceptance Criteria

1. WHEN a Comparison_View é aberta, THE Comparison_View SHALL iniciar em paralelo o carregamento dos dados de telemetria (Telemetry_API) e de avaliação (Evaluation_API) para ambas as viagens.
2. WHILE os dados estão a ser carregados, THE Comparison_View SHALL apresentar um indicador de carregamento em cada secção pendente.
3. IF o carregamento de telemetria de uma viagem falhar, THEN THE Comparison_View SHALL apresentar uma mensagem de erro na secção do gráfico correspondente e permitir nova tentativa.
4. IF o carregamento de avaliação de uma viagem falhar, THEN THE Comparison_View SHALL apresentar uma mensagem de erro na secção de scores correspondente e permitir nova tentativa.
5. THE Comparison_View SHALL carregar no máximo 500 pontos de telemetria por viagem para garantir performance de renderização.

---

### Requirement 4: Gráfico de Velocidade Sobreposto

**User Story:** Como utilizador, quero ver os perfis de velocidade das duas viagens sobrepostos num único gráfico, para comparar visualmente o comportamento de condução.

#### Acceptance Criteria

1. WHEN os dados de telemetria de ambas as viagens estão disponíveis, THE Overlay_Chart SHALL renderizar as duas séries de velocidade (km/h) num único gráfico de linhas.
2. THE Overlay_Chart SHALL usar um eixo X temporal normalizado, onde 0% representa o início e 100% representa o fim de cada viagem, para permitir comparação independentemente da duração.
3. THE Overlay_Chart SHALL distinguir as duas séries com cores diferentes e uma legenda identificando cada viagem.
4. THE Overlay_Chart SHALL apresentar tooltips ao passar o rato sobre o gráfico, mostrando o valor de velocidade de cada série no ponto correspondente.
5. WHERE apenas uma viagem tem dados de telemetria disponíveis, THE Overlay_Chart SHALL renderizar apenas a série disponível com uma nota indicando a ausência da outra.
6. THE Overlay_Chart SHALL apresentar linhas de referência horizontais para a velocidade média de cada viagem.

---

### Requirement 5: Comparação de Scores

**User Story:** Como utilizador, quero ver os scores heurístico e ML das duas viagens lado a lado, para perceber qual a viagem com melhor avaliação.

#### Acceptance Criteria

1. WHEN os dados de avaliação de ambas as viagens estão disponíveis, THE Comparison_View SHALL apresentar o Heuristic_Score e o ML_Score de cada viagem em colunas paralelas.
2. THE Comparison_View SHALL destacar visualmente a viagem com score mais alto em cada categoria (heurístico e ML).
3. THE Comparison_View SHALL apresentar a diferença absoluta entre os scores das duas viagens (ex: "+12 pontos").
4. WHERE o ML_Score de uma viagem é nulo, THE Comparison_View SHALL apresentar "N/D" na célula correspondente sem quebrar o layout.
5. THE Comparison_View SHALL usar a mesma codificação de cores dos scores já existente na aplicação (verde ≥ 80, amarelo ≥ 60, vermelho < 60).

---

### Requirement 6: Comparação de Eventos

**User Story:** Como utilizador, quero ver a contagem de eventos por tipo e severidade das duas viagens lado a lado, para identificar diferenças no comportamento de risco.

#### Acceptance Criteria

1. WHEN os dados de avaliação de ambas as viagens estão disponíveis, THE Comparison_View SHALL apresentar o Event_Summary de cada viagem em colunas paralelas.
2. THE Comparison_View SHALL mostrar a contagem de eventos agrupada por severidade (INFO, WARNING, CRITICAL) para cada viagem.
3. THE Comparison_View SHALL mostrar a contagem de eventos agrupada por tipo (ex: HARD_BRAKING, SPEEDING, OVERHEAT) para cada viagem.
4. THE Comparison_View SHALL destacar visualmente os tipos de evento onde uma viagem tem contagem superior à outra.
5. IF ambas as viagens têm zero eventos, THEN THE Comparison_View SHALL apresentar uma mensagem "Sem eventos registados" na secção de eventos.

---

### Requirement 7: Comparação de Métricas Resumo (Trip Stats)

**User Story:** Como utilizador, quero ver as métricas resumo das duas viagens lado a lado, para comparar rapidamente distância, duração e velocidades.

#### Acceptance Criteria

1. WHEN a Comparison_View é aberta com duas viagens, THE Comparison_View SHALL apresentar as Trip_Stats de cada viagem em colunas paralelas.
2. THE Comparison_View SHALL apresentar as seguintes métricas para cada viagem: distância (km), duração, velocidade média (km/h) e velocidade máxima (km/h).
3. THE Comparison_View SHALL destacar visualmente a viagem com valor superior em cada métrica (exceto duração, onde não há valor "melhor").
4. IF uma métrica não está disponível para uma viagem, THEN THE Comparison_View SHALL apresentar "—" na célula correspondente.
5. THE Comparison_View SHALL apresentar a diferença absoluta entre os valores de cada métrica (ex: "+5.2 km", "+15 km/h").

---

### Requirement 8: Responsividade e Acessibilidade

**User Story:** Como utilizador, quero que a vista de comparação seja utilizável em diferentes tamanhos de ecrã, para poder consultar a comparação em qualquer dispositivo.

#### Acceptance Criteria

1. WHEN a Comparison_View é apresentada num ecrã com largura inferior a 768px, THE Comparison_View SHALL reorganizar o layout de colunas paralelas para um layout vertical empilhado.
2. THE Comparison_View SHALL garantir que todos os elementos interativos (botões, checkboxes, tooltips) são acessíveis por teclado.
3. THE Comparison_View SHALL garantir que as cores de destaque têm contraste suficiente para cumprir os requisitos de legibilidade (rácio mínimo de 4.5:1 para texto normal).
4. THE Overlay_Chart SHALL incluir uma alternativa textual (tabela de dados) acessível para utilizadores que não podem interpretar gráficos visuais.
