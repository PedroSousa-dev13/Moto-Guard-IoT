import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { parseGpxFile } from "../backend/src/controllers/gpx.controller";

// Mock dependencies
vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {},
}));

// Feature: gpx-upload-ui, Property 3: GPX Parsing Completeness
// **Validates: Requirements 2.1, 2.2**

describe("Property 3: GPX Parsing Completeness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create a mock response object
  function mockResponse() {
    const headers: Record<string, string> = {};
    let statusCode = 200;
    let jsonData: any = null;

    const res = {
      headers,
      get statusCode() {
        return statusCode;
      },
      get jsonData() {
        return jsonData;
      },
      setHeader: vi.fn((k: string, v: string) => {
        headers[k] = v;
      }),
      status: vi.fn((code: number) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn((data: any) => {
        jsonData = data;
        return res;
      }),
    };

    return res;
  }

  // Generator for valid GPX waypoints
  const waypointArbitrary = fc.record({
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lon: fc.double({ min: -180, max: 180, noNaN: true }),
    ele: fc.option(fc.double({ min: -500, max: 9000, noNaN: true })),
    time: fc.option(fc.date({ min: new Date("2020-01-01"), max: new Date("2025-12-31") })),
  });

  // Generator for valid GPX XML with waypoints
  const validGpxArbitrary = fc
    .array(waypointArbitrary, { minLength: 2, maxLength: 100 })
    .map((waypoints) => {
      const trkpts = waypoints
        .map((wp) => {
          const ele = wp.ele !== null && wp.ele !== undefined ? `<ele>${wp.ele}</ele>` : "";
          const time = wp.time !== null && wp.time !== undefined ? `<time>${wp.time.toISOString()}</time>` : "";
          return `<trkpt lat="${wp.lat}" lon="${wp.lon}">${ele}${time}</trkpt>`;
        })
        .join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PropertyTest" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Test Route</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>Test Track</name>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>`;

      return { xml, waypoints };
    });

  it("should extract all waypoints from any valid GPX file without data loss", async () => {
    await fc.assert(
      fc.asyncProperty(validGpxArbitrary, async ({ xml, waypoints }) => {
        const buffer = Buffer.from(xml, "utf8");
        const req = {
          file: {
            originalname: "test.gpx",
            buffer,
            size: buffer.length,
          },
        } as any;

        const res = mockResponse();
        await parseGpxFile(req, res as any);

        // Property: Parsing should succeed for valid GPX
        expect(res.statusCode).toBe(200);
        expect(res.jsonData).toBeDefined();
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.route).toBeDefined();

        const route = res.jsonData.route;

        // Property: All waypoints should be extracted
        expect(route.waypoints).toBeDefined();
        expect(route.waypoints.length).toBe(waypoints.length);

        // Property: Each waypoint should preserve lat/lon
        route.waypoints.forEach((parsed: any, idx: number) => {
          const original = waypoints[idx];
          expect(parsed.lat).toBeCloseTo(original.lat, 5);
          expect(parsed.lon).toBeCloseTo(original.lon, 5);

          // Property: Elevation should be preserved if present
          if (original.ele !== null && original.ele !== undefined) {
            expect(parsed.ele).toBeCloseTo(original.ele, 2);
          }

          // Property: Time should be preserved if present
          if (original.time !== null && original.time !== undefined) {
            expect(parsed.time).toBeDefined();
          }
        });

        // Property: Distance should be calculated and non-negative
        expect(route.distanceKm).toBeGreaterThanOrEqual(0);

        // Property: Simulator route should be created with first/last waypoints
        expect(route.simulatorRoute).toBeDefined();
        expect(route.simulatorRoute.start.latitude).toBeCloseTo(waypoints[0].lat, 5);
        expect(route.simulatorRoute.start.longitude).toBeCloseTo(waypoints[0].lon, 5);
        expect(route.simulatorRoute.end.latitude).toBeCloseTo(
          waypoints[waypoints.length - 1].lat,
          5
        );
        expect(route.simulatorRoute.end.longitude).toBeCloseTo(
          waypoints[waypoints.length - 1].lon,
          5
        );
        expect(route.simulatorRoute.loop).toBe(false);

        // Property: Bounds should encompass all waypoints
        const lats = waypoints.map((w) => w.lat);
        const lons = waypoints.map((w) => w.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        expect(route.bounds.minLat).toBeCloseTo(minLat, 5);
        expect(route.bounds.maxLat).toBeCloseTo(maxLat, 5);
        expect(route.bounds.minLon).toBeCloseTo(minLon, 5);
        expect(route.bounds.maxLon).toBeCloseTo(maxLon, 5);
      }),
      { numRuns: 20 }
    );
  });

  it("should calculate timing information when timestamps are present", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(waypointArbitrary, { minLength: 2, maxLength: 50 })
          .chain((waypoints) => {
            // Ensure all waypoints have timestamps in chronological order
            const startTime = new Date("2024-01-01T10:00:00Z");
            const waypointsWithTime = waypoints.map((wp, idx) => ({
              ...wp,
              time: new Date(startTime.getTime() + idx * 60000), // 1 minute apart
            }));

            const trkpts = waypointsWithTime
              .map((wp) => {
                const ele = wp.ele !== null ? `<ele>${wp.ele}</ele>` : "";
                return `<trkpt lat="${wp.lat}" lon="${wp.lon}">${ele}<time>${wp.time.toISOString()}</time></trkpt>`;
              })
              .join("\n");

            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PropertyTest" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>`;

            return fc.constant({ xml, waypoints: waypointsWithTime });
          }),
        async ({ xml, waypoints }) => {
          const buffer = Buffer.from(xml, "utf8");
          const req = {
            file: {
              originalname: "test.gpx",
              buffer,
              size: buffer.length,
            },
          } as any;

          const res = mockResponse();
          await parseGpxFile(req, res as any);

          expect(res.statusCode).toBe(200);
          const route = res.jsonData.route;

          // Property: Timing information should be extracted
          expect(route.startedAt).toBeDefined();
          expect(route.endedAt).toBeDefined();
          expect(route.totalTimeSec).toBeGreaterThanOrEqual(0);

          // Property: Start time should match first waypoint
          const firstTime = new Date(waypoints[0].time);
          const lastTime = new Date(waypoints[waypoints.length - 1].time);
          expect(new Date(route.startedAt).getTime()).toBe(firstTime.getTime());
          expect(new Date(route.endedAt).getTime()).toBe(lastTime.getTime());

          // Property: Total time should match time span
          const expectedTimeSec = Math.round((lastTime.getTime() - firstTime.getTime()) / 1000);
          expect(route.totalTimeSec).toBe(expectedTimeSec);

          // Property: Average speed should be calculated when time is present
          if (route.distanceKm > 0 && route.totalTimeSec > 0) {
            expect(route.avgSpeedKmh).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("should handle GPX files with elevation data", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(waypointArbitrary, { minLength: 2, maxLength: 30 })
          .chain((waypoints) => {
            // Ensure all waypoints have elevation
            const waypointsWithEle = waypoints.map((wp) => ({
              ...wp,
              ele: wp.ele ?? Math.random() * 1000,
            }));

            const trkpts = waypointsWithEle
              .map((wp) => {
                const isValidDate = wp.time instanceof Date && !isNaN(wp.time.getTime());
                const time = isValidDate ? `<time>${wp.time.toISOString()}</time>` : "";
                return `<trkpt lat="${wp.lat}" lon="${wp.lon}"><ele>${wp.ele}</ele>${time}</trkpt>`;
              })
              .join("\n");

            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PropertyTest" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>`;

            return fc.constant({ xml, waypoints: waypointsWithEle });
          }),
        async ({ xml, waypoints }) => {
          const buffer = Buffer.from(xml, "utf8");
          const req = {
            file: {
              originalname: "test.gpx",
              buffer,
              size: buffer.length,
            },
          } as any;

          const res = mockResponse();
          await parseGpxFile(req, res as any);

          expect(res.statusCode).toBe(200);
          const route = res.jsonData.route;

          // Property: All elevation data should be preserved
          route.waypoints.forEach((parsed: any, idx: number) => {
            expect(parsed.ele).toBeDefined();
            expect(parsed.ele).toBeCloseTo(waypoints[idx].ele, 2);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it("should reject GPX files with fewer than 2 waypoints", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(waypointArbitrary, { minLength: 0, maxLength: 1 }),
        async (waypoints) => {
          const trkpts = waypoints
            .map((wp) => {
              const ele = wp.ele !== null ? `<ele>${wp.ele}</ele>` : "";
              const time = wp.time !== null ? `<time>${wp.time.toISOString()}</time>` : "";
              return `<trkpt lat="${wp.lat}" lon="${wp.lon}">${ele}${time}</trkpt>`;
            })
            .join("\n");

          const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PropertyTest" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>`;

          const buffer = Buffer.from(xml, "utf8");
          const req = {
            file: {
              originalname: "test.gpx",
              buffer,
              size: buffer.length,
            },
          } as any;

          const res = mockResponse();
          await parseGpxFile(req, res as any);

          // Property: Should reject with 400 error
          expect(res.statusCode).toBe(400);
          expect(res.jsonData.success).toBe(false);
          expect(res.jsonData.error).toBeDefined();
        }
      ),
      { numRuns: 10 }
    );
  });
});
