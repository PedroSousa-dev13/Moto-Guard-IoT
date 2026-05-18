# 🏍️ MotoGuard IoT - Carrossel LinkedIn

---

## Slide 1: O Projeto

**Título:** MotoGuard IoT 🏍️

**Descrição do slide:** Apresentação do projeto de licenciatura da UTAD. Sistema distribuído de IoT para monitorização de motociclos em tempo real, com deteção de anomalias via Machine Learning.

**Texto para apresentar:** "MotoGuard IoT é o meu projeto de licenciatura na UTAD. Desenvolvi um sistema completo de monitorização para motociclos que permite acompanhar em tempo real a telemetria da mota, detetar eventos anómalos e analisar o historial de viagens. Todo isto combinado com inteligência artificial para identificar padrões de condução e potenciais problemas."

---

## Slide 2: O Problema

**Título:** Porquê o MotoGuard?

**Descrição do slide:** Contextualização do problema - a necessidade de monitorizar motociclos em tempo real, detectar incidentes e analisar padrões de condução.

**Texto para apresentar:** "Na realidade, há poucos sistemas acessíveis que permitam a um motociclista comum monitorizar a sua condução. A maioria das soluções existentes são caras ou vocacionadas para competição. O objetivo foi criar uma solução aberta, escalável e acessível que qualquer motociclista pudesse usar para melhorar a sua segurança e entender melhor o seu estilo de condução."

---

## Slide 3: Stack Tecnológico

**Título:** Tecnologias Usadas

**Descrição do slide:** Overview do stack tecnológico completo - Node.js, React, Python, PostgreSQL, InfluxDB, MQTT, Socket.IO, Docker.

**Texto para apresentar:** "No backend usei Node.js 20 com Express e TypeScript para uma API robusta e tipada. O frontend é React 19 com Vite e Tailwind CSS para uma interface moderna e responsiva. O simulador está em Python 3.12, e para machine learning usamos scikit-learn. As bases de dados são PostgreSQL para dados relacionais e InfluxDB para séries temporais. A comunicação em tempo real é feita via MQTT e Socket.IO, e tudo está containerizado com Docker Compose."

---

## Slide 4: Arquitetura

**Título:** Arquitetura do Sistema

**Descrição do slide:** Diagrama da arquitetura de microsserviços - Fluxo de dados entre simulador, backend, frontend e bases de dados.

**Texto para apresentar:** "O sistema segue uma arquitetura de microsserviços. O simulador Python envia telemetria via MQTT, o backend processa tudo e faz broadcast em tempo real via Socket.IO. Os dados são guardados em PostgreSQL para informação estruturada e InfluxDB para a telemetria bruta em séries temporais. O frontend recebe tudo em tempo real, permitindo dashboards atualizados instantaneamente."

---

## Slide 5: Telemetria em Tempo Real

**Título:** Telemetria em Tempo Real

**Descrição do slide:** Funcionalidades de telemetria - velocidade, RPM, temperatura, inclinação, forças G, GPS, etc.

**Texto para apresentar:** "O sistema recolhe e processa telemetria com menos de 100ms de latência. Monitorizamos velocidade, RPM, posição da cambeta, temperatura do motor e da ambiente, voltagem da bateria, pressão dos pneus, ângulos de roll, pitch e yaw, forças G, posição GPS, e muito mais. Tudo chega ao dashboard em tempo real via Socket.IO."

---

## Slide 6: Simulador Python

**Título:** Simulador Realista

**Descrição do slide:** O simulador Python com 8 perfis de motociclos, física realista e suporte a rotas GPX.

**Texto para apresentar:** "Desenvolvi um simulador Python realista com 8 perfis de motociclos diferentes - desde scooters até desportivas. Cada perfil tem a sua própria física: velocidade máxima, RPM, peso, ângulos típicos de inclinação, e thresholds para deteção de quedas. O simulador consegue seguir rotas GPX reais e pode ser controlado remotamente via interface web para iniciar, parar ou colocar em idle."

---

## Slide 7: Machine Learning

**Título:** Inteligência Artificial

**Descrição do slide:** Pipeline ML com Isolation Forest para deteção de anomalias, Z-score para tempo real, e K-Means para classificação do estilo de condução.

