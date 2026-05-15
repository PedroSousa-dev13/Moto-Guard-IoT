import type { TelemetryPayload } from "../models/telemetry.model";
import { EventSeverity, EventType } from "../generated/prisma/enums";

// ─── Constantes de Detecção de Eventos ───────────────────────────────────────
// Estes valores definem os limiares e cooldowns para deteção de eventos.
// São calibrados para evitar falsos positivos a 10Hz (1 tick = 100ms).

// Cooldowns (ms) entre emissões do mesmo tipo de evento
const COOLDOWN_HARD_BRAKING = 6500;       // ~6.5s — evita spam em travagens consecutivas
const COOLDOWN_RAPID_ACCEL = 6500;        // ~6.5s
const COOLDOWN_EXCESSIVE_LEAN = 9000;     // ~9s — curvas consecutivas
const COOLDOWN_HIGH_VIBRATION = 8000;     // ~8s
const COOLDOWN_OVERHEAT = 12000;          // ~12s — sobreaquecimento persistente
const COOLDOWN_LOW_VOLTAGE = 12000;       // ~12s
const COOLDOWN_OIL_PRESSURE = 15000;      // ~15s
const COOLDOWN_TIRE_PRESSURE = 20000;     // ~20s
const COOLDOWN_TEMP_TREND = 25000;        // ~25s — tendência de temperatura
const COOLDOWN_VOLT_TREND = 25000;        // ~25s — tendência de voltagem
const COOLDOWN_TIRE_TREND = 30000;        // ~30s — tendência de pressão
const COOLDOWN_OVERREV = 10000;           // ~10s
const COOLDOWN_WHEELIE_STOPPIE = 8000;    // ~8s
const COOLDOWN_SAFETY_SYSTEM = 5000;      // ~5s
const COOLDOWN_SPEEDING = 8000;           // ~8s

// Duração de confirmação (ticks a 10Hz)
const TICKS_OVERHEAT_WARN = 30;           // 3s de temp acima do limiar → warning
const TICKS_OVERHEAT_CRIT = 80;           // 8s de temp acima do limiar → critical
const TICKS_VOLTAGE_WARN = 30;            // 3s de voltagem baixa → warning
const TICKS_VOLTAGE_CRIT = 80;            // 8s de voltagem baixa → critical
const TICKS_OVERREV_WARN = 15;            // 1.5s acima do redline → warning
const TICKS_SPEEDING = 30;                // 3s acima do limite → warning

// Limiares de G-force para classificação de eventos
const G_BRAKE_WARN = 0.35;                // Travagem brusca mínima
const G_BRAKE_WARNING = 0.55;             // Travagem severa
const G_BRAKE_CRITICAL = 0.75;            // Travagem perigosa
const G_ACCEL_WARN = 0.30;                // Aceleração brusca mínima
const G_ACCEL_WARNING = 0.50;             // Aceleração severa
const G_ACCEL_CRITICAL = 0.70;            // Aceleração perigosa
const G_VIBRATION_MIN = 1.9;              // G mínimo para vibração anómala
const G_VIBRATION_WARNING = 2.3;          // Vibração severa
const G_VIBRATION_CRITICAL = 3.0;         // Vibração perigosa

// Velocidades mínimas para deteção de eventos (km/h)
const SPEED_BRAKE_MIN = 15;               // Travagem brusca só acima de 15 km/h
const SPEED_ACCEL_MIN = 10;               // Aceleração brusca só acima de 10 km/h
const SPEED_LEAN_MIN = 25;                // Inclinação excessiva só acima de 25 km/h
const SPEED_VIBRATION_MIN = 8;            // Vibração só acima de 8 km/h
const SPEED_OIL_MIN = 25;                 // Pressão de óleo só acima de 25 km/h
const SPEED_WHEELIE_MIN = 10;             // Wheelie/stoppie só acima de 10 km/h

// Limiares de pressão de pneus (bar)
const TIRE_PRESSURE_WARN = 1.3;           // Aviso abaixo de 1.3 bar
const TIRE_PRESSURE_CRITICAL = 1.05;      // Crítico abaixo de 1.05 bar

// Limiares de pressão de óleo (bar)
const OIL_PRESSURE_WARN = 0.9;            // Aviso abaixo de 0.9 bar
const OIL_PRESSURE_CRITICAL = 0.6;        // Crítico abaixo de 0.6 bar

