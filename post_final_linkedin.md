# 🏍️ MotoGuard IoT — POST FINAL PARA LINKEDIN

---

## Texto para Publicação

🚀 **MotoGuard IoT — Um Sistema Inteligente de Monitorização para Motociclos**

Durante este semestre, eu (Pedro Sousa) e o Nuno Americano dedicámo-nos ao desenvolvimento do **MotoGuard IoT** — um projeto de licenciatura na Universidade de Trás-os-Montes e Alto Douro (UTAD) que nasceu de uma questão simples: **como podemos tornar a condução de motociclos mais segura através da tecnologia?**

A resposta materializou-se num sistema distribuído de Internet das Coisas que combina telemetria em tempo real, inteligência artificial e uma arquitetura de microsserviços robusta, capaz de monitorizar, analisar e alertar sobre o comportamento de um motociclo em tempo real.

---

### 📡 **Monitorização em Tempo Real com Latência Abaixo dos 100ms**

No coração do sistema, um pipeline de telemetria processa dados a cada fração de segundo. A informação flui do simulador Python para o broker MQTT (Eclipse Mosquitto), é consumida pelo backend Node.js, armazenada no InfluxDB (séries temporais) e no PostgreSQL (dados relacionais), e é transmitida instantaneamente para o dashboard React via Socket.IO.

Monitorizamos mais de 15 parâmetros em simultâneo:

• Velocidade e aceleração instantâneas
• Rotações do motor (RPM) e posição da caixa de velocidades
• Temperatura do motor e temperatura ambiente
• Tensão da bateria e estado do sistema elétrico
• Ângulos de inclinação (roll, pitch, yaw) através de IMU
• Forças G longitudinais, laterais e verticais
• Pressão dos pneus (dianteiro e traseiro)
• Pressão do óleo do motor
• Posição GPS com coordenadas geográficas
• Aceleração rápida e travagem brusca

Tudo isto visível em tempo real num dashboard interativo, com menos de 100 milissegundos de atraso entre a geração do dado e a sua apresentação no ecrã.

---

### 🧠 **Machine Learning Aplicado à Deteção de Anomalias**

Uma das componentes mais desafiantes foi a implementação de um pipeline de Machine Learning capaz de identificar anomalias na condução. Desenvolvemos dois modelos complementares:

**Modelo 1 — Isolation Forest (pós-viagem):**
Analisa 24 features extraídas da telemetria de cada viagem — velocidade máxima e média, RPM máximo, ângulos de inclinação extremos, forças G máximas, temperatura máxima, distância percorrida, número de eventos por severidade, entre outros. O modelo atribui um score de anomalia normalizado entre 0 e 1, permitindo classificar cada viagem quanto ao seu nível de segurança.

**Modelo 2 — Z-Score (tempo real):**
Um detetor ligeiro que corre em paralelo com o fluxo de telemetria, mantendo um buffer dos últimos 100 pontos por dispositivo. Quando um valor foge ao desvio padrão esperado, um evento de anomalia em tempo real é emitido para o dashboard.

**Modelo 3 — K-Means (classificação de estilo de condução):**
Com base nas mesmas features, o sistema agrupa as viagens em três clusters — Agressivo, Defensivo e Económico — permitindo ao utilizador perceber o seu estilo de condução e evoluí-lo ao longo do tempo.

---

### 🏍️ **Simulador Realista com 8 Perfis de Motociclo**

Para desenvolver e testar o sistema sem depender de hardware físico, construímos um simulador em Python 3.12 com física realista. Cada um dos 8 perfis de motociclo tem parâmetros únicos:

