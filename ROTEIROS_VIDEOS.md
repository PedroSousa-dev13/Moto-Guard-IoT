# 🏍️ MotoGuard IoT — Roteiros dos Vídeos Explicativos

Este documento contém os roteiros detalhados para a gravação dos 4 vídeos explicativos do **MotoGuard IoT**. Cada roteiro está estruturado com orientações visuais (o que gravar no ecrã), a locução (o que dizer) e dicas práticas de produção para garantir uma apresentação profissional, fluida e apelativa.

---

## 🎬 Vídeo 1: Introdução, Login e Layout Geral
* **Objetivo:** Fazer uma introdução à plataforma, demonstrar o fluxo de autenticação, o layout geral da aplicação (Navbar, Sidebar, Definições/Perfil) e introduzir a página "Como Funciona".
* **Duração estimada:** ~2:30 minutos.
* **Preparação da Gravação:**
  * Ter o site aberto na página inicial (`/` ou `/login`).
  * Certificar que a base de dados tem um utilizador de teste limpo para o registo, ou usar uma conta existente.
  * O microfone deve estar configurado para voz clara e sem ruído de fundo.

### 📋 Estrutura de Cenas (Vídeo 1)

| Cena | Tempo | Ação Visual (Ecrã) | Locução (Voz) | Dicas de Produção |
| :--- | :---: | :--- | :--- | :--- |
| **1. Introdução** | 00:00 - 00:20 | Mostra a Landing Page do **MotoGuard IoT** com um scroll suave pelas secções promocionais. Realça o logótipo e o slogan do projeto. | "Olá! Bem-vindo ao MotoGuard IoT, um sistema inteligente e distribuído de Internet das Coisas concebido para tornar a condução de motociclos mais segura. Neste primeiro vídeo, vamos apresentar a plataforma e guiar-te pelas funcionalidades iniciais de acesso e configuração." | Gravar com resolução 1080p. Usar transições suaves. |
| **2. Autenticação** | 00:20 - 00:50 | Clica no botão **Entrar / Login**. Mostra a página de login. Preenche os campos de ecrã (email e palavra-passe). Clica no link de registo para mostrar o formulário, realçando o campo **Contacto de Emergência**. Volta ao login e entra com sucesso. | "Para aceder ao sistema, o utilizador pode registar-se inserindo os seus dados, incluindo de forma inovadora um contacto de emergência para alertas automáticos de SOS. O sistema suporta ainda recuperação segura de password por email. Vamos fazer o login na nossa conta de teste." | Ocultar ou usar credenciais de teste fictícias (ex: `demo@motoguard.pt`). |
| **3. Layout Geral e Navbar** | 00:50 - 01:25 | Ecrã transita para o **Dashboard**. O rato move-se para a **Navbar superior**. Mostra a troca de idioma (PT/EN), a alternância de Tema (Escuro/Claro) e o **Centro de Notificações** clicando no respetivo ícone. | "Uma vez autenticados, somos recebidos pelo Dashboard principal. No topo, a nossa barra de navegação permite alternar instantaneamente o idioma da aplicação entre Português e Inglês, alternar o tema do ecrã para o modo noturno e aceder de forma centralizada a todas as notificações e avisos do sistema." | Fazer zoom no canto superior direito para mostrar a alteração do tema e idioma. |
| **4. Sidebar de Navegação** | 01:25 - 01:45 | O cursor passa sobre a **Sidebar lateral esquerda**. Passa o rato pelos diferentes menus (Monitorização, Dados, Sistemas) e clica em **Definições** e depois em **Perfil**. | "Na barra lateral esquerda, encontramos a navegação organizada por secções lógicas: Monitorização, Dados e Sistemas. Acedendo ao menu de Perfil, o utilizador pode editar os seus dados pessoais e gerir o seu contacto de SOS ativo para incidentes críticos." | Manter o movimento do cursor calmo e deliberado para evitar distrações. |
| **5. Página 'Como Funciona'** | 01:45 - 02:15 | Clica no botão **Como Funciona** (ou Sobre o Projeto). Faz um scroll calmo pela página, mostrando os diagramas de arquitetura, o fluxo de dados e os autores. | "Para os mais curiosos, a página 'Como Funciona' oferece um resumo pedagógico completo de toda a arquitetura física e lógica do MotoGuard IoT, explicando como os dados de telemetria são gerados, processados e integrados com Inteligência Artificial." | Fazer scroll de cima para baixo de forma contínua e pausada. |
| **6. Encerramento** | 02:15 - 02:30 | Volta à Dashboard principal. Surge no ecrã um convite para assistir ao próximo vídeo. | "No próximo vídeo, entraremos em detalhe na Secção de Monitorização em Tempo Real, onde veremos o mapa interativo, as análises de dados e o motor de deteção de alertas. Até já!" | Inserir um cartão de encerramento simples com indicação para o Vídeo 2. |