// Limiares de pitch (graus) para wheelie/stoppie
const PITCH_WHEELIE_WARN = 15;            // Wheelie detetado acima de 15°
const PITCH_WHEELIE_CRITICAL = 25;        // Wheelie perigoso acima de 25°
const PITCH_STOPPIE_WARN = -15;           // Stoppie detetado abaixo de -15°
const PITCH_STOPPIE_CRITICAL = -25;       // Stoppie perigoso abaixo de -25°

// Tendências de temperatura/voltagem/pneus
const TEMP_TREND_SLOPE_MIN = 0.02;        // °C/s — tendência de aquecimento
const VOLT_TREND_SLOPE_MIN = -0.01;       // V/s — tendência de queda de voltagem
const TIRE_TREND_SLOPE_MIN = -0.0003;     // bar/s — perda lenta de pressão
const TREND_TIME_TO_CRITICAL_SEC = 900;   // 15 min — tempo máx até limiar crítico

// Janelas de dados para análise de tendências (número de pontos a 10Hz)
const WINDOW_GFORCE = 120;                // ~12s de G-force
const WINDOW_TEMP = 180;                  // ~18s de temperatura
const WINDOW_VOLTAGE = 180;               // ~18s de voltagem
const WINDOW_TIRE = 300;                  // ~30s de pressão de pneus

// Fatores de inclinação para classificação de eventos
const LEAN_WARN_FACTOR = 1.1;             // 110% do típico → warning
const LEAN_CRITICAL_FACTOR = 1.35;        // 135% do típico → critical
const LEAN_CRITICAL_MIN_FACTOR = 0.9;     // 90% do crash threshold → critical

// Fatores de excesso de velocidade
const SPEEDING_EXCESS_FACTOR = 1.10;      // 10% acima do limite → deteção
const SPEEDING_CRITICAL_FACTOR = 1.25;    // 25% acima do limite → critical

export interface MotorcycleProfileThresholds {
  maxSpeedKmh: number;
  typicalMaxRollDeg: number;
  crashRollThreshold: number;
  crashGForce: number;
  criticalTemp: number;
  criticalVoltage: number;
  criticalRpm: number;
}

export interface HeuristicState {
  prevPayload: TelemetryPayload | null;
  gForceWindow: number[];
  overheatTicks: number;
  overrevTicks: number;
  lowVoltageTicks: number;
  speedingTicks: number;
  lastEventAtByType: Partial<Record<EventType, number>>;
  temps: number[];
  volts: number[];
  tiresFront: number[];
  tiresRear: number[];
}

export interface DetectedRiskEvent {
  type: EventType;
  severity: EventSeverity;
  message: string;
}

export interface RiskEvaluation {
  events: DetectedRiskEvent[];
}

export function createInitialHeuristicState(): HeuristicState {
  return {
    prevPayload: null,
    gForceWindow: [],
    overheatTicks: 0,
    overrevTicks: 0,
    lowVoltageTicks: 0,
    speedingTicks: 0,
    lastEventAtByType: {},
    temps: [],
    volts: [],
    tiresFront: [],
    tiresRear: [],
  };
}

