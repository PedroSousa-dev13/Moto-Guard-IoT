# 🏍️ MotoGuard IoT - Descrição dos Slides

---

## 🟢 Slide 1 - Capa

**Título:** MotoGuard IoT - Sistema de Monitorização Inteligente para Motociclos

**Descrição:** Este slide apresenta o projeto de licenciatura desenvolvido na Universidade de Trás-os-Montes e Alto Douro (UTAD) durante o ano letivo 2025/2026. Foram dois os autores: Pedro Sousa (eu) e Nuno Americano, que trabalharam em conjunto ao longo de todo o semestre para construir este sistema IoT completo. O projeto representa a culminação de meses de trabalho académico, combinando conhecimentos de desenvolvimento web, sistemas distribuídos, bases de dados e machine learning.

---

## 🟢 Slide 2 - O que é?

**Título:** O que é o MotoGuard IoT?

**Descrição:** Aqui explico de forma simples o que o sistema faz. Basicamente, é uma aplicação que permite ao motociclista monitorizar o seu veículo em tempo real, receiving dados como velocidade,RPM, temperatura do motor e ângulos de inclinação. O sistema também usa inteligência artificial para detetar anomalias na condução e oferece uma análise detalhada após cada viagem, com um scoring de segurança. Inclui simuladores realistas para testar tudo sem precisar de uma mota real, o que foi muito útil durante o desenvolvimento e apresentações.

---

## 🟢 Slide 3 - Stack Tecnológico

**Título:** Stack Tecnológico Completo

**Descrição:** Neste slide mostro todas as tecnologias que usamos no projeto. O backend foi desenvolvido em Node.js 20 com Express e TypeScript, enquanto o frontend usa React 19 com Vite e Tailwind CSS. O simulador é em Python 3.12, e para machine learning usamos Scikit-learn com Isolation Forest e K-Means. As bases de dados incluem PostgreSQL para dados relacionais e InfluxDB para séries temporais. A comunicação em tempo real é feita via MQTT e Socket.IO, e tudo está containerizado com Docker Compose. Esta escolha de stack permite scalability e manutenção facilitada.

---

## 🟢 Slide 4 - Arquitetura

**Título:** Arquitetura de Microsserviços

**Descrição:** O sistema segue uma arquitetura de microsserviços, onde cada componente trabalha de forma independente mas comunicam entre si. O frontend comunica com o backend via REST API e Socket.IO, o backend processa os dados e comunica com o simulador via MQTT. O MQTT Broker (Mosquitto) é o中枢 de toda a comunicação IoT. Os dados são armazenados em PostgreSQL (dados relacionais como utilizadores, motas, viagens) e InfluxDB (telemetria em séries temporais). Esta arquitetura permite escalar cada componente individualmente conforme a necessidade.

---

## 🟢 Slide 5 - Funcionalidades

**Título:** Principais Funcionalidades do Sistema

**Descrição:** Aqui listo as funcionalidades principais que implementámos. O dashboard em tempo real mostra gauges de velocidade e RPM, mapa com a localização, e todos os dados da telemetria. É possível controlar o simulador remotamente através da interface web, podendo colocá-lo em idle, iniciar ou parar a simulação. Supportamos 8 perfis de motociclos diferentes, desde Scooter até Desportiva, cada um com a sua física característica. O sistema deteta eventos como quedas, travagens bruscas e sobreaquecimento. As viagens são automaticamente classificadas em categorias como Commute, Weekend Ride, Track Day ou Off-road. Também supports importing e exporting de ficheiros GPX para rotas.

---

## 🟢 Slide 6 - Machine Learning

**Título:** Inteligência Artificial e Machine Learning

**Descrição:** Uma das partes mais interessantes do projeto! Implementámos um pipeline de ML completo. O Isolation Forest é usado para detetar anomalias nas viagens, analisando 24 features extraídas da telemetria como velocidade máxima, RPM máximo, ângulos de inclinação, forças G, temperatura e distância percorrida. Cada viagem recebe um score de anomalia entre 0 e 1. Para deteção em tempo real, usamos um modelo Z-score que analisa os dados à medida que chegam. Também aplicámos clustering K-Means para classificar o estilo de condução em três categorias: Aggressive (agressivo), Defensive (defensivo) e Economy (económico).

---

## 🟢 Slide 7 - Interface

**Título:** Interface e Experiência do Utilizador

