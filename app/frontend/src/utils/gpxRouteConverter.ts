/**
 * GPX Route Converter Utility
 *
 * Transforms parsed GPX waypoints into simulator route format.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

export interface GpxWaypoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  time?: Date;
}

export interface SimulatorRoute {
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  loop: boolean;
}

export interface RouteConversionResult {
  success: true;
  simulatorRoute: SimulatorRoute;
}

export interface RouteConversionError {
  success: false;
  error: string;
}

export type RouteConversionOutcome = RouteConversionResult | RouteConversionError;

/**
 * Converts an array of GPX waypoints into a simulator-compatible route.
 *
 * - Sets the first waypoint as the route start (Requirement 3.2)
 * - Sets the last waypoint as the route end (Requirement 3.3)
 * - Sets loop to false for all GPX imports (Requirement 3.5)
 * - Returns an error if fewer than 2 waypoints are provided (Requirement 3.4)
 */
export function convertGpxToSimulatorRoute(waypoints: GpxWaypoint[]): RouteConversionOutcome {
  if (!waypoints || waypoints.length < 2) {
    return {
      success: false,
      error: `GPX file must contain at least 2 waypoints. Found: ${waypoints?.length ?? 0}`,
    };
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];

  return {
    success: true,
    simulatorRoute: {
      start: { latitude: first.latitude, longitude: first.longitude },
      end: { latitude: last.latitude, longitude: last.longitude },
      loop: false, // GPX imports are never loops (Requirement 3.5)
    },
  };
}