function pushLimited(arr: number[], value: number, limit: number): void {
  arr.push(value);
  if (arr.length > limit) arr.splice(0, arr.length - limit);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function slopePerSecond(values: number[], dtSec: number): number {
  if (values.length < 2) return 0;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  return (last - first) / ((values.length - 1) * dtSec);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function evaluateTelemetryRisk(
  payload: TelemetryPayload,
  state: HeuristicState,
  profile: MotorcycleProfileThresholds,
  nowMs: number,
  dtSec: number,
): RiskEvaluation {
  const events: DetectedRiskEvent[] = [];

  const speed = payload.telemetry.speed_kmh ?? 0;
  const rpm = payload.telemetry.rpm ?? 0;
  const throttle = payload.telemetry.throttle_pct ?? 0;
  const brakeFront = payload.telemetry.brake_front_pct ?? 0;
  const brakeRear = payload.telemetry.brake_rear_pct ?? 0;
  const temp = payload.telemetry.engine_temp_c ?? 0;
  const volt = payload.telemetry.voltage ?? 0;

  const roll = payload.imu.roll_deg ?? 0;
  const gForce = payload.imu.accel_g ?? (payload.imu.g_force ?? 0);
  const pitch = payload.imu.pitch_deg ?? 0;

  const absActive = payload.active_safety?.abs_active ?? false;
  const tcActive = payload.active_safety?.tc_active ?? false;

  const oil = payload.health.oil_pressure_bar ?? 0;
  const tireFront = payload.health.tire_pressure_front_bar ?? 0;
  const tireRear = payload.health.tire_pressure_rear_bar ?? 0;

  const prevSpeed = state.prevPayload?.telemetry?.speed_kmh ?? speed;
  const accelMs2 = ((speed - prevSpeed) / 3.6) / Math.max(dtSec, 0.001);
  const accelG = accelMs2 / 9.81;

  pushLimited(state.gForceWindow, gForce, WINDOW_GFORCE);
  pushLimited(state.temps, temp, WINDOW_TEMP);
  pushLimited(state.volts, volt, WINDOW_VOLTAGE);
  pushLimited(state.tiresFront, tireFront, WINDOW_TIRE);
  pushLimited(state.tiresRear, tireRear, WINDOW_TIRE);

  const gAvg = mean(state.gForceWindow);
  const rollAbs = Math.abs(roll);

  const shouldEmit = (type: EventType, cooldownMs: number) => {
    const last = state.lastEventAtByType[type] ?? 0;
    if (nowMs - last < cooldownMs) return false;
    state.lastEventAtByType[type] = nowMs;
    return true;
  };

  if (
    speed > SPEED_BRAKE_MIN &&
    (brakeFront > 60 || brakeRear > 50) &&
    accelG < -G_BRAKE_WARN &&
    shouldEmit(EventType.HARD_BRAKING, COOLDOWN_HARD_BRAKING)
  ) {
    const severity =
      accelG < -G_BRAKE_CRITICAL ? EventSeverity.CRITICAL : accelG < -G_BRAKE_WARNING ? EventSeverity.WARNING : EventSeverity.INFO;
    events.push({
      type: EventType.HARD_BRAKING,
      severity,
      message: `Travagem brusca (≈${Math.abs(accelG).toFixed(2)}G)`,
    });
  }

  if (
    speed > SPEED_ACCEL_MIN &&
    throttle > 70 &&
    accelG > G_ACCEL_WARN &&
    speed < profile.maxSpeedKmh * 1.05 &&
    shouldEmit(EventType.RAPID_ACCELERATION, COOLDOWN_RAPID_ACCEL)
  ) {
    const severity =
      accelG > G_ACCEL_CRITICAL ? EventSeverity.CRITICAL : accelG > G_ACCEL_WARNING ? EventSeverity.WARNING : EventSeverity.INFO;
    events.push({
      type: EventType.RAPID_ACCELERATION,
      severity,
      message: `Aceleração brusca (≈${Math.abs(accelG).toFixed(2)}G)`,
    });
  }

  const leanWarn = profile.typicalMaxRollDeg * LEAN_WARN_FACTOR;
  const leanCritical = Math.max(profile.crashRollThreshold * LEAN_CRITICAL_MIN_FACTOR, profile.typicalMaxRollDeg * LEAN_CRITICAL_FACTOR);
  if (speed > SPEED_LEAN_MIN && rollAbs > leanWarn && shouldEmit(EventType.EXCESSIVE_LEAN, COOLDOWN_EXCESSIVE_LEAN)) {
    const severity = rollAbs > leanCritical ? EventSeverity.CRITICAL : EventSeverity.WARNING;
    events.push({
      type: EventType.EXCESSIVE_LEAN,
      severity,
      message: `Inclinação elevada (${rollAbs.toFixed(1)}°)`,
    });
  }

  if (gForce > Math.max(G_VIBRATION_MIN, gAvg + 0.65) && speed > SPEED_VIBRATION_MIN && rollAbs < 20 && shouldEmit(EventType.HIGH_VIBRATION, COOLDOWN_HIGH_VIBRATION)) {
    const severity = gForce > G_VIBRATION_CRITICAL ? EventSeverity.CRITICAL : gForce > G_VIBRATION_WARNING ? EventSeverity.WARNING : EventSeverity.INFO;
    events.push({
      type: EventType.HIGH_VIBRATION,
      severity,
      message: `Vibração anómala (G=${gForce.toFixed(2)})`,
    });
  }

  if (temp >= profile.criticalTemp) state.overheatTicks += 1;
  else state.overheatTicks = 0;

  if (state.overheatTicks === TICKS_OVERHEAT_WARN && shouldEmit(EventType.OVERHEAT, COOLDOWN_OVERHEAT)) {
    events.push({
      type: EventType.OVERHEAT,
      severity: EventSeverity.WARNING,
      message: `Temperatura acima do limiar (${temp.toFixed(1)}°C)`,
    });
  }

  if (state.overheatTicks >= TICKS_OVERHEAT_CRIT && shouldEmit(EventType.OVERHEAT, COOLDOWN_OVERHEAT)) {
    events.push({
      type: EventType.OVERHEAT,
      severity: EventSeverity.CRITICAL,
      message: `Sobreaquecimento persistente (${temp.toFixed(1)}°C)`,
    });
  }

  if (volt <= profile.criticalVoltage) state.lowVoltageTicks += 1;
  else state.lowVoltageTicks = 0;

  if (state.lowVoltageTicks === TICKS_VOLTAGE_WARN && shouldEmit(EventType.LOW_VOLTAGE, COOLDOWN_LOW_VOLTAGE)) {
    events.push({
      type: EventType.LOW_VOLTAGE,
      severity: EventSeverity.WARNING,
      message: `Voltagem baixa (${volt.toFixed(1)}V)`,
    });
  }

  if (state.lowVoltageTicks >= TICKS_VOLTAGE_CRIT && shouldEmit(EventType.LOW_VOLTAGE, COOLDOWN_LOW_VOLTAGE)) {
    events.push({
      type: EventType.LOW_VOLTAGE,
      severity: EventSeverity.CRITICAL,
      message: `Falha de carregamento provável (${volt.toFixed(1)}V)`,
    });
  }

  if (oil > 0 && speed > SPEED_OIL_MIN && oil < OIL_PRESSURE_WARN && shouldEmit(EventType.OIL_PRESSURE_LOW, COOLDOWN_OIL_PRESSURE)) {
    const severity = oil < OIL_PRESSURE_CRITICAL ? EventSeverity.CRITICAL : EventSeverity.WARNING;
    events.push({
      type: EventType.OIL_PRESSURE_LOW,
      severity,
      message: `Pressão de óleo baixa (${oil.toFixed(1)} bar)`,
    });
  }

  if (
    (tireFront > 0 && tireFront < TIRE_PRESSURE_WARN) ||
    (tireRear > 0 && tireRear < TIRE_PRESSURE_WARN)
  ) {
    if (shouldEmit(EventType.TIRE_PRESSURE_LOW, COOLDOWN_TIRE_PRESSURE)) {
      const minTire = Math.min(tireFront || 99, tireRear || 99);
      const severity = minTire < TIRE_PRESSURE_CRITICAL ? EventSeverity.CRITICAL : EventSeverity.WARNING;
      events.push({
        type: EventType.TIRE_PRESSURE_LOW,
        severity,
        message: `Pressão de pneus baixa (F=${tireFront.toFixed(2)} / R=${tireRear.toFixed(2)} bar)`,
      });
    }
  }

  const tempSlope = slopePerSecond(state.temps, dtSec);
  if (tempSlope > TEMP_TREND_SLOPE_MIN && temp < profile.criticalTemp && shouldEmit(EventType.OVERHEAT, COOLDOWN_TEMP_TREND)) {
    const secondsToCritical = (profile.criticalTemp - temp) / Math.max(tempSlope, 0.0001);
    if (Number.isFinite(secondsToCritical) && secondsToCritical < TREND_TIME_TO_CRITICAL_SEC) {
      const minutes = clamp(secondsToCritical / 60, 1, 999);
      events.push({
        type: EventType.OVERHEAT,
        severity: EventSeverity.INFO,
        message: `Tendência de temperatura: possível limiar em ~${Math.round(minutes)} min`,
      });
    }
  }

  const voltSlope = slopePerSecond(state.volts, dtSec);
  if (voltSlope < VOLT_TREND_SLOPE_MIN && volt > profile.criticalVoltage && shouldEmit(EventType.LOW_VOLTAGE, COOLDOWN_VOLT_TREND)) {
    const secondsToCritical = (profile.criticalVoltage - volt) / Math.max(voltSlope, -0.0001);
    if (Number.isFinite(secondsToCritical) && secondsToCritical < TREND_TIME_TO_CRITICAL_SEC) {
      const minutes = clamp(secondsToCritical / 60, 1, 999);
      events.push({
        type: EventType.LOW_VOLTAGE,
        severity: EventSeverity.INFO,
        message: `Tendência de voltagem: possível limiar em ~${Math.round(minutes)} min`,
      });
    }
  }

  const frontSlope = slopePerSecond(state.tiresFront, dtSec);
  const rearSlope = slopePerSecond(state.tiresRear, dtSec);
  if ((frontSlope < TIRE_TREND_SLOPE_MIN || rearSlope < TIRE_TREND_SLOPE_MIN) && shouldEmit(EventType.TIRE_PRESSURE_LOW, COOLDOWN_TIRE_TREND)) {
    events.push({
      type: EventType.TIRE_PRESSURE_LOW,
      severity: EventSeverity.INFO,
      message: "Tendência de pressão: possível perda lenta",
    });
  }

  // ── Rotações Excessivas (Overrev) ──────────────────────────────────────
  if (rpm >= profile.criticalRpm) state.overrevTicks += 1;
  else state.overrevTicks = 0;

  if (state.overrevTicks >= TICKS_OVERREV_WARN && shouldEmit(EventType.ENGINE_OVERREV, COOLDOWN_OVERREV)) {
    events.push({
      type: EventType.ENGINE_OVERREV,
      severity: EventSeverity.WARNING,
      message: `Rotações excessivas: ${rpm} RPM (Redline: ${profile.criticalRpm})`,
    });
  }

  // ── Manobras de Pitch (Wheelie / Stoppie) ──────────────────────────────
  if (speed > SPEED_WHEELIE_MIN) {
    if (pitch > PITCH_WHEELIE_WARN && shouldEmit(EventType.WHEELIE_DETECTED, COOLDOWN_WHEELIE_STOPPIE)) {
      events.push({
        type: EventType.WHEELIE_DETECTED,
        severity: pitch > PITCH_WHEELIE_CRITICAL ? EventSeverity.CRITICAL : EventSeverity.WARNING,
        message: `Roda frontal levantada (Wheelie: ${pitch.toFixed(1)}°)`,
      });
    } else if (pitch < PITCH_STOPPIE_WARN && shouldEmit(EventType.STOPPIE_DETECTED, COOLDOWN_WHEELIE_STOPPIE)) {
      events.push({
        type: EventType.STOPPIE_DETECTED,
        severity: pitch < PITCH_STOPPIE_CRITICAL ? EventSeverity.CRITICAL : EventSeverity.WARNING,
        message: `Roda traseira levantada (Stoppie: ${pitch.toFixed(1)}°)`,
      });
    }
  }

  // ── Sistemas de Segurança Ativos (ABS / TC) ────────────────────────────
  if ((absActive || tcActive) && shouldEmit(EventType.SAFETY_SYSTEM_ACTIVE, COOLDOWN_SAFETY_SYSTEM)) {
    const system = absActive && tcActive ? "ABS & TC" : absActive ? "ABS" : "TC";
    events.push({
      type: EventType.SAFETY_SYSTEM_ACTIVE,
      severity: EventSeverity.INFO,
      message: `Sistema de segurança ativo (${system})`,
    });
  }

  // ── Excesso de velocidade ──────────────────────────────────────────────
  const legalLimit = payload.system?.speed_limit_kmh ?? 0;
  if (legalLimit > 0 && speed > 0) {
    if (speed > legalLimit * SPEEDING_EXCESS_FACTOR) {
      state.speedingTicks += 1;
    } else {
      state.speedingTicks = 0;
    }

    if (state.speedingTicks >= TICKS_SPEEDING) {
      const excess = speed - legalLimit;
      const isCritical = speed > legalLimit * SPEEDING_CRITICAL_FACTOR;
      if (shouldEmit(EventType.SPEEDING, COOLDOWN_SPEEDING)) {
        events.push({
          type: EventType.SPEEDING,
          severity: isCritical ? EventSeverity.CRITICAL : EventSeverity.WARNING,
          message: `Excesso de velocidade: ${speed.toFixed(0)} km/h (limite: ${legalLimit} km/h, +${excess.toFixed(0)} km/h)`,
        });
      }
    }
  } else {
    state.speedingTicks = 0;
  }

  state.prevPayload = payload;

  return { events };
}