**Descrição:** O frontend foi desenvolvido com foco na experiência do utilizador. O design é mobile-first, funcionando bem em telemóveis e tablets. A aplicação está disponível em português e inglês, thanks to um sistema de internacionalização completo. Os mapas são interativos usando Leaflet e OpenStreetMap, permitindo visualizar a rota em tempo real. Os gráficos de análise são feitos com Recharts. Há dois simuladores disponíveis: um que usa ficheiros GPX e outro que usa dados reais recolhidos durante testes. O sistema de notificações alerta o utilizador em tempo real sobre eventos críticos como quedas ou sobreaquecimento.

---

## 🟢 Slide 8 - Simuladores

**Título:** Simulador Python Realista

**Descrição:** O simulador em Python é uma peça fundamental do sistema. Implementámos 8 perfis de motociclos distintos, cada um com características físicas realistas em termos de velocidade máxima, RPM, peso, ângulos de inclinação típicos e thresholds para deteção de quedas. O simulador pode seguir rotas GPX reais, usando interpolação para reproduzir o trajecto. É possível simular eventos como quedas (com thresholds de G-force e inclinação), falhas de alternador (baixa voltagem), sobreaquecimento do motor, travagens bruscas e acelerações rápidas. Os dados são enviados via MQTT e tudo pode ser controlado remotamente a partir da interface web.

---

## 🟢 Slide 9 - Números

**Título:** Números e Métricas do Projeto

**Descrição:** Um slide mais técnico que mostra a dimensão do projeto. O backend tem mais de 15 serviços e controladores, o frontend tem 17 páginas diferentes e a API expõe mais de 30 endpoints REST. Todo o código tem tipagem TypeScript, tanto no frontend como no backend. Os testes unitários e de integração têm um threshold de 80% de coverage. A documentação técnica do projeto (ficheiro PROJECT_REPORT.md) tem 658 linhas e detalha toda a arquitetura, decisões de design e implementação.Tudo isto demonstra o esforço e complexidade envolvidos no projeto.

---

## 🟢 Slide 10 - Conclusão

**Título:** Projeto Concluído com Sucesso

**Descrição:** Slide de conclusão onde agradecer a toda a equipa. Primeiro ao Nuno Americano, companheiro de projeto, que contribuyuiu imenso para o sucesso do trabalho. Depois aos orientadores Cristiano Pendão e Arsénio Reis, pelo acompanhamento e orientação ao longo do semestre. O projeto atingiu todos os objetivos propostos: telemetria em tempo real, deteção de anomalias via ML e análise pós-viagem. Como trabalho futuro, a próxima etapa natural seria integrar hardware real (sensores ESP32/Arduino) para recolher dados de motas verdadeiras em vez de simulador.

---

## 🟢 Slide 11 - Contacto

**Título:** Contactos e Links

**Descrição:** Slide final com informação de contacto. O código fonte está disponível no GitHub (github.com/pedromfs/Moto-Guard-IoT) para quem quiser explorar o projeto. Podem contactar-me via email ou LinkedIn. Este slide serve para networking e para quem quiser saber mais sobre o projeto ou colaboração futura!

---

# LinkedIn - Texto de Publicação

Segue-se o texto que podem usar junto com o carrossel:

---

🚀 **MotoGuard IoT - Projeto de Licenciatura Concluído!**

É com enorme satisfação que partilho o culminar de meses de trabalho!🏍️

Durante este semestre, desenvolvi em conjunto com o Nuno Americano o **MotoGuard IoT**, um sistema completo de monitorização inteligente para motociclos.

O que distinguish este projeto?

✅ Arquitetura de microsserviços com Docker Compose
✅ Telemetria em tempo real via MQTT (<100ms latência)
✅ Machine Learning com Isolation Forest para deteção de anomalias
✅ Simulador Python realista com 8 perfis de motociclos
✅ Dashboard React 19 com mapas interativos e gráficos
✅ Classificação automática de viagens (Commute, Track Day, Off-road...)

Tudo isto implementado com Node.js, TypeScript, Python, PostgreSQL, InfluxDB e muito mais!

Um projeto que exigiu integração de várias áreas: desenvolvimento web, sistemas distribuídos, bases de dados e inteligência artificial.

Obrigado ao Nuno Americano pelo trabalho em equipa! 🎉

Obrigado aos orientadores Cristiano Pendão e Arsénio Reis pela orientação!

🔗 Código: github.com/pedromfs/Moto-Guard-IoT

#UTAD #Licenciatura #IoT #MachineLearning #React #NodeJS #Python #MQTT #WebDevelopment