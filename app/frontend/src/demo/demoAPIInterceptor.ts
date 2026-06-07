import type { InternalAxiosRequestConfig } from 'axios';
import { api } from '../services/api';
import {
  demoMotorcycles,
  demoTrips,
  demoFeedItems,
  demoTelemetry,
  demoEvaluation,
} from './demoData';

// ---------------------------------------------------------------------------
// Helper: create an axios adapter that resolves with mock data
// ---------------------------------------------------------------------------
function createDemoAdapter(data: unknown, status = 200) {
  return async (config: InternalAxiosRequestConfig) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    headers: {},
    config,
    request: {},
  });
}

// ---------------------------------------------------------------------------
// Route matching helpers
// ---------------------------------------------------------------------------
function matchSegments(url: string, pattern: string): Record<string, string> | null {
  const urlParts = url.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  if (urlParts.length !== patternParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = urlParts[i];
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Task 3.1 — setupDemoInterceptor
// ---------------------------------------------------------------------------
export function setupDemoInterceptor(isDemoMode: () => boolean): () => void {
  const interceptorId = api.interceptors.request.use((config) => {
    if (!isDemoMode()) return config;

    const method = (config.method ?? 'get').toLowerCase();
    // config.url is relative to baseURL (/api), so it looks like /motorcycles, /trips, etc.
    const url = (config.url ?? '').split('?')[0]; // strip query params

    // -----------------------------------------------------------------------
    // Auth routes must always pass through to the real backend
    // -----------------------------------------------------------------------
    if (url.startsWith('/auth')) {
      return config;
    }

    // -----------------------------------------------------------------------
    // Task 3.8 — POST | PUT | DELETE → { success: true }
    // -----------------------------------------------------------------------
    if (method === 'post' || method === 'put' || method === 'delete') {
      config.adapter = createDemoAdapter({ success: true }, 200);
      return config;
    }

    // GET routes — order matters (more specific first)

    // Task 3.2 — GET /motorcycles
    if (url === '/motorcycles') {
      config.adapter = createDemoAdapter(demoMotorcycles);
      return config;
    }

    // Task 3.4 — GET /trips/feed (before /trips/:id)
    if (url === '/trips/feed') {
      config.adapter = createDemoAdapter(demoFeedItems);
      return config;
    }

    // Task 3.3 — GET /trips
    if (url === '/trips') {
      config.adapter = createDemoAdapter(demoTrips);
      return config;
    }

    // Task 3.7 — GET /trips/:id/evaluation (before /trips/:id)
    const evalMatch = matchSegments(url, '/trips/:id/evaluation');
    if (evalMatch) {
      config.adapter = createDemoAdapter(demoEvaluation);
      return config;
    }

    // Task 3.5 — GET /trips/:id
    const tripMatch = matchSegments(url, '/trips/:id');
    if (tripMatch) {
      const trip = demoTrips.find((t) => t.id === tripMatch.id);
      if (trip) {
        config.adapter = createDemoAdapter(trip);
      } else {
        config.adapter = createDemoAdapter({ message: 'Trip not found' }, 404);
      }
      return config;
    }

    // Task 3.6 — GET /telemetry/:tripId
    const telemetryMatch = matchSegments(url, '/telemetry/:tripId');
    if (telemetryMatch) {
      const { tripId } = telemetryMatch;
      const points = demoTelemetry[tripId] ?? [];
      const trip = demoTrips.find((t) => t.id === tripId);
      const telemetryResponse = {
        trip: {
          id: tripId,
          startedAt: trip?.startedAt ?? new Date().toISOString(),
          endedAt: trip?.endedAt ?? null,
          status: trip?.status ?? 'ACTIVE',
        },
        total_points: points.length,
        data: points,
      };
      config.adapter = createDemoAdapter(telemetryResponse);
      return config;
    }

    // Unmapped GET endpoints in demo mode
    console.warn(`[Demo] Endpoint não mapeado: ${config.method?.toUpperCase()} ${config.url} — a responder com dados vazios`);
    config.adapter = createDemoAdapter({});
    return config;
  });

  return () => api.interceptors.request.eject(interceptorId);
}