**Texto para apresentar:** "Uma das partes mais interessantes do projeto: machine learning aplicado! O Isolation Forest analisa 24 features extraídas da telemetria de cada viagem e atribui um score de anomalia de 0 a 1. Para deteção em tempo real, usamos Z-score que analisa os dados à medida que chegam. Também usamos K-Means para classificar o estilo de condução em três categorias: Agressivo, Defensivo ou Económico."

---

## Slide 8: Deteção de Eventos

**Título:** Deteção de Eventos

**Descrição do slide:** Sistema de deteção de eventos heurísticos - quedas, sobreaquecimento, falhas elétricas, travagens bruscas.

**Texto para apresentar:** "Além do ML, o sistema tem um módulo de deteção heurística que avalia eventos em tempo real. Detetamos quedas baseadas em thresholds de G-force e inclinação, sobreaquecimento do motor, falhas de alternador (baixa voltagem), travagens bruscas, acelerações rápidas, e muito mais. Cada evento é classificado por severidade e guardado na base de dados."

---

## Slide 9: Interface e Dashboard

**Título:** Interface Moderna

**Descrição do slide:** Dashboard React com gauges, mapas Leaflet, gráficos Recharts, internacionalização PT/EN.

**Texto para apresentar:** "O frontend é uma SPA React 19 com design mobile-first. O dashboard mostra gauges de velocidade e RPM em tempo real, mapa com a localização atual da mota, dados do IMU, temperatura e voltagem. Há gráficos de análise de velocidade e RPM ao longo do tempo, sistema de notificações, e a app está toda traduzida em português e inglês."

---

## Slide 10: Análise Pós-Viagem

**Título:** Análise de Viagens

**Descrição do slide:** Classificação automática de viagens, scores de segurança, histórico, comparação entre viagens.

**Texto para apresentar:** "Depois de cada viagem, o sistema faz uma análise completa. Classifica automaticamente a viagem em categorias: Commute, Weekend Ride, Track Day ou Off-road. Atribui um ML score de anomalia, um score heurístico, e identifica o estilo de condução. O utilizador pode ver o histórico de todas as viagens, comparar métricas entre elas, e exportar relatórios."

---

## Slide 11: Conclusão e Próximos Passos

**Título:** Conclusão

**Descrição do slide:** Resultados alcançados, agradecimentos, trabalho futuro.

**Texto para apresentar:** "O projeto atingiu todos os objetivos propostos: telemetria em tempo real com baixa latência, deteção de anomalias via machine learning, análise pós-viagem completa, e uma interface responsiva e intuitiva. Agradeço ao Nuno Americano pelo excelente trabalho em equipa, e aos orientadores Cristiano Pendão e Arsénio Reis pela orientação. Próximo passo seria integrar hardware real com sensores ESP32!"

---

# Texto Principal para Publicação

---

🚀 **MotoGuard IoT - Projeto de Licenciatura Concluído!**

🏍️ É com enorme satisfação que apresento o culminar de meses de trabalho!

Durante este semestre, desenvolvi em conjunto com o Nuno Americano o **MotoGuard IoT**, um sistema distribuído de Internet das Coisas para monitorização inteligente de motociclos.

**O que faz este sistema?**

✅ Telemetria em tempo real (velocidade, RPM, temperatura, inclinação, forças G, GPS...)
✅ Dashboard interativo com gauges e mapas em tempo real
✅ Simulador Python realista com 8 perfis de motociclos
✅ Deteção de anomalias via Machine Learning (Isolation Forest)
✅ Classificação automática de viagens (Commute, Weekend Ride, Track Day, Off-road)
✅ Controlo remoto do simulador via interface web
✅ Análise pós-viagem com scores de segurança

**Stack tecnológico:**

🐍 Python 3.12 (simulador + ML)
🟢 Node.js 20 + Express + TypeScript (backend)
⚛️ React 19 + Vite + Tailwind CSS (frontend)
🐘 PostgreSQL + 📈 InfluxDB
📡 MQTT + Socket.IO
🐳 Docker + Docker Compose

Um projeto que exigiu integração de várias áreas do conhecimento: desenvolvimento web, sistemas distribuídos, bases de dados e inteligência artificial.

Obrigado ao Nuno Americano pela excelente parceria! 🎉
Obrigado aos orientadores Cristiano Pendão e Arsénio Reis pela orientação!

🔗 Código disponível: github.com/pedromfs/Moto-Guard-IoT

#UTAD #Licenciatura #IoT #MachineLearning #React #NodeJS #Python #MQTT #WebDevelopment #FullStack