---

## 🎬 Vídeo 2: Secção de Monitorização: Mapa, Análises e Alertas
* **Objetivo:** Demonstrar o processamento de dados em tempo real, o mapa com a trajetória da moto, os gráficos históricos agregados (Analytics) e o sistema heurístico de deteção de alertas de segurança.
* **Duração estimada:** ~3:30 minutos.
* **Preparação da Gravação:**
  * Ter o backend a correr e o simulador Python ativo (enviando telemetria em tempo real).
  * Ter a página da **Dashboard** (Monitorização em Tempo Real), **Map**, **Analytics** e **Alertas** abertas em tabs separadas ou prontas para transição.
  * Forçar ou simular um alerta crítico (ex: uma queda ou travagem brusca) no simulador para demonstrar a reação em tempo real na interface.

### 📋 Estrutura de Cenas (Vídeo 2)

| Cena | Tempo | Ação Visual (Ecrã) | Locução (Voz) | Dicas de Produção |
| :--- | :---: | :--- | :--- | :--- |
| **1. Monitorização em Tempo Real** | 00:00 - 00:45 | Mostra o Dashboard ativo. Os **Gauges de Velocidade e RPM** estão a oscilar animadamente. Os cartões de aceleração, voltagem, pressão de pneus e inclinação (IMU) atualizam-se a cada segundo. | "Neste segundo vídeo, focamos na Secção de Monitorização do MotoGuard IoT. Aqui podemos ver o Dashboard em tempo real. Com uma latência inferior a 100ms, a plataforma apresenta as rotações do motor, velocidade, ângulos de inclinação capturados pela unidade IMU e a integridade de componentes cruciais como a bateria e os pneus." | Iniciar a simulação no terminal antes de começar esta cena para os valores estarem vivos no ecrã. |
| **2. Mapa Interativo** | 00:45 - 01:20 | Clica na página **Mapa**. Mostra o marcador da moto a mover-se suavemente sobre o OpenStreetMap, desenhando o rasto azul do percurso atual. | "No ecrã do Mapa, acompanhamos graficamente o percurso em tempo real através do Leaflet. A posição geográfica do motociclista é atualizada dinamicamente, permitindo a geolocalização constante do veículo com um traçado de rota limpo e preciso." | Fazer zoom no mapa para destacar o movimento fluido do marcador da moto. |
| **3. Motor de Alertas e SOS** | 01:20 - 02:25 | Clica na página de **Alertas**. Mostra a lista filtrável. No simulador, ativa-se o evento de **Queda (Crash)**. No ecrã da Dashboard, surge o banner vermelho de contagem decrescente de SOS e um alerta vermelho crítico no topo. | "O MotoGuard possui um motor de regras heurísticas que avalia continuamente a telemetria, detetando anomalias imediatas como travagens bruscas, sobreaquecimentos ou quedas. Se for detetada uma queda, o sistema inicia uma contagem SOS e, caso não seja cancelada pelo condutor, envia um alerta por email para o contacto de emergência associado." | Demonstrar a simulação da queda de forma coordenada. Mostrar o pop-up vermelho com o countdown. |
| **4. Secção de Análises (Analytics)** | 02:25 - 03:10 | Transita para a página de **Análises**. Mostra o heatmap de eventos georreferenciados e os gráficos cumulativos de velocidade e quilometragem. | "Para uma visão macro, a secção de Análises disponibiliza heatmaps de incidentes e gráficos consolidados sobre o estilo de condução habitual. Esta análise a longo prazo ajuda o motociclista a identificar zonas recorrentes de perigo e a monitorizar a evolução do seu desempenho." | Apontar para os pontos vermelhos/laranja no heatmap onde ocorreram travagens bruscas ou quedas. |
| **5. Encerramento** | 03:10 - 03:30 | Ecrã regressa ao menu lateral. Foco na secção de Dados. | "A monitorização em tempo real e os alertas garantem segurança ativa. No próximo vídeo, veremos como o MotoGuard armazena estes percursos, gere as motas da tua garagem e processa as análises pós-viagem por Inteligência Artificial." | Transição suave para fecho da secção. |