• **Scooter (120 km/h, 130 kg):** Ideal para cidade, centro de gravidade elevado, queda detetada aos 55° de inclinação
• **Naked (200 km/h, 190 kg):** Versatilidade equilibrada, queda aos 70°
• **Desportiva (299 km/h, 200 kg):** Performance máxima, concebida para altas velocidades e curvas apertadas, queda apenas aos 85°
• **Trail/Adventure (200 km/h, 230 kg):** Robusta para off-road, tolera 65° de inclinação
• **Custom/Cruiser (180 km/h, 300 kg):** Pesada e imponente, qualquer inclinação acima de 50° com 1.8G é suspeita
• **Motocross/Enduro (130 km/h, 110 kg):** Leve e ágil, saltos de 3.5G são normais, queda apenas aos 75°
• **Touring (220 km/h, 350 kg):** Conforto em longas distâncias, com 350kg qualquer G-force acima de 1.5G é preocupante
• **Supermotard (160 km/h, 150 kg):** Condução agressiva, queda detetada a partir dos 80°

O simulador suporta rotas GPX reais, permitindo reproduzir trajetos como a N222 (uma das melhores estradas do mundo para motociclismo), a Estrada Nacional 2, ou percursos pelos Picos da Europa e Dolomitas.

---

### ⚠️ **Sistema de Deteção de Eventos com 3 Níveis de Severidade**

O motor heurístico avalia continuamente a telemetria e deteta 8 tipos de eventos:

| Evento | Descrição | Severidade |
|--------|-----------|------------|
| Queda | Thresholds de roll + G-force por perfil | CRITICAL |
| Travagem Brusca | Desaceleração > 7 m/s² | WARNING |
| Aceleração Rápida | Aceleração > 5 m/s² | INFO |
| Sobreaquecimento | Temperatura > threshold por perfil | WARNING |
| Falha de Alternador | Tensão < 12V contínuo | CRITICAL |
| Inclinação Excessiva | Roll > threshold por perfil | WARNING |
| ABS Ativado | Ativação do sistema antibloqueio | INFO |
| TC Ativado | Ativação do controlo de tração | INFO |

Cada evento é classificado por severidade (INFO, WARNING, CRITICAL), persistido na base de dados e apresentado no centro de notificações do dashboard.

---

### 📊 **Análise Pós-Viagem e Scoring de Segurança**

No final de cada viagem, o sistema executa uma pipeline completa de análise:

1. **Categorização automática:** A viagem é classificada em Commute (deslocação diária), Weekend Ride (passeio), Track Day (circuito) ou Off-road (todo-o-terreno)
2. **Scoring heurístico:** Uma avaliação baseada em regras que analisa a velocidade média, distância, eventos ocorridos e sua severidade
3. **Scoring ML (Isolation Forest):** O modelo de machine learning atribui um segundo score baseado em 24 features extraídas da telemetria
4. **Classificação de estilo:** O algoritmo K-Means identifica se a condução foi Agressiva, Defensiva ou Económica
5. **Feedback textual:** O sistema gera automaticamente um feedback descritivo, explicando que fatores contribuíram para o score (ex: "Travagens bruscas detetadas em 3 ocasiões")

O histórico completo de viagens pode ser visualizado, filtrado, comparado e exportado em formato PDF, CSV ou GPX.

---

### 🖥️ **Arquitetura de Microsserviços e Stack Tecnológico**

O MotoGuard IoT foi desenhado desde o início com uma arquitetura de microsserviços, permitindo escalabilidade independente de cada componente e desenvolvimento paralelo entre a equipa.

**Backend (Node.js 20 + Express + TypeScript):**
▸ 15+ serviços e controladores com responsabilidades bem definidas
▸ Prisma ORM para PostgreSQL (6 modelos: User, Motorcycle, MotorcycleProfile, Trip, TripEvent, GpxData)
▸ Cliente InfluxDB para séries temporais (measurement: telemetry, retenção: 30 dias)
▸ Cliente MQTT para comunicação IoT (tópicos: motoguard/telemetria, motoguard/comando)
▸ Socket.IO para broadcast em tempo real (~1285 linhas no SocketService)
▸ Autenticação JWT com httpOnly cookie e proteção CSRF
▸ 30+ endpoints REST documentados com Swagger/OpenAPI

