import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { setupDemoInterceptor } from "../demoAPIInterceptor";
import { api } from "../../services/api";
import {
  demoMotorcycles,
  demoTrips,
  demoFeedItems,
} from "../demoData";

let cleanup: (() => void) | null = null;

beforeEach(() => {
  cleanup = setupDemoInterceptor(() => true);
});

afterEach(() => {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
});

// ---------------------------------------------------------------------------
// Property 5: API Interceptor retorna dados demo para todos os endpoints GET
// Feature: demo-mode, Property 5: API Interceptor retorna dados demo para todos os endpoints GET
// ---------------------------------------------------------------------------

describe("Property 5: API Interceptor retorna dados demo para todos os endpoints GET", () => {
  it("GET /motorcycles returns demoMotorcycles with status 200", async () => {
    const res = await api.get("/motorcycles");
    expect(res.status).toBe(200);
    expect(res.data).toEqual(demoMotorcycles);
  });

  it("GET /trips returns demoTrips with status 200", async () => {
    const res = await api.get("/trips");
    expect(res.status).toBe(200);
    expect(res.data).toEqual(demoTrips);
  });

  it("GET /trips/feed returns demoFeedItems with status 200", async () => {
    const res = await api.get("/trips/feed");
    expect(res.status).toBe(200);
    expect(res.data).toEqual(demoFeedItems);
  });

  it("GET /trips/:id returns the correct trip for each demo trip", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...demoTrips), async (trip) => {
        const res = await api.get(`/trips/${trip.id}`);
        expect(res.status).toBe(200);
        expect(res.data.id).toBe(trip.id);
      }),
      { numRuns: 5 }
    );
  });

  it("GET /telemetry/:tripId returns telemetry data with status 200", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...demoTrips), async (trip) => {
        const res = await api.get(`/telemetry/${trip.id}`);
        expect(res.status).toBe(200);
        expect(res.data.trip.id).toBe(trip.id);
        expect(Array.isArray(res.data.data)).toBe(true);
        expect(res.data.data.length).toBeGreaterThanOrEqual(50);
      }),
      { numRuns: 5 }
    );
  });

  it("GET /trips/:id/evaluation returns evaluation data with status 200", async () => {
    const res = await api.get(`/trips/${demoTrips[0].id}/evaluation`);
    expect(res.status).toBe(200);
    expect(typeof res.data.score).toBe("number");
  });

  it("GET unmapped endpoint returns empty object with status 200", async () => {
    const res = await api.get("/some/unknown/endpoint");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Property 6: API Interceptor retorna sucesso para mutações
// Feature: demo-mode, Property 6: API Interceptor retorna sucesso para mutações
// ---------------------------------------------------------------------------

describe("Property 6: API Interceptor retorna sucesso para mutações", () => {
  it("POST/PUT/DELETE all return { success: true } with status 200", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("post", "put", "delete") as fc.Arbitrary<"post" | "put" | "delete">,
        fc.constantFrom("/trips", "/motorcycles", "/auth/profile"),
        async (method, url) => {
          const res = await (api as any)[method](url, {});
          expect(res.status).toBe(200);
          expect(res.data.success).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});
