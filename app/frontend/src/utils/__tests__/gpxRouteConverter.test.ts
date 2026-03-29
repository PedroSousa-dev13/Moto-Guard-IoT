import { describe, it, expect } from 'vitest';
import { convertGpxToSimulatorRoute, type GpxWaypoint } from '../gpxRouteConverter';

describe('convertGpxToSimulatorRoute', () => {
  // Requirement 3.4: fewer than 2 waypoints returns error
  it('returns error when waypoints array is empty', () => {
    const result = convertGpxToSimulatorRoute([]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/at least 2 waypoints/i);
    }
  });

  it('returns error when only 1 waypoint is provided', () => {
    const waypoints: GpxWaypoint[] = [{ latitude: 41.0, longitude: -7.0 }];
    const result = convertGpxToSimulatorRoute(waypoints);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/at least 2 waypoints/i);
    }
  });

  // Requirement 3.2: first waypoint as start
  // Requirement 3.3: last waypoint as end
  it('sets first waypoint as start and last as end for 2-waypoint route', () => {
    const waypoints: GpxWaypoint[] = [
      { latitude: 41.0, longitude: -7.0 },
      { latitude: 42.0, longitude: -8.0 },
    ];
    const result = convertGpxToSimulatorRoute(waypoints);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.simulatorRoute.start).toEqual({ latitude: 41.0, longitude: -7.0 });
      expect(result.simulatorRoute.end).toEqual({ latitude: 42.0, longitude: -8.0 });
    }
  });

  it('sets first waypoint as start and last as end for multi-waypoint route', () => {
    const waypoints: GpxWaypoint[] = [
      { latitude: 40.0, longitude: -8.0 },
      { latitude: 41.0, longitude: -7.5 },
      { latitude: 41.5, longitude: -7.0 },
      { latitude: 42.0, longitude: -6.5 },
    ];
    const result = convertGpxToSimulatorRoute(waypoints);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.simulatorRoute.start).toEqual({ latitude: 40.0, longitude: -8.0 });
      expect(result.simulatorRoute.end).toEqual({ latitude: 42.0, longitude: -6.5 });
    }
  });

  // Requirement 3.5: loop is always false for GPX imports
  it('always sets loop to false', () => {
    const waypoints: GpxWaypoint[] = [
      { latitude: 41.0, longitude: -7.0 },
      { latitude: 42.0, longitude: -8.0 },
    ];
    const result = convertGpxToSimulatorRoute(waypoints);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.simulatorRoute.loop).toBe(false);
    }
  });

  // Requirement 3.1: transforms GPX waypoints to simulator route format
  it('returns correct simulator route structure', () => {
    const waypoints: GpxWaypoint[] = [
      { latitude: 38.7, longitude: -9.1, elevation: 50 },
      { latitude: 38.8, longitude: -9.2, elevation: 60 },
    ];
    const result = convertGpxToSimulatorRoute(waypoints);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.simulatorRoute).toHaveProperty('start');
      expect(result.simulatorRoute).toHaveProperty('end');
      expect(result.simulatorRoute).toHaveProperty('loop');
      expect(result.simulatorRoute.start).toHaveProperty('latitude');
      expect(result.simulatorRoute.start).toHaveProperty('longitude');
      expect(result.simulatorRoute.end).toHaveProperty('latitude');
      expect(result.simulatorRoute.end).toHaveProperty('longitude');
    }
  });

  it('ignores elevation and time fields in the simulator route output', () => {
    const waypoints: GpxWaypoint[] = [
      { latitude: 41.0, longitude: -7.0, elevation: 500, time: new Date() },
      { latitude: 42.0, longitude: -8.0, elevation: 600, time: new Date() },
    ];
    const result = convertGpxToSimulatorRoute(waypoints);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.simulatorRoute.start).not.toHaveProperty('elevation');
      expect(result.simulatorRoute.start).not.toHaveProperty('time');
      expect(result.simulatorRoute.end).not.toHaveProperty('elevation');
      expect(result.simulatorRoute.end).not.toHaveProperty('time');
    }
  });
});