**Frontend (React 19 + Vite + Tailwind CSS):**
▸ 17 páginas com lazy loading e code splitting
▸ Dashboard com gauges animados, mapa Leaflet interativo e gráficos Recharts
▸ 24+ componentes reutilizáveis
▸ Internacionalização completa PT/EN com ~200 chaves traduzidas
▸ Modo Demo para apresentações sem dependências externas
▸ Modo noturno automático com CSS variables

**Infraestrutura:**
▸ Docker Compose com 6 containers (backend, frontend, postgres, influxdb, mosquitto, simulador)
▸ Rede interna isolada para comunicação entre serviços
▸ Health checks e graceful shutdown em todos os serviços
▸ Rate limiting, validação de input e proteção contra SQL injection

---

### 🔐 **Segurança como Prioridade**

Todo o sistema foi desenvolvido com práticas de segurança desde o início:

• **JWT em httpOnly cookie:** Previne roubo de token por XSS
• **CSRF protection:** Double-submit cookie pattern para rotas de state-changing
• **Rate limiting:** 20 tentativas por 15 minutos em rotas de autenticação
• **Password hashing:** bcrypt com cost 12
• **Encryption:** AES-256-GCM para dados sensíveis (chaves de API)
• **SQL injection:** Prevenido pelo Prisma ORM com parameterized queries
• **Validação de input:** Payloads validados tanto no frontend como no backend
• **Graceful error handling:** Nenhuma stack trace exposta em produção

---

### 📈 **Resultados e Métricas**

Após meses de desenvolvimento, testes e refinamento:

• **58 testes** unitários e de integração a passar
• **30+ endpoints API** funcionais e documentados
• **17 páginas** no frontend
• **15+ serviços** no backend
• **8 perfis** de motociclo simulados
• **18 ficheiros GPX** reais para teste de rotas
• **15 screenshots** na documentação
• **735 linhas** de README e documentação técnica

---

### 🙏 **Agradecimentos**

Este projeto não teria sido possível sem o contributo de várias pessoas.

Ao **Nuno Americano**, meu colega de projeto, que esteve ao meu lado em cada etapa — desde as primeiras linhas de código até à entrega final. O trabalho em equipa foi, sem dúvida, o maior ativo deste projeto.

Aos orientadores **Prof. Cristiano Pendão** e **Prof. Arsénio Reis**, pela orientação, disponibilidade e feedback ao longo de todo o semestre. As vossas sugestões foram fundamentais para elevar a qualidade do trabalho.

À **Universidade de Trás-os-Montes e Alto Douro**, por proporcionar o ambiente e os recursos necessários para o desenvolvimento deste projeto.

---

### 🔮 **Trabalho Futuro**

O MotoGuard IoT está funcional e completo, há sempre espaço para evolução:

• **Integração com hardware real (ESP32):** Substituir o simulador por sensores reais instalados numa mota
• **PWA com service workers:** Permitir funcionamento offline e notificações push
• **Live location sharing:** Partilhar localização em tempo real com contactos de emergência
• **Integração com apps externas:** Strava, Google Maps, Apple Health
• **Dashboards partilháveis:** Links públicos para relatórios de viagem
• **Mais modelos de ML:** Experimentar Random Forest, XGBoost, ou redes neuronais para comparação de performance

---

🔗 **Código fonte:** github.com/pedromfs/Moto-Guard-IoT  
📧 **Contacto:** pedro.sousa@utad.eu  
💼 **LinkedIn:** linkedin.com/in/pedrosousa

---

*"A segurança não é um destino, é uma jornada contínua."*

#UTAD #IoT #MachineLearning #React #NodeJS #Python #MQTT #TypeScript #Docker #EngenhariaInformática #ProjetoDeLicenciatura #Cibersegurança #FullStack #Inovação