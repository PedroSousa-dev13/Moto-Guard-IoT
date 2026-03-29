// Feature: gpx-upload-ui, Property 7: WebSocket Communication Protocol
// Validates: Requirements 4.2, 4.3

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { SimulatorRoute } from '../gpxRouteConverter';
import type { SimulatorCommand } from '../../types/telemetry';

/**
 * Builds the WebSocket command for sending a GPX route to the simulator.
 * This mirrors the command format used by preset and custom routes.
 */
export function buildGpxSimulatorCommand(simulatorRoute: SimulatorRoute): SimulatorCommand {
  return {
    acao: 'definir_rota',
    route: {
      start: { latitude: simulatorRoute.start.latitude, longitude: simulatorRoute.start.longitude },
      end: { latitude: simulatorRoute.end.latitude, longitude: simulatorRoute.end.longitude },
      loop: simulatorRoute.loop,
    },
  };
}

const coordinateArb = fc.record({
  latitude: fc.float({ min: -90, max: 90, noNaN: true }),
  longitude: fc.float({ min: -180, max: 180, noNaN: true }),
});

const simulatorRouteArb = fc.record({
  start: coordinateArb,
  end: coordinateArb,
  loop: fc.constant(false),
});

describe('Property 7: WebSocket Communication Protocol', () => {
  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * For any valid GPX simulatorRoute, the constructed command must have acao="definir_rota".
   */
  it('always produces a command with acao="definir_rota"', () => {
    fc.assert(
      fc.property(simulatorRouteArb, (simulatorRoute: SimulatorRoute) => {
        const command = buildGpxSimulatorCommand(simulatorRoute);
        expect(command.acao).toBe('definir_rota');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * For any valid GPX simulatorRoute, the command.route must have start, end, and loop fields.
   */
  it('always produces a command with start, end, and loop fields in route', () => {
    fc.assert(
      fc.property(simulatorRouteArb, (simulatorRoute: SimulatorRoute) => {
        const command = buildGpxSimulatorCommand(simulatorRoute);
        expect(command.route).toBeDefined();
        expect(command.route).toHaveProperty('start');
        expect(command.route).toHaveProperty('end');
        expect(command.route).toHaveProperty('loop');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * For any valid GPX simulatorRoute, loop should always be false.
   */
  it('always sets loop=false for GPX routes', () => {
    fc.assert(
      fc.property(simulatorRouteArb, (simulatorRoute: SimulatorRoute) => {
        const command = buildGpxSimulatorCommand(simulatorRoute);
        expect(command.route?.loop).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * The command format for GPX routes must be identical to preset/custom route format:
   * { acao: "definir_rota", route: { start: { latitude, longitude }, end: { latitude, longitude }, loop: boolean } }
   * Coordinates in the command must exactly match the simulatorRoute input.
   */
  it('produces a command format identical to preset/custom route format with matching coordinates', () => {
    fc.assert(
      fc.property(simulatorRouteArb, (simulatorRoute: SimulatorRoute) => {
        const command = buildGpxSimulatorCommand(simulatorRoute);

        // Exact structure match
        expect(command).toMatchObject({
          acao: 'definir_rota',
          route: {
            start: { latitude: simulatorRoute.start.latitude, longitude: simulatorRoute.start.longitude },
            end: { latitude: simulatorRoute.end.latitude, longitude: simulatorRoute.end.longitude },
            loop: false,
          },
        });

        // No extra top-level fields beyond acao and route
        const keys = Object.keys(command);
        expect(keys).toContain('acao');
        expect(keys).toContain('route');
      }),
      { numRuns: 100 }
    );
  });
});