---

## 🎬 Vídeo 3: Secção de Dados: Garagem, Viagens e GPX
* **Objetivo:** Apresentar o gerenciamento de veículos na Garagem, o histórico de viagens com os respetivos scores de segurança gerados por Machine Learning (Isolation Forest) e a importação/visualização de percursos GPX.
* **Duração estimada:** ~3:30 minutos.
* **Preparação da Gravação:**
  * Ter a página da **Garagem** preparada com pelo menos 2 motas registadas (ex: uma Scooter e uma Desportiva).
  * Ter a lista de **Viagens** povoada com algumas viagens concluídas que possuam scores de ML e estilos de condução calculados (Agressivo, Defensivo, Económico).
  * Preparar um ficheiro GPX padrão na pasta de transferências para fazer a demonstração do upload rápido.

### 📋 Estrutura de Cenas (Vídeo 3)

| Cena | Tempo | Ação Visual (Ecrã) | Locução (Voz) | Dicas de Produção |
| :--- | :---: | :--- | :--- | :--- |
| **1. Gestão da Garagem** | 00:00 - 00:50 | Mostra a página **Garagem**. Clica em **Adicionar Nova Mota**. Seleciona o perfil "Desportiva", dá um nome à moto (ex: 'Minha R1') e guarda. Mostra as motas listadas com os seus perfis. | "Bem-vindos ao terceiro vídeo, focado na Secção de Dados. Começamos na Garagem, onde podes gerir todos os teus motociclos. Cada mota está associada a um perfil físico predefinido que define dinamicamente os thresholds de segurança. Por exemplo, uma mota desportiva aceita inclinações de curva muito superiores a uma scooter urbana." | Fazer zoom nos perfis físicos sugeridos e nos limites de inclinação associados (ex: 85° para Desportiva). |
| **2. Histórico de Viagens e ML** | 00:50 - 01:50 | Transita para a página de **Viagens**. Mostra a lista paginada de viagens anteriores. Foca nos cartões que indicam a classificação (Commute, Weekend Ride, etc.), o estilo de condução (K-Means) e a pontuação de Machine Learning. | "No histórico de Viagens, cada percurso concluído é processado de forma inteligente. O nosso pipeline de Machine Learning corre o algoritmo Isolation Forest para classificar a segurança da viagem com uma pontuação de zero a um, enquanto o algoritmo K-Means classifica automaticamente o estilo de condução como Agressivo, Defensivo ou Económico." | Mostrar claramente os badges visuais de cada viagem (ex: 'Económico' a verde, 'Agressivo' a vermelho/laranja). |
| **3. Detalhes de Viagem e Playback** | 01:50 - 02:45 | Clica numa viagem específica da lista para abrir o **TripDetail**. Arrasta o slider de **Playback da Viagem**, mostrando o cursor a mover-se no mapa histórico e os gráficos de telemetria a acompanhar dinamicamente a linha temporal. | "Ao abrir uma viagem detalhada, podes reviver toda a condução. O MotoGuard disponibiliza um controlo de playback para veres exatamente onde estavas a cada segundo, correlacionando a posição no mapa com gráficos de velocidade, inclinação e forças G. Podes ainda exportar esta informação em formato PDF, CSV ou GPX." | Demonstrar o botão de Playback e arrastar a barra de progresso suavemente de trás para a frente. |
| **4. Importação e Análise de GPX** | 02:45 - 03:15 | Vai à página **Importar GPX**. Seleciona um ficheiro GPX real da máquina local e faz o upload. Mostra a rota gerada de imediato no mapa e os gráficos de velocidade/elevação estimados. | "Se utilizas dispositivos GPS dedicados ou outras apps de gravação, podes importar os teus ficheiros GPX diretamente na secção correspondente. A plataforma renderiza a rota num mapa dedicado e extrai métricas instantâneas de distância e altimetria." | Utilizar um ficheiro GPX que tenha uma rota bonita e variada para um bom impacto visual. |
| **5. Encerramento** | 03:15 - 03:30 | Regressa à sidebar e aponta para a secção de Sistemas. | "Com os teus dados centralizados, o MotoGuard atua como uma verdadeira caixa-negra inteligente. No quarto e último vídeo, vamos mergulhar nos bastidores e explorar a Secção de Sistemas, os simuladores que dão vida à telemetria e o fluxo de dados do backend." | Terminar com uma animação simples de carregamento de ecrã. |

