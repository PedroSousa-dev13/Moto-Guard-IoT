# Requirements Document

## Introduction

O Modo Demo é uma funcionalidade do frontend da aplicação MotoGuard IoT que permite explorar todas as páginas e funcionalidades da aplicação usando dados pré-gravados e simulados, sem necessitar de qualquer dependência externa ativa (backend, MQTT, InfluxDB, simulador Python, base de dados). O objetivo principal é suportar apresentações académicas e demonstrações offline, onde a aplicação funciona de forma autónoma e realista com dados fictícios mas coerentes.

O modo demo integra-se com o `OnboardingGuard` existente (que verifica se o utilizador tem motas registadas) e com o modal de demonstração já presente na `HomePage`. Quando ativo, o modo demo injeta dados simulados em todas as camadas da aplicação: viagens, telemetria ao vivo, alertas, motas e analytics.

## Glossary

- **Demo_Mode**: Estado global da aplicação em que todos os dados são servidos por dados pré-gravados locais, sem chamadas reais ao backend.
- **Demo_Data_Provider**: Módulo frontend responsável por fornecer os dados simulados pré-gravados (viagens, telemetria, motas, alertas).
- **Demo_Context**: Contexto React que expõe o estado do modo demo e funções para ativá-lo/desativá-lo a todos os componentes.
- **Demo_API_Interceptor**: Camada que interceta as chamadas à API (axios) e retorna dados simulados quando o Demo_Mode está ativo.
- **Demo_Socket_Emitter**: Módulo que emite eventos de telemetria simulados via um EventEmitter local, substituindo o Socket.IO real.
- **Demo_Banner**: Componente visual persistente que indica ao utilizador que está em modo demo.
- **OnboardingGuard**: Componente existente que verifica se o utilizador tem motas registadas antes de aceder às páginas protegidas.
- **HomePage**: Página inicial existente que contém o modal de demonstração com o botão "Ver Demonstração".
- **System**: A aplicação frontend MotoGuard IoT no seu conjunto.

## Requirements

### Requirement 1: Ativação do Modo Demo

**User Story:** Como utilizador (ou apresentador académico), quero ativar o modo demo a partir da página inicial, para explorar a aplicação sem precisar de criar conta ou ter infraestrutura ativa.

#### Acceptance Criteria

1. WHEN o utilizador clica em "Explorar em Modo Demo" na `HomePage`, THE `Demo_Context` SHALL ativar o `Demo_Mode` e redirecionar o utilizador para `/dashboard`.
2. WHEN o `Demo_Mode` é ativado, THE `System` SHALL persistir o estado de demo em `sessionStorage` com a chave `demo_mode`.
3. WHEN o utilizador fecha o browser ou a aba, THE `System` SHALL limpar automaticamente o estado de demo do `sessionStorage`.
4. WHEN o `Demo_Mode` está ativo, THE `OnboardingGuard` SHALL permitir acesso a todas as rotas protegidas sem verificar motas no backend.
5. THE `Demo_Context` SHALL expor um valor booleano `isDemoMode` e uma função `exitDemoMode` a todos os componentes da aplicação.

### Requirement 2: Dados Simulados Pré-gravados

**User Story:** Como apresentador, quero que a aplicação mostre dados realistas e coerentes em modo demo, para que a demonstração seja convincente e representativa das funcionalidades reais.

#### Acceptance Criteria

1. THE `Demo_Data_Provider` SHALL incluir pelo menos 2 motas simuladas com nome, marca, modelo, categoria e ano definidos.
2. THE `Demo_Data_Provider` SHALL incluir pelo menos 5 viagens simuladas com estados variados (`COMPLETED`, `ACTIVE`), fontes variadas (`SIMULATOR`, `GPX_IMPORTED`, `DEVICE_REAL`), distâncias, velocidades, scores de segurança e eventos de risco.
3. THE `Demo_Data_Provider` SHALL incluir pelo menos 50 pontos de telemetria por viagem, com valores realistas de velocidade, RPM, marcha, roll, pitch, g-force e coordenadas GPS.
4. THE `Demo_Data_Provider` SHALL incluir pelo menos 3 alertas simulados com severidades diferentes (`INFO`, `WARNING`, `CRITICAL`).
5. FOR ALL viagens simuladas, THE `Demo_Data_Provider` SHALL garantir que `startedAt < endedAt` e que `distanceKm > 0`.
6. THE `Demo_Data_Provider` SHALL incluir dados de analytics simulados compatíveis com a página de Analytics existente.

### Requirement 3: Intercetação de Chamadas à API

**User Story:** Como utilizador em modo demo, quero que todas as páginas carreguem dados sem erros, para que a experiência seja fluida e sem mensagens de erro de rede.

#### Acceptance Criteria

1. WHEN o `Demo_Mode` está ativo e é feita uma chamada a `GET /api/motorcycles`, THE `Demo_API_Interceptor` SHALL retornar as motas simuladas do `Demo_Data_Provider` sem contactar o servidor.
2. WHEN o `Demo_Mode` está ativo e é feita uma chamada a `GET /api/trips`, THE `Demo_API_Interceptor` SHALL retornar as viagens simuladas do `Demo_Data_Provider`.
3. WHEN o `Demo_Mode` está ativo e é feita uma chamada a `GET /api/trips/feed`, THE `Demo_API_Interceptor` SHALL retornar os itens de feed simulados do `Demo_Data_Provider`.
4. WHEN o `Demo_Mode` está ativo e é feita uma chamada a `GET /api/trips/:id`, THE `Demo_API_Interceptor` SHALL retornar a viagem simulada correspondente ao `id` fornecido.
5. WHEN o `Demo_Mode` está ativo e é feita uma chamada a `GET /api/telemetry/:tripId`, THE `Demo_API_Interceptor` SHALL retornar os pontos de telemetria simulados para a viagem correspondente.
6. WHEN o `Demo_Mode` está ativo e é feita uma chamada a qualquer endpoint `POST`, `PUT` ou `DELETE`, THE `Demo_API_Interceptor` SHALL retornar uma resposta de sucesso simulada sem efetuar alterações.
7. IF o `Demo_Mode` está ativo e é feita uma chamada a um endpoint não mapeado, THEN THE `Demo_API_Interceptor` SHALL retornar uma resposta vazia com status 200 para evitar erros na UI.

### Requirement 4: Telemetria ao Vivo Simulada

**User Story:** Como apresentador, quero que o Dashboard mostre telemetria ao vivo animada em modo demo, para demonstrar a funcionalidade de monitorização em tempo real.

#### Acceptance Criteria

1. WHEN o `Demo_Mode` está ativo, THE `Demo_Socket_Emitter` SHALL emitir eventos de telemetria simulados a cada 1500ms para o hook `useSocket`.
2. WHEN o `Demo_Mode` está ativo, THE `Demo_Socket_Emitter` SHALL variar os valores de velocidade, RPM, roll e g-force entre emissões para simular movimento realista.
3. WHEN o `Demo_Mode` está ativo, THE `Demo_Socket_Emitter` SHALL emitir um evento `trip_started` simulado após 3 segundos de ativação.
4. WHEN o `Demo_Mode` está ativo, THE `Demo_Socket_Emitter` SHALL emitir o estado de conexão como `mqtt: true` e `ws: true` para o Dashboard.
5. WHILE o `Demo_Mode` está ativo, THE `Demo_Socket_Emitter` SHALL continuar a emitir telemetria até o modo demo ser desativado.

### Requirement 5: Indicador Visual de Modo Demo

**User Story:** Como utilizador, quero saber claramente quando estou em modo demo, para não confundir dados simulados com dados reais.

#### Acceptance Criteria

