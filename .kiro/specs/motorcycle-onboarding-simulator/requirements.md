# Requirements Document

## Introduction

Esta feature introduz um fluxo de onboarding obrigatório pós-registo no MotoGuard IoT, onde o utilizador é forçado a registar pelo menos uma mota na Garagem antes de aceder a qualquer outra página da aplicação. A criação de mota passa a ser guiada por seleção de categoria (8 categorias fixas), com mapeamento automático para um Device ID simulado. O simulador adapta-se ao utilizador autenticado, apresentando um dropdown das suas motas e usando o Device ID correspondente à categoria. O admin (admin@admin.com) mantém acesso livre ao simulador sem restrições de onboarding.

---

## Glossary

- **Onboarding_Guard**: Componente de proteção de rotas que verifica se o utilizador tem pelo menos uma mota registada antes de permitir acesso a páginas protegidas.
- **Garage**: Página de gestão de motas do utilizador (`/garage`).
- **Category**: Uma das 8 classificações fixas de mota disponíveis no sistema (Scooter, Naked, Desportiva, Trail / Adventure, Custom / Cruiser, Motocross / Enduro, Touring, Supermotard).
- **Category_Device_Map**: Mapeamento estático e imutável entre cada Category e um Device ID simulado fixo.
- **Device_ID**: Identificador único do dispositivo IoT simulado associado a uma mota, derivado automaticamente da Category.
- **Simulator**: Página do simulador de telemetria (`/simulator-contexts`), que envia comandos MQTT e recebe dados em tempo real.
- **CommandPanel**: Componente dentro do Simulator que controla o modelo de simulação e envia comandos.
- **Admin**: Utilizador com email `admin@admin.com`, que tem acesso irrestrito ao Simulator e não está sujeito ao onboarding obrigatório.
- **Regular_User**: Qualquer utilizador autenticado que não seja Admin.
- **ProtectedRoute**: Componente React que redireciona para `/login` se o utilizador não estiver autenticado.
- **Motorcycle**: Entidade persistida no backend com campos `name`, `brand`, `year`, `plate`, `deviceId`, `category`, associada a um utilizador.

---

## Requirements

### Requirement 1: Onboarding Obrigatório Pós-Registo

**User Story:** Como utilizador recém-registado, quero ser guiado para a Garagem imediatamente após criar conta, para que possa registar a minha mota antes de usar a aplicação.

#### Acceptance Criteria

1. WHEN a Regular_User completa o registo com sucesso, THE App SHALL redirecionar o Regular_User para `/garage` em vez de `/dashboard`.
2. WHILE a Regular_User não tem nenhuma Motorcycle registada, THE Onboarding_Guard SHALL redirecionar qualquer tentativa de navegação para uma rota protegida (exceto `/garage`) para `/garage`.
3. WHEN a Regular_User regista a primeira Motorcycle com sucesso na Garage, THE Onboarding_Guard SHALL permitir navegação livre para todas as rotas protegidas.
4. THE Onboarding_Guard SHALL verificar o número de motas do utilizador através da API `GET /api/motorcycles` antes de permitir acesso a rotas protegidas.
5. IF a chamada à API `GET /api/motorcycles` falhar durante a verificação do Onboarding_Guard, THEN THE Onboarding_Guard SHALL bloquear o acesso e apresentar uma mensagem de erro com opção de tentar novamente.
6. THE Admin SHALL ser excluído da verificação do Onboarding_Guard e ter acesso imediato a todas as rotas após autenticação.

---

### Requirement 2: Seleção de Categoria na Garagem

**User Story:** Como utilizador, quero escolher a categoria da minha mota ao adicioná-la à Garagem, para que o Device ID simulado correto seja associado automaticamente.

#### Acceptance Criteria