---

## 🎬 Vídeo 4: Secção de Sistemas: Simulador, Simulador Real, Simulador GPX e Como Funciona
* **Objetivo:** Explicar a arquitetura interna do MotoGuard IoT, demonstrar a execução do simulador headless em Python, os componentes do Simulador Real e de GPX integrados na interface Web, e concluir a apresentação global do projeto.
* **Duração estimada:** ~4:00 minutos.
* **Preparação da Gravação:**
  * Ter o terminal visível (ou editor de código VS Code) onde corre o `headless_simulator.py`.
  * Ter as páginas **Simulador Real** (IRL) e **Simulador GPX** abertas no browser.
  * O broker MQTT (Mosquitto) e outros serviços Docker Compose devem estar operacionais.

### 📋 Estrutura de Cenas (Vídeo 4)

| Cena | Tempo | Ação Visual (Ecrã) | Locução (Voz) | Dicas de Produção |
| :--- | :---: | :--- | :--- | :--- |
| **1. Simulador Headless (Python)** | 00:00 - 00:55 | Mostra uma janela de terminal a executar o script Python `headless_simulator.py`. Destaca as mensagens de publicação MQTT (`motoguard/telemetria`) que surgem na consola. | "Bem-vindos ao quarto e último vídeo explicativo. Desta vez, entramos nos bastidores técnicos do sistema. Para alimentar esta plataforma sem necessidade de hardware físico no arranque, desenvolvemos um simulador realista em Python 3.12. Este simulador calcula a física do motociclo e publica fluxos de dados via MQTT para o broker Mosquitto, mimetizando perfeitamente um dispositivo eletrónico embarcado." | Usar um tamanho de letra legível no terminal. Realçar a latência e a consistência das publicações. |
| **2. Simulador de Dados Reais (IRL)** | 00:55 - 01:40 | Transita para a página **Simulador Real** na interface do MotoGuard. Ativa a simulação de dados capturados num percurso real. Mostra os valores a serem replicados instantaneamente. | "Na interface web, temos o Simulador Real. Este módulo permite-nos carregar logs de sensores reais gravados durante viagens reais e injetá-los no nosso pipeline de processamento em tempo real. É o elo de ligação ideal para testar o sistema com dados reais de estrada (IRL) sem ter de ligar hardware físico complexo." | Clicar nos controlos de ativação e mostrar os valores dos sensores a serem atualizados. |
| **3. Simulador GPX na Web** | 01:40 - 02:30 | Transita para a página **Simulador GPX**. Carrega um ficheiro GPX e clica em **Iniciar Simulação**. Mostra a animação e o indicador no painel. | "Já com o Simulador GPX integrado na Web, podemos carregar qualquer rota GPX — como a famosa N222 — e o simulador encarregar-se-á de converter os waypoints geográficos em telemetria simulada contínua, estimando a aceleração, inclinação nas curvas e velocidade com base na física simulada do modelo de mota escolhido." | Mostrar no mapa o marcador a andar enquanto os dados são gerados. |
| **4. Arquitetura e Engenharia de Dados** | 02:30 - 03:30 | Mostra a página **Como Funciona** focada no diagrama de fluxo de dados. Pode também alternar rapidamente para o código do backend (`mqtt.service.ts` ou `realtime-anomaly.service.ts`) no editor para demonstrar a robustez técnica. | "Olhando de forma integrada para o sistema: a telemetria viaja via MQTT, é capturada pelo nosso backend em Node.js e escrita na base de dados InfluxDB para séries temporais e no PostgreSQL para dados relacionais. Em paralelo, a telemetria em tempo real é transmitida por WebSockets via Socket.IO para a UI, enquanto o motor de Machine Learning em Python processa anomalias de forma assíncrona usando Isolation Forest quando a viagem termina." | Fazer zoom nos blocos de código ou secções do diagrama que mencionam InfluxDB, PostgreSQL, Socket.IO e Machine Learning. |
| **5. Conclusão e Resumo do Projeto** | 03:30 - 04:00 | Mostra a Landing Page do projeto e a informação dos autores (Pedro Sousa e Nuno Americano). Termina com uma imagem estática apelativa ou transição para negro. | "O MotoGuard IoT demonstra assim como o desenvolvimento de software moderno, a engenharia de dados em tempo real e a Inteligência Artificial se podem unir para promover a segurança rodoviária. Agradecemos o vosso acompanhamento ao longo desta série de vídeos. Todo o projeto está documentado e disponível em código aberto no GitHub. Conduzam com segurança e até à próxima!" | Adicionar em rodapé o link do repositório GitHub e os contactos dos autores. |