1. WHILE o `Demo_Mode` está ativo, THE `Demo_Banner` SHALL ser exibido de forma persistente em todas as páginas protegidas.
2. THE `Demo_Banner` SHALL conter um texto identificativo (ex: "Modo Demo — dados simulados") e um botão para sair do modo demo.
3. WHEN o utilizador clica em "Sair do Modo Demo" no `Demo_Banner`, THE `Demo_Context` SHALL desativar o `Demo_Mode`, limpar o `sessionStorage` e redirecionar para a `HomePage`.
4. THE `Demo_Banner` SHALL ser visualmente distinto (ex: cor de fundo âmbar/laranja) para não ser confundido com outros elementos da UI.
5. WHILE o `Demo_Mode` está ativo, THE `System` SHALL desativar funcionalidades destrutivas ou de escrita (ex: criar conta, alterar password, enviar comandos ao simulador).

### Requirement 6: Saída do Modo Demo

**User Story:** Como utilizador, quero poder sair do modo demo de forma clara, para voltar ao estado normal da aplicação.

#### Acceptance Criteria

1. WHEN o utilizador clica em "Sair do Modo Demo", THE `Demo_Context` SHALL remover a chave `demo_mode` do `sessionStorage`.
2. WHEN o `Demo_Mode` é desativado, THE `System` SHALL redirecionar o utilizador para a `HomePage`.
3. WHEN o `Demo_Mode` é desativado, THE `Demo_Socket_Emitter` SHALL parar de emitir eventos de telemetria simulados.
4. WHEN o utilizador faz logout estando em modo demo, THE `Demo_Context` SHALL também desativar o `Demo_Mode` e limpar o estado de demo.
5. IF o utilizador navegar diretamente para `/dashboard` sem estar autenticado e sem `Demo_Mode` ativo, THEN THE `System` SHALL redirecionar para a `HomePage` como comportamento normal.

### Requirement 7: Compatibilidade com Rotas e Navegação

**User Story:** Como apresentador, quero navegar livremente entre todas as páginas em modo demo, para mostrar todas as funcionalidades da aplicação.

#### Acceptance Criteria

1. WHILE o `Demo_Mode` está ativo, THE `System` SHALL permitir navegação para `/dashboard`, `/trips`, `/trips/:id`, `/map`, `/analytics`, `/alertas`, `/settings`, `/profile` e `/garage`.
2. WHEN o `Demo_Mode` está ativo e o utilizador acede a `/trips/:id` com um id de viagem demo, THE `System` SHALL exibir os detalhes da viagem simulada correspondente.
3. WHILE o `Demo_Mode` está ativo, THE `OnboardingGuard` SHALL não efetuar chamadas ao backend para verificar motas.
4. WHEN o `Demo_Mode` está ativo, THE `System` SHALL usar um utilizador demo fictício (nome "Demo User", email "demo@motoguard.demo") para preencher o perfil e cabeçalho.

### Requirement 8: Round-Trip de Dados Demo

**User Story:** Como developer, quero garantir que os dados demo são estruturalmente consistentes com os tipos TypeScript existentes, para evitar erros de runtime durante a demonstração.

#### Acceptance Criteria

1. FOR ALL objetos de viagem simulados, THE `Demo_Data_Provider` SHALL produzir objetos que satisfazem a interface `Trip` definida em `types/index.ts`.
2. FOR ALL objetos de feed simulados, THE `Demo_Data_Provider` SHALL produzir objetos que satisfazem a interface `TripFeedItem` definida em `types/index.ts`.
3. FOR ALL objetos de mota simulados, THE `Demo_Data_Provider` SHALL produzir objetos que satisfazem a interface `Motorcycle` definida em `types/index.ts`.
4. FOR ALL pontos de telemetria simulados, THE `Demo_Data_Provider` SHALL produzir objetos que satisfazem a interface `TripTelemetryPoint` definida em `types/index.ts`.
5. WHEN os dados demo são serializados para JSON e desserializados, THE `Demo_Data_Provider` SHALL produzir objetos equivalentes aos originais (propriedade round-trip).