1. WHEN o utilizador abre o formulário de adição de mota na Garage, THE Garage SHALL apresentar um campo de seleção com as 8 categorias disponíveis: Scooter, Naked, Desportiva, Trail / Adventure, Custom / Cruiser, Motocross / Enduro, Touring, Supermotard.
2. WHEN o utilizador seleciona uma Category e submete o formulário, THE Garage SHALL associar automaticamente o Device_ID correspondente segundo o Category_Device_Map, sem que o utilizador introduza o Device_ID manualmente.
3. THE Garage SHALL ocultar o campo de introdução manual de Device_ID do formulário de criação de mota para Regular_User.
4. THE Category_Device_Map SHALL seguir o mapeamento fixo:
   - Scooter → `MOTOGUARD-SIM-SCOOTER`
   - Naked → `MOTOGUARD-SIM-NAKED`
   - Desportiva → `MOTOGUARD-SIM-SPORT`
   - Trail / Adventure → `MOTOGUARD-SIM-TRAIL`
   - Custom / Cruiser → `MOTOGUARD-SIM-CUSTOM`
   - Motocross / Enduro → `MOTOGUARD-SIM-MOTO`
   - Touring → `MOTOGUARD-SIM-TOURING`
   - Supermotard → `MOTOGUARD-SIM-SUPERMOTO`
5. IF o utilizador submeter o formulário sem selecionar uma Category, THEN THE Garage SHALL apresentar uma mensagem de validação e impedir a submissão.
6. WHEN o utilizador edita uma Motorcycle existente, THE Garage SHALL permitir alterar a Category, atualizando o Device_ID automaticamente de acordo com o Category_Device_Map.
7. THE Garage SHALL remover o badge Online/Offline dos cartões de mota.

---

### Requirement 3: Simulador com Dropdown de Motas do Utilizador

**User Story:** Como Regular_User, quero selecionar a minha mota no simulador através de um dropdown, para que a simulação use automaticamente o Device ID e o modelo corretos para a mota escolhida.

#### Acceptance Criteria

1. WHEN um Regular_User acede ao Simulator, THE Simulator SHALL apresentar um dropdown com a lista de Motorcycles registadas pelo Regular_User na Garage.
2. WHEN o Regular_User seleciona uma Motorcycle no dropdown, THE CommandPanel SHALL pré-selecionar o modelo de simulação correspondente à Category da Motorcycle selecionada, usando o Category_Device_Map.
3. WHEN o Regular_User inicia uma simulação, THE Simulator SHALL enviar o comando `definir_modelo` com o modelo derivado da Category da Motorcycle selecionada.
4. THE Simulator SHALL permitir ao Regular_User alternar entre as suas Motorcycles no dropdown a qualquer momento em que a simulação não esteja a correr.
5. IF o Regular_User não tiver nenhuma Motorcycle registada ao aceder ao Simulator, THEN THE Onboarding_Guard SHALL redirecionar o Regular_User para `/garage` antes de apresentar o Simulator (coberto pelo Requirement 1).
6. WHILE uma simulação está a correr, THE Simulator SHALL desativar o dropdown de seleção de Motorcycle para impedir alteração durante a simulação.
7. THE CommandPanel SHALL ocultar o seletor de modelo livre (dropdown de MODELOS) para Regular_User, substituindo-o pelo dropdown de Motorcycles do utilizador.

---

### Requirement 4: Modo Admin no Simulador

**User Story:** Como Admin, quero aceder ao simulador em modo livre sem restrições de onboarding ou de seleção de mota, para que possa testar qualquer modelo de simulação independentemente.

#### Acceptance Criteria

1. WHEN o Admin acede ao Simulator, THE Simulator SHALL apresentar o seletor de modelo livre com todas as 8 categorias disponíveis, tal como o comportamento atual do CommandPanel.
2. THE Simulator SHALL identificar o Admin pelo email `admin@admin.com` do utilizador autenticado.
3. THE Admin SHALL ter acesso a todas as rotas protegidas sem passar pela verificação do Onboarding_Guard.
4. WHEN o Admin acede ao Simulator, THE Simulator SHALL não apresentar o dropdown de seleção de Motorcycle do utilizador.
