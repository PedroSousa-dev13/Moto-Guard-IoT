// Feature: gpx-upload-ui, Property 4: Route Conversion Consistency
// Validates: Requirements 3.1, 3.2, 3.3, 3.5
// Feature: gpx-upload-ui, Property 5: Minimum Waypoint Validation
// Validates: Requirements 3.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { convertGpxToSimulatorRoute, type GpxWaypoint } from '../gpxRouteConverter';

const waypointArb = fc.record({
  latitude: fc.float({ min: -90, max: 90, noNaN: true }),
  longitude: fc.float({ min: -180, max: 180, noNaN: true }),
});

describe('Property 4: Route Conversion Consistency', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
   *
   * For any array of 2+ waypoints:
   * - result.success is true
   * - simulatorRoute.start equals first waypoint (lat/lng only)
   * - simulatorRoute.end equals last waypoint (lat/lng only)
   * - loop is always false
   */
  it('converts any 2+ waypoints to a valid simulator route with correct start, end, and loop=false', () => {
    fc.assert(
      fc.property(
        fc.array(waypointArb, { minLength: 2 }),
        (waypoints: GpxWaypoint[]) => {
          const result = convertGpxToSimulatorRoute(waypoints);

          expect(result.success).toBe(true);
          if (!result.success) return;

          const { simulatorRoute } = result;
          const first = waypoints[0];
          const last = waypoints[waypoints.length - 1];

          expect(simulatorRoute.start).toEqual({ latitude: first.latitude, longitude: first.longitude });
          expect(simulatorRoute.end).toEqual({ latitude: last.latitude, longitude: last.longitude });
          expect(simulatorRoute.loop).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * For any array with fewer than 2 waypoints (0 or 1):
   * - result.success is false
   * - error message mentions "at least 2 waypoints"
   */
  it('rejects any input with fewer than 2 waypoints with an appropriate error', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant([] as GpxWaypoint[]),
          fc.array(waypointArb, { minLength: 1, maxLength: 1 })
        ),
        (waypoints: GpxWaypoint[]) => {
          const result = convertGpxToSimulatorRoute(waypoints);

          expect(result.success).toBe(false);
          if (result.success) return;

          expect(result.error).toMatch(/at least 2 waypoints/i);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 5: Minimum Waypoint Validation', () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * For any GPX waypoints array with length 0 or 1,
   * convertGpxToSimulatorRoute returns success=false with an error message.
   */
  it('returns error for any array with 0 waypoints', () => {
    fc.assert(
      fc.property(
        fc.constant([] as GpxWaypoint[]),
        (waypoints: GpxWaypoint[]) => {
          const result = convertGpxToSimulatorRoute(waypoints);
          expect(result.success).toBe(false);
          if (result.success) return;
          expect(result.error).toBeTruthy();
          expect(result.error).toMatch(/at least 2 waypoints/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns error for any array with exactly 1 waypoint', () => {
    fc.assert(
      fc.property(
        fc.array(waypointArb, { minLength: 1, maxLength: 1 }),
        (waypoints: GpxWaypoint[]) => {
          const result = convertGpxToSimulatorRoute(waypoints);
          expect(result.success).toBe(false);
          if (result.success) return;
          expect(result.error).toBeTruthy();
          expect(result.error).toMatch(/at least 2 waypoints/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Boundary condition: exactly 2 waypoints should succeed.
   */
  it('succeeds for exactly 2 waypoints (boundary condition)', () => {
    fc.assert(
      fc.property(
        fc.array(waypointArb, { minLength: 2, maxLength: 2 }),
        (waypoints: GpxWaypoint[]) => {
          const result = convertGpxToSimulatorRoute(waypoints);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
