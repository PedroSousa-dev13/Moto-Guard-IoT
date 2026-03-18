# MotoGuard IoT — Gerador de Telemetria

## Contexto e Objetivo
Este script é um **gerador de dados de telemetria** para motociclos.
Foca-se **exclusivamente na geração de dados simulados**, sendo dependente de uma **app principal** (separada) que:
1. Permite ao utilizador selecionar o modelo de mota
2. Envia o modelo escolhido via MQTT para este gerador
3. Recebe e visualiza os dados de telemetria em tempo real

## Arquitectura

```
┌─────────────────────┐    MQTT: motoguard/comando     ┌──────────────────────┐
│   APP PRINCIPAL     │  ──────────────────────────►    │  GERADOR (este)      │
│   (UI futura)       │    {"acao":"definir_modelo",    │                      │
│                     │     "modelo":"Naked"}           │  · Recebe modelo ID  │
│  · Selecciona mota  │                                 │  · Carrega perfil    │
│  · Mostra dados RT  │    MQTT: motoguard/telemetria   │  · Gera dados 1/s   │
│  · Visualização     │  ◄──────────────────────────    │  · Publica telemetria│
└─────────────────────┘    { payload completo... }      └──────────────────────┘
```

## Stack Tecnológica
| Componente | Tecnologia |
|---|---|
| Linguagem | Python 3.10+ |
| Comunicação | `paho-mqtt` |
| Lógica | `math`, `random`, `time`, `json` |

## Estrutura do Projeto
```
Moto-Guard-IoT/
├── config.py               # Configurações MQTT, detecção queda, perfis de modelos
├── headless_simulator.py   # Gerador de telemetria headless (sem GUI)
├── diversos_modelos.txt    # Documentação dos 8 perfis suportados
├── requirements.txt        # Dependências Python
├── README.md               # Este ficheiro
└── .gitignore
```

## Como Funciona

### 1. Arranque automático
Ao executar, o gerador:
- Liga-se automaticamente ao broker MQTT
- Subscreve o tópico `motoguard/comando`
- Fica à espera de um comando com o modelo de mota

### 2. Recepção de modelo
Quando a app principal envia `{"acao": "definir_modelo", "modelo": "Naked"}`:
- Carrega o perfil correspondente (limites, thresholds)
- Inicia a geração automática de dados (1 tick/segundo)
- Publica telemetria em `motoguard/telemetria`

### 3. Geração em tempo real
A cada segundo:
1. Calcula alvos de condução natural (velocidade, curvas, pitch)
2. Interpola suavemente o estado via `lerp()` (inércia física)
3. Aplica ruído de sensor (realismo)
4. Aplica efeitos de eventos activos (queda, falha alternador, etc.)
5. Publica payload JSON via MQTT

## Comandos MQTT (tópico: `motoguard/comando`)

| Comando | JSON | Descrição |
|---|---|---|
| Definir modelo | `{"acao": "definir_modelo", "modelo": "Naked"}` | Carrega perfil e inicia geração |
| Evento queda | `{"acao": "evento", "tipo": "queda"}` | Simula queda da mota |
| Evento alternador | `{"acao": "evento", "tipo": "alternador"}` | Simula falha do alternador |
| Evento sobreaquecimento | `{"acao": "evento", "tipo": "sobreaquecimento"}` | Simula sobreaquecimento |
| Reset eventos | `{"acao": "reset_eventos"}` | Limpa todos os eventos activos e retoma geração pós-queda |
| Arrancar | `{"acao": "arrancar"}` | Retoma geração após queda confirmada, sem alterar o modelo |
| Parar | `{"acao": "parar"}` | Para a geração de dados |

## Modo de Execução
O gerador corre em modo **headless** (sem interface gráfica), ideal para Docker e execução contínua.

> A visualização dos dados é feita na **app principal**.

## Detecção de Queda (por modelo)
Cada modelo tem thresholds específicos:

| Modelo | Roll | G-Force | Confirmação | Justificação |
|---|---|---|---|---|
| Scooter | ≥55° | ≥2.0G | 2s | Centro de gravidade alto, rodas pequenas |
| Naked | ≥70° | ≥2.5G | 2s | Posição semi-ereta |
| Desportiva | ≥85° | ≥3.0G | 2s | Feita para inclinar muito |
| Trail / Adventure | ≥65° | ≥2.0G | 3s | Off-road — inclinações breves normais |
| Custom / Cruiser | ≥50° | ≥1.8G | 2s | Pesada + baixa — tomba cedo |
| Motocross / Enduro | ≥75° | ≥3.5G | 3s | Saltos causam G alto normal |
| Touring | ≥45° | ≥1.5G | 2s | 350 kg — pouco G já é acidente |
| Supermotard | ≥80° | ≥3.0G | 2s | Condução agressiva é normal |

## Modelos Suportados

| Modelo | Vel. Máx | RPM Máx | Temp. Motor | Roll Típico | Peso |
|---|---|---|---|---|---|
| Scooter | 120 km/h | 9 000 | 60-90°C | 25° | 130 kg |
| Naked | 200 km/h | 12 000 | 70-105°C | 40° | 190 kg |
| Desportiva | 299 km/h | 15 000 | 80-110°C | 55° | 200 kg |
| Trail / Adventure | 200 km/h | 10 000 | 70-100°C | 35° | 230 kg |
| Custom / Cruiser | 180 km/h | 7 000 | 65-95°C | 30° | 300 kg |
| Motocross / Enduro | 130 km/h | 13 000 | 80-115°C | 40° | 110 kg |
| Touring | 220 km/h | 8 000 | 60-95°C | 30° | 350 kg |
| Supermotard | 160 km/h | 11 000 | 75-110°C | 50° | 150 kg |

## Payload (Data Contract)
Publicado a cada 1 segundo via MQTT no tópico `motoguard/telemetria`:

```json
{
  "device_id": "MOTOGUARD-SIM-01",
  "timestamp": "2026-02-23T19:05:00Z",
  "modelo": "Naked",
  "telemetry": {
    "speed_kmh": 85.3,
    "rpm": 4200,
    "engine_temp_c": 82.3,
    "imu": {
      "roll": 15.4,
      "pitch": -2.1,
      "accel_x": 0.05,
      "accel_y": 0.98,
      "accel_z": 1.02,
      "g_force": 0.0
    }
  },
  "location": {
    "lat": 41.2951,
    "lng": -7.7463
  },
  "system": {
    "status": "normal",
    "battery_voltage": 14.2
  },
  "limites_modelo": {
    "velocidade_max": 200,
    "rpm_max": 12000,
    "temp_max": 105,
    "roll_tipico_max": 40
  }
}
```

## Como Executar
```bash
pip install -r requirements.txt
python headless_simulator.py
```

O gerador liga-se automaticamente ao broker MQTT e fica à escuta.
Para iniciar a geração, enviar o comando de modelo a partir da app principal (ou de qualquer cliente MQTT).

### Teste rápido com mosquitto_pub
```bash
mosquitto_pub -h broker.hivemq.com -t motoguard/comando -m '{"acao":"definir_modelo","modelo":"Naked"}'
```