---

## 💡 Dicas Gerais para a Gravação dos Vídeos

1. **Gravação de Ecrã (Screencast):**
   * Configura o ecrã para a resolução nativa de **1920x1080 (1080p)**.
   * Aumenta ligeiramente o zoom do browser (110% ou 120%) para que os textos, números dos gauges e menus sejam facilmente legíveis em dispositivos móveis.
   * Utiliza um software como o **OBS Studio**, **Camtasia** ou **ShareX** configurado para gravar a 60 FPS com bitrate elevado para transições fluidas.
   * Oculta a barra de tarefas do sistema operativo e marcadores pessoais do browser para obter uma imagem limpa e profissional.

2. **Qualidade de Áudio:**
   * Utiliza um microfone de lapela ou condensador USB de boa qualidade.
   * Grava num espaço silencioso e sem eco (podes usar filtros de redução de ruído, como o noise suppression do OBS ou do Audacity).
   * Fala a um ritmo calmo, pausado e com dicção clara. Se te enganares na locução, faz uma pausa de 3 segundos e repete a frase para facilitar a edição posterior.

3. **Edição e Pós-produção:**
   * Adiciona uma **música de fundo suave** (estilo Corporate Tech ou Lo-Fi calmo) com volume muito baixo (-20dB a -25dB) para não abafar a voz.
   * Utiliza **realces visuais** (setas, círculos amarelos, ou efeitos de zoom) durante a edição para focar a atenção do utilizador no elemento que está a ser explicado no momento.
   * Cria introduções e encerramentos curtos e padronizados para os 4 vídeos, garantindo consistência na identidade do projeto.

4. **📋 Checklist de Preparação do Ambiente (Demo Setup):**
   * **Criação da Conta:** Criar uma conta nova do zero durante a gravação do Vídeo 1 para demonstrar o fluxo de onboarding orgânico.
   * **Após o Vídeo 1:** Antes de prosseguir para a gravação dos Vídeos 2, 3 e 4, acede ao painel e adiciona **pelo menos 10 motas** na tua Garagem para popular as vistas e os menus.
   * **Gerar Viagens Coerentes:** Corre o simulador para criar **pelo menos 15 viagens** completas distribuídas pelas motas. Isto garante que a secção de dados, os gráficos e os heatmaps de análises ficam ricos e preenchidos de forma realista para os vídeos subsequentes.

