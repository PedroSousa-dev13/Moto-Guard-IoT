// =============================================================================
// MotoGuard IoT — telemetryEmitter property-based tests
// =============================================================================
// Feature: real-simulator, Property 5: Emitted payload reflects the selected CSV row
// Validates: Requirements 4.3, 6.1, 6.2, 6.3

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { buildPayload } from '../telemetryEmitter';
import type { ParsedRow } from '../csvParser';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const parsedRowArb: fc.Arbitrary<ParsedRow> = fc.record({
  timestampSec: fc.float({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }),
  latitude: fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  longitude: fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
  speed_kmh: fc.float({ min: 0, max: 300, noNaN: true, noDefaultInfinity: true }),
  rpm: fc.float({ min: 0, max: 15000, noNaN: true, noDefaultInfinity: true }),
  gear: fc.integer({ min: 0, max: 6 }),
  throttle_pct: fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  engine_temp_c: fc.float({ min: 0, max: 300, noNaN: true, noDefaultInfinity: true }),
  voltage: fc.float({ min: 0, max: 20, noNaN: true, noDefaultInfinity: true }),
  roll_deg: fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
  pitch_deg: fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  yaw_deg: fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
  g_force: fc.float({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true }),
});

// Non-empty device ID strings
const deviceIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 64 });

// ---------------------------------------------------------------------------
// Property 5: Emitted payload reflects the selected CSV row
// Validates: Requirements 4.3, 6.1, 6.2, 6.3
// ---------------------------------------------------------------------------

describe('Property 5 — Payload structure reflects selected CSV row', () => {
  it('payload fields match the source ParsedRow and configured deviceId', () => {
    fc.assert(
      fc.property(parsedRowArb, deviceIdArb, (row, deviceId) => {
        const payload = buildPayload(row, deviceId, new Date(), 'TRIP_ACTIVE');

        // system fields
        if (payload.system.device_id !== deviceId) return false;
        if (payload.system.event_status !== 'TRIP_ACTIVE') return false;
        if (payload.system.moto_model !== 'Real Simulator') return false;

        // telemetry fields
        if (payload.telemetry.speed_kmh !== row.speed_kmh) return false;
        if (payload.telemetry.rpm !== row.rpm) return false;
        if (payload.telemetry.gear !== row.gear) return false;
        if (payload.telemetry.throttle_pct !== row.throttle_pct) return false;
        if (payload.telemetry.engine_temp_c !== row.engine_temp_c) return false;
        if (payload.telemetry.voltage !== row.voltage) return false;

        // location fields
        if (payload.location.latitude !== row.latitude) return false;
        if (payload.location.longitude !== row.longitude) return false;

        // imu fields
        if (payload.imu.roll_deg !== row.roll_deg) return false;
        if (payload.imu.pitch_deg !== row.pitch_deg) return false;
        if (payload.imu.yaw_deg !== row.yaw_deg) return false;
        if (payload.imu.g_force !== row.g_force) return false;

        return true;
      }),
      { numRuns: 100 },
    );
  });
});
