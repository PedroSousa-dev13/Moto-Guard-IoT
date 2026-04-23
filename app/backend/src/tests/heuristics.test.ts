import { describe, it, expect, beforeEach } from 'vitest';
import { 
  evaluateTelemetryRisk, 
  createInitialHeuristicState, 
  MotorcycleProfileThresholds 
} from '../services/heuristics.service';
import { EventType, EventSeverity } from '../generated/prisma/enums';

describe('Heuristics Engine (10Hz)', () => {
  const profile: MotorcycleProfileThresholds = {
    maxSpeedKmh: 200,
    typicalMaxRollDeg: 45,
    crashRollThreshold: 60,
    crashGForce: 2.5,
    criticalTemp: 105,
    criticalVoltage: 11.8
  };

  const dtSec = 0.1; // 10Hz

  it('deve detetar uma travagem brusca', () => {
    const state = createInitialHeuristicState();
    const now = Date.now();
    
    // Payload 1: 100 km/h
    const p1 = createMockPayload(100, 0, 0, 0);
    evaluateTelemetryRisk(p1, state, profile, now, dtSec);

    // Payload 2: 70 km/h (desaceleração massiva em 0.1s)
    const p2 = createMockPayload(70, 0, 80, 0); // Travão frente 80%
    const result = evaluateTelemetryRisk(p2, state, profile, now + 100, dtSec);

    const event = result.events.find(e => e.type === EventType.HARD_BRAKING);
    expect(event).toBeDefined();
    expect(event?.severity).toBe(EventSeverity.CRITICAL);
  });

  it('deve esperar 30 ticks (3s) para alerta de sobreaquecimento', () => {
    const state = createInitialHeuristicState();
    let now = Date.now();
    let result;

    // Simular 29 ticks de calor
    for (let i = 0; i < 29; i++) {
      const p = createMockPayload(50, 110, 0, 0); // 110°C (critico)
      result = evaluateTelemetryRisk(p, state, profile, now, dtSec);
      now += 100;
      expect(result.events.length).toBe(0); // Ainda não deve haver evento
    }

    // Tick 30
    const p30 = createMockPayload(50, 110, 0, 0);
    result = evaluateTelemetryRisk(p30, state, profile, now, dtSec);
    const event = result.events.find(e => e.type === EventType.OVERHEAT);
    expect(event).toBeDefined();
    expect(event?.severity).toBe(EventSeverity.WARNING);
  });
});

function createMockPayload(speed: number, temp: number, brakeFront: number, roll: number): any {
  return {
    telemetry: {
      speed_kmh: speed,
      engine_temp_c: temp,
      brake_front_pct: brakeFront,
      rpm: 3000,
      voltage: 14.0
    },
    imu: {
      roll_deg: roll,
      g_force: 1.0
    },
    health: {},
    system: { device_id: 'test' },
    location: { latitude: 0, longitude: 0 }
  };
}
