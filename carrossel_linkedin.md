# 🏍️ MotoGuard IoT - Projeto de Licenciatura Concluído!

---

## 🟢 Slide 1 - Capa

**MotoGuard IoT**
Sistema de Monitorização Inteligente para Motociclos

✅ Projeto de Licenciatura | UTAD 2025/2026

Desenvolvido por Pedro Sousa & Nuno Americano

---

## 🟢 Slide 2 - O que é?

**Um sistema IoT completo para monitorizar o teu motociclo em tempo real!**

🔹 Telemetria em direto (velocidade, RPM, temperatura, inclinação...)
🔹 Deteção de anomalias via Machine Learning
🔹 Análise pós-viagem com scoring de segurança
🔹 Simuladores realistas para testes

---

## 🟢 Slide 3 - Stack Tecnológico

**Tudo o que usamos:**

🏗️ **Backend:** Node.js 20 + Express + TypeScript

🎨 **Frontend:** React 19 + Vite + Tailwind CSS

🐍 **Simulador:** Python 3.12 + Paho-MQTT

🧠 **ML:** Scikit-learn (Isolation Forest, K-Means)

🗄️ **Dados:** PostgreSQL + InfluxDB

📡 **Comunicação:** MQTT + Socket.IO

🐳 **Deploy:** Docker + Docker Compose

---

## 🟢 Slide 4 - Arquitetura

**Arquitetura de Microsserviços**

```
Frontend (React) ←→ Backend (Node.js) ←→ Simulador (Python)
                        ↓
                   MQTT Broker (Mosquitto)
                        ↓
              PostgreSQL + InfluxDB
```

🔹 Comunicação em tempo real via Socket.IO
🔹 Telemetria via MQTT com <100ms latência
🔹 Dados persistidos em BD relacional + séries temporais

---

## 🟢 Slide 5 - Funcionalidades

**O que o sistema faz:**

✅ Dashboard em tempo real com gauges e mapa
✅ Controlo remoto do simulador via web
✅ 8 perfis de motociclos (Scooter, Naked, Sport, Trail...)
✅ Deteção de eventos (quedas, travagens bruscas, sobreaquecimento)
✅ Classificação de viagens (Commute, Weekend Ride, Track Day, Off-road)
✅ Importação/Exportação de ficheiros GPX

---

## 🟢 Slide 6 - Machine Learning

**Inteligência Artificial aplicada:**

🤖 Isolation Forest para deteção de anomalias
📊 24 features extraídas da telemetria
🎯 Scoring de 0-1 para cada viagem
🔄 Modelo Z-score para deteção em tempo real
 clustering K-Means para estilo de condução (Aggressive/Defensive/Economy)

---

## 🟢 Slide 7 - Interface

**Dashboard moderno e responsivo:**

📱 Design mobile-first
🌍 Internacionalização PT/EN
🗺️ Mapas interativos (Leaflet/OpenStreetMap)
📈 Gráficos de análise (Recharts)
🎮 Simulador GPX e dados reais (IRL)
🔔 Sistema de notificações em tempo real

---

## 🟢 Slide 8 - Simuladores

**Simulador Python realista:**

🏍️ 8 perfis de motas com física distinta
🛣️ Suporte a rotas GPX reais
⚡ Eventos simuláveis: quedas, falhas elétricas, sobreaquecimento
📡 Envio de telemetria via MQTT
🎛️ Controlo via interface web (start/stop/idle)

---

## 🟢 Slide 9 - Números

**Por detrás do projeto:**

📁 15+ serviços backend
🖥️ 17 páginas frontend
🔌 30+ endpoints API REST
🧪 Testes com threshold 80% coverage
📚 Documentação técnica completa (658 linhas!)

---

## 🟢 Slide 10 - Conclusão

**Projeto concluído com sucesso! 🎉**

Obrigado ao Nuno Americano pelo trabalho em equipa!

Obrigado aos orientadores Cristiano Pendão & Arsénio Reis!

🚀 Próximos passos: integração com hardware real (ESP32)

---

## 🟢 Slide 11 - Contacto

**Queres saber mais?**

🔗 GitHub: github.com/pedromfs/Moto-Guard-IoT

📧 Email: pedro.sousa@utad.eu

💼 LinkedIn:.linkedin.com/in/pedrosousa

---

#carrossel #linkedin #utad #iot #machinelearning #react #nodejs #python #mqtt #webdevelopment #project