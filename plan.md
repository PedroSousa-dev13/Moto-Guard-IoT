# Plan: Simulador Headless (Comportamento Ideal)

> Nota: isto descreve o comportamento ideal. Nao garante que todos os problemas atuais desaparecam sem alinhar backend, frontend e simulador.

## Objetivos
- Viagens previsiveis: inicio -> andamento -> fim.
- Integracao consistente com backend (uma viagem ativa por device_id).
- Suporte a eventos (queda, sobreaquecimento, excesso velocidade) sem corromper o ciclo da viagem.
- Controlo simples por comandos MQTT.

## Estados Propostos
- IDLE: sem viagem ativa; sem telemetria de movimento (opcional heartbeat leve).
- RUNNING: viagem ativa; publica telemetria normal.
- PAUSED: viagem suspensa (ex: queda confirmada); telemetria estatica opcional.
- ENDED: viagem terminada; publica TRIP_ENDED uma vez e volta a IDLE.

## Regras de Inicio
- Inicia viagem com start_trip (ou definir_modelo + definir_rota).
- Se nao houver rota, nao deve simular movimento.
- device_id deve ser fixo durante a viagem.

## Regras de Fim
- Fim automatico quando: rota concluida + velocidade ~0 por X s.
- Fim manual via comando parar.
- Fim por inatividade (velocidade ~0 por X s sem rota ativa).
- TRIP_ENDED deve ser publicado uma unica vez por viagem.

## Eventos e Alertas
- POSSIVEL_QUEDA: continua telemetria com desaceleracao.
- QUEDA_CONFIRMADA: pausa (PAUSED) ate reset_eventos.
- Excesso velocidade: termina quando override desligado.

## Rotas
- loop=true: viagem infinita (nao termina automaticamente).
- loop=false: termina e volta a IDLE.

## Resiliencia
- Reconexao MQTT sem perder estado da viagem.
- Se backend reiniciar, simulador nao deve duplicar viagens.

## Alinhamento Necessario
- Backend deve reconhecer estados (IDLE/RUNNING/PAUSED/ENDED).
- Frontend deve expor comandos claros (start_trip, stop_trip, reset_eventos, definir_rota).
- Simulador deve seguir o mesmo contrato de estados.

## Solucoes de Implementacao (Fixes)
1) Rota padrao com loop configuravel
	- Introduzir ROUTE_LOOP via env para permitir viagens finitas no headless.
2) Fim de viagem resiliente
	- Se a rota estiver finished por > 5s, enviar TRIP_ENDED mesmo que a velocidade nao chegue a 0.
	- TRIP_ENDED deve ser emitido uma unica vez e seguido de pausa.
3) Comando explicito de stop
	- Aceitar aliases de stop (stop_trip, trip_end) como equivalente a parar.
4) Roadmap de alinhamento
	- Backend deve conseguir enviar stop_trip quando decide terminar por inatividade.
	- Frontend deve indicar se a rota e loop (para viagens infinitas vs. finitas).
