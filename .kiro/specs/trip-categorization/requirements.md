# Documento de Requisitos

## Introdução

Esta feature adiciona classificação automática de viagens na aplicação MotoGuard. Cada viagem concluída é classificada numa de quatro categorias — **Commute**, **Weekend Ride**, **Track Day** ou **Off-road** — com base em métricas já disponíveis no modelo `Trip` (distância, velocidades, inclinação, G-force) e nos eventos registados. A categoria é calculada no backend pelo `trip-evaluation.service.ts` e apresentada como badge visual na lista de viagens (`Trips.tsx`) e no detalhe da viagem (`TripDetail.tsx`).

Não existe atualmente qualquer categorização: o sistema apenas produz um score numérico (0–100) baseado em penalidades. Esta feature é complementar ao scoring existente e não o substitui.

---

## Glossário

- **Categorizador**: módulo de lógica responsável por determinar a categoria de uma viagem a partir das suas métricas e eventos.
- **Categoria**: uma das quatro classificações possíveis de uma viagem — `COMMUTE`, `WEEKEND_RIDE`, `TRACK_DAY`, `OFF_ROAD`.
- **Trip**: registo de uma viagem no modelo Prisma, com campos `distanceKm`, `maxSpeedKmh`, `avgSpeedKmh`, `maxRollDeg`, `maxGForce`, `status`, `source` e relação com `TripEvent[]`.
- **MotorcycleProfile**: perfil da classe de mota associada à viagem, com campos `maxSpeedKmh`, `typicalMaxRollDeg`, `crashRollThreshold`, `crashGForce`.
- **TripEvent**: evento de risco registado durante a viagem, com `severity` (`INFO`, `WARNING`, `CRITICAL`) e `type` (ex: `SPEEDING`, `EXCESSIVE_LEAN`, `HIGH_VIBRATION`).
- **Badge**: elemento visual na interface que apresenta a categoria da viagem com cor e rótulo.
- **Score de confiança**: valor entre 0 e 1 que indica o grau de certeza da classificação atribuída.
- **TripFeedItem**: estrutura de dados devolvida pela API de listagem de viagens, consumida pelo frontend.

---

## Requisitos

### Requisito 1: Classificação automática de viagens concluídas

**User Story:** Como utilizador, quero que cada viagem concluída seja automaticamente classificada numa categoria, para que eu possa perceber rapidamente o tipo de condução que realizei.

#### Critérios de Aceitação

1. WHEN uma viagem transita para o estado `COMPLETED`, THE Categorizador SHALL atribuir exatamente uma das quatro categorias: `COMMUTE`, `WEEKEND_RIDE`, `TRACK_DAY` ou `OFF_ROAD`.
2. THE Categorizador SHALL calcular a categoria com base nos campos `distanceKm`, `avgSpeedKmh`, `maxSpeedKmh`, `maxRollDeg`, `maxGForce` e na contagem de `TripEvent` por tipo e severidade.
3. WHERE o `MotorcycleProfile` da mota estiver disponível, THE Categorizador SHALL normalizar `maxSpeedKmh` e `maxRollDeg` em relação aos valores `maxSpeedKmh` e `typicalMaxRollDeg` do perfil antes de aplicar os limiares de classificação.
4. IF o `MotorcycleProfile` não estiver disponível, THEN THE Categorizador SHALL aplicar limiares absolutos pré-definidos sem normalização por perfil.
5. THE Categorizador SHALL produzir um score de confiança entre 0.0 e 1.0 juntamente com a categoria atribuída.

---

### Requisito 2: Limiares de classificação por categoria

**User Story:** Como utilizador, quero que a classificação reflita fielmente o tipo de viagem, para que as categorias sejam coerentes com a minha experiência real de condução.

#### Critérios de Aceitação

1. THE Categorizador SHALL classificar uma viagem como `COMMUTE` quando `distanceKm` for inferior a 30 km E `avgSpeedKmh` for inferior a 50 km/h E o número de eventos `SPEEDING` for zero.
2. THE Categorizador SHALL classificar uma viagem como `WEEKEND_RIDE` quando `distanceKm` for igual ou superior a 30 km E `avgSpeedKmh` estiver entre 50 km/h e 100 km/h E `maxRollDeg` for inferior a 40°.
3. THE Categorizador SHALL classificar uma viagem como `TRACK_DAY` quando `maxSpeedKmh` for superior a 120 km/h E `maxRollDeg` for superior a 40° E o número de eventos `SPEEDING` ou `EXCESSIVE_LEAN` for superior a 2.
4. THE Categorizador SHALL classificar uma viagem como `OFF_ROAD` quando `avgSpeedKmh` for inferior a 40 km/h E `maxRollDeg` for superior a 30° E o número de eventos `HIGH_VIBRATION` for superior a 0.
5. WHEN uma viagem satisfizer os critérios de mais do que uma categoria, THE Categorizador SHALL aplicar a seguinte ordem de prioridade: `TRACK_DAY` > `OFF_ROAD` > `WEEKEND_RIDE` > `COMMUTE`.
6. IF nenhum critério for satisfeito, THEN THE Categorizador SHALL atribuir a categoria `COMMUTE` como valor por omissão e registar um score de confiança inferior a 0.5.

---

### Requisito 3: Persistência da categoria no modelo de dados

**User Story:** Como programador, quero que a categoria seja persistida na base de dados, para que não seja necessário recalculá-la a cada pedido.

#### Critérios de Aceitação

1. THE Sistema SHALL adicionar o campo `category` do tipo `TripCategory` (enum) ao modelo Prisma `Trip`, com valor por omissão nulo.
2. THE Sistema SHALL adicionar o campo `categoryConfidence` do tipo `Float` ao modelo Prisma `Trip`, com valor por omissão nulo.
3. WHEN a categoria for calculada, THE Sistema SHALL persistir `category` e `categoryConfidence` na linha correspondente da tabela `trips`.
4. THE Sistema SHALL criar e aplicar uma migração Prisma para adicionar os novos campos sem perda de dados nas viagens existentes.
5. WHEN uma viagem existente não tiver categoria atribuída, THE Sistema SHALL manter os campos `category` e `categoryConfidence` como nulos até que uma reclassificação seja solicitada.

---

### Requisito 4: Exposição da categoria na API

**User Story:** Como programador frontend, quero que a API devolva a categoria da viagem, para que o frontend possa apresentá-la sem lógica adicional.

#### Critérios de Aceitação

1. THE API SHALL incluir os campos `category` e `categoryConfidence` na resposta do endpoint de listagem de viagens (`TripFeedItem`).
2. THE API SHALL incluir os campos `category` e `categoryConfidence` na resposta do endpoint de detalhe de viagem.
3. WHEN `category` for nulo, THE API SHALL devolver o valor `null` nos campos correspondentes sem erro.
4. THE API SHALL expor um endpoint `POST /trips/:id/categorize` que recalcula e persiste a categoria de uma viagem específica.
5. IF o `tripId` fornecido ao endpoint de recategorização não existir ou não pertencer ao utilizador autenticado, THEN THE API SHALL devolver o código HTTP 404.

---

### Requisito 5: Apresentação do badge de categoria no frontend

**User Story:** Como utilizador, quero ver um badge visual com a categoria em cada viagem, para que identifique rapidamente o tipo de cada viagem na lista e no detalhe.

#### Critérios de Aceitação

1. THE Interface SHALL apresentar um badge com o rótulo da categoria em cada linha da lista de viagens (`Trips.tsx`) para viagens com `category` não nulo.
2. THE Interface SHALL apresentar o badge de categoria na página de detalhe da viagem (`TripDetail.tsx`), junto às métricas principais.
3. THE Interface SHALL usar cores distintas por categoria: `COMMUTE` — azul, `WEEKEND_RIDE` — verde, `TRACK_DAY` — laranja, `OFF_ROAD` — castanho/terra.
4. WHEN `category` for nulo, THE Interface SHALL omitir o badge sem apresentar erro ou espaço em branco.
5. THE Interface SHALL apresentar o rótulo da categoria em português: `COMMUTE` → "Urbana", `WEEKEND_RIDE` → "Passeio", `TRACK_DAY` → "Pista", `OFF_ROAD` → "Todo-o-Terreno".
6. WHERE o score de confiança (`categoryConfidence`) for inferior a 0.5, THE Interface SHALL apresentar o badge com indicação visual de baixa confiança (ex: opacidade reduzida ou ícone de interrogação).

---

### Requisito 6: Reclassificação de viagens existentes

**User Story:** Como utilizador, quero poder reclassificar viagens já registadas, para que viagens anteriores à feature também tenham categoria atribuída.

#### Critérios de Aceitação

1. THE Sistema SHALL fornecer uma função de reclassificação em lote que processa todas as viagens com `status = COMPLETED` e `category = null`.
2. WHEN a reclassificação em lote for executada, THE Categorizador SHALL aplicar os mesmos limiares e lógica de prioridade definidos no Requisito 2.
3. THE Sistema SHALL registar o número de viagens processadas e o número de erros ocorridos durante a reclassificação em lote.
4. IF uma viagem não tiver dados suficientes para classificação (ex: `distanceKm` nulo e `avgSpeedKmh` nulo), THEN THE Categorizador SHALL ignorar essa viagem e registar um aviso no log.

---

### Requisito 7: Tipagem TypeScript partilhada

**User Story:** Como programador, quero que os tipos TypeScript do frontend reflitam a categoria, para que o compilador valide o uso correto dos novos campos.

#### Critérios de Aceitação

1. THE Sistema SHALL definir o tipo `TripCategory` como union type `"COMMUTE" | "WEEKEND_RIDE" | "TRACK_DAY" | "OFF_ROAD"` em `app/frontend/src/types/index.ts`.
2. THE Interface `Trip` em `app/frontend/src/types/index.ts` SHALL incluir os campos opcionais `category?: TripCategory | null` e `categoryConfidence?: number | null`.
3. THE Interface `TripFeedItem` em `app/frontend/src/types/index.ts` SHALL incluir os campos opcionais `category?: TripCategory | null` e `categoryConfidence?: number | null`.
4. WHEN o campo `category` for utilizado em componentes React, THE Sistema SHALL garantir que o compilador TypeScript valida o valor contra o tipo `TripCategory`.
