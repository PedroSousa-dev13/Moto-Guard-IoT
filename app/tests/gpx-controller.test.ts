import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    trip: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../backend/src/services/influx.service", () => ({
  influxService: {
    queryTripTelemetry: vi.fn(),
  },
}));

import { prisma } from "../backend/src/services/prisma.service";
import { influxService } from "../backend/src/services/influx.service";
import { exportTripGpx, parseGpxFile } from "../backend/src/controllers/gpx.controller";

function mockResponse() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: vi.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("exportTripGpx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when trip does not belong to user", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(null as any);
    const req = { userId: "u1", params: { tripId: "t1" } } as any;
    const res = mockResponse();

    await exportTripGpx(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Viagem não encontrada" });
  });

  it("exports GPX from stored gpxData when available", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue({
      id: "t1",
      startedAt: new Date("2026-03-15T08:00:00.000Z"),
      endedAt: new Date("2026-03-15T09:00:00.000Z"),
      gpxData: {
        filename: "track.gpx",
        waypoints: [
          { lat: 41.1, lon: -7.7, ele: 100, time: "2026-03-15T08:00:00.000Z" },
          { lat: 41.2, lon: -7.8, ele: 110, time: "2026-03-15T08:01:00.000Z" },
        ],
      },
      motorcycle: { deviceId: "DEV-1", name: "A minha", brand: "Honda" },
    } as any);

    const req = { userId: "u1", params: { tripId: "t1" } } as any;
    const res = mockResponse();

    await exportTripGpx(req, res as any);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      expect.stringContaining("application/gpx+xml"),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("track.gpx"),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("<gpx"));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('trkpt lat="41.1" lon="-7.7"'));
  });

  it("exports GPX from influx telemetry when gpxData is missing", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue({
      id: "t2",
      startedAt: new Date("2026-03-15T08:00:00.000Z"),
      endedAt: new Date("2026-03-15T09:00:00.000Z"),
      gpxData: null,
      motorcycle: { deviceId: "DEV-2", name: "Moto X", brand: null },
    } as any);

    vi.mocked(influxService.queryTripTelemetry).mockResolvedValue([
      { time: "2026-03-15T08:00:00.000Z", latitude: 41.0, longitude: -7.0 },
      { time: "2026-03-15T08:01:00.000Z", latitude: 41.1, longitude: -7.1 },
    ] as any);

    const req = { userId: "u1", params: { tripId: "t2" } } as any;
    const res = mockResponse();

    await exportTripGpx(req, res as any);

    expect(influxService.queryTripTelemetry).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
      "DEV-2",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('trkpt lat="41" lon="-7"'));
  });

  it("returns 400 when there are no GPS points to export", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue({
      id: "t3",
      startedAt: new Date("2026-03-15T08:00:00.000Z"),
      endedAt: new Date("2026-03-15T09:00:00.000Z"),
      gpxData: null,
      motorcycle: { deviceId: "DEV-3", name: "Moto", brand: "Yamaha" },
    } as any);

    vi.mocked(influxService.queryTripTelemetry).mockResolvedValue([] as any);

    const req = { userId: "u1", params: { tripId: "t3" } } as any;
    const res = mockResponse();

    await exportTripGpx(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Não há pontos GPS suficientes para exportar GPX" });
  });
});


// Unit tests for parseGpxFile endpoint
// Requirements: 2.1, 2.2, 2.3, 6.1, 6.2
describe("parseGpxFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test file validation edge cases
  describe("File Validation", () => {
    it("should reject request with no file", async () => {
      const req = { file: undefined } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "GPX file is required",
        validationErrors: ["No file provided in request"],
      });
    });

    it("should reject file without .gpx extension", async () => {
      const buffer = Buffer.from("<gpx></gpx>", "utf8");
      const req = {
        file: {
          originalname: "route.txt",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Only .gpx files are supported",
        validationErrors: ["File must have .gpx extension"],
      });
    });

    it("should accept file with .GPX extension (case insensitive)", async () => {
      const validGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="41.0" lon="-7.0"></trkpt>
      <trkpt lat="41.1" lon="-7.1"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(validGpx, "utf8");
      const req = {
        file: {
          originalname: "route.GPX",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject file larger than 10MB", async () => {
      const largeSize = 11 * 1024 * 1024; // 11MB
      const buffer = Buffer.alloc(largeSize);
      const req = {
        file: {
          originalname: "large.gpx",
          buffer,
          size: largeSize,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "File size exceeds 10MB limit",
        validationErrors: expect.arrayContaining([
          expect.stringContaining("11MB exceeds maximum allowed size of 10MB"),
        ]),
      });
    });

    it("should accept file exactly at 10MB limit", async () => {
      const validGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="41.0" lon="-7.0"></trkpt>
      <trkpt lat="41.1" lon="-7.1"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const maxSize = 10 * 1024 * 1024; // Exactly 10MB
      const buffer = Buffer.from(validGpx, "utf8");
      const req = {
        file: {
          originalname: "max-size.gpx",
          buffer,
          size: maxSize,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject file with empty originalname", async () => {
      const buffer = Buffer.from("<gpx></gpx>", "utf8");
      const req = {
        file: {
          originalname: "",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Only .gpx files are supported",
        validationErrors: ["File must have .gpx extension"],
      });
    });
  });

  // Test error responses for invalid files
  describe("Error Handling for Invalid Files", () => {
    it("should reject GPX with no waypoints", async () => {
      const emptyGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(emptyGpx, "utf8");
      const req = {
        file: {
          originalname: "empty.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "GPX file contains no valid waypoints",
        validationErrors: expect.arrayContaining([
          expect.stringContaining("No trackpoints"),
        ]),
      });
    });

    it("should reject GPX with only 1 waypoint", async () => {
      const singleWaypointGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="41.0" lon="-7.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(singleWaypointGpx, "utf8");
      const req = {
        file: {
          originalname: "single.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "GPX file must contain at least 2 waypoints",
        validationErrors: expect.arrayContaining([
          expect.stringContaining("Found 1 waypoint"),
        ]),
      });
    });

    it("should reject malformed XML", async () => {
      const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="41.0" lon="-7.0">
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(malformedXml, "utf8");
      const req = {
        file: {
          originalname: "malformed.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      const statusCall = res.status.mock.calls[0]?.[0];
      expect(statusCall).toBeGreaterThanOrEqual(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        })
      );
    });

    it("should reject non-XML content", async () => {
      const notXml = "This is not XML content at all";
      const buffer = Buffer.from(notXml, "utf8");
      const req = {
        file: {
          originalname: "notxml.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      const statusCall = res.status.mock.calls[0]?.[0];
      expect(statusCall).toBeGreaterThanOrEqual(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        })
      );
    });

    it("should reject GPX with invalid coordinate values", async () => {
      const invalidCoords = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="invalid" lon="invalid"></trkpt>
      <trkpt lat="41.1" lon="-7.1"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(invalidCoords, "utf8");
      const req = {
        file: {
          originalname: "invalid-coords.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      // Should either reject or skip invalid waypoints
      const statusCall = res.status.mock.calls[0]?.[0];
      expect(statusCall).toBeGreaterThanOrEqual(400);
    });
  });

  // Test successful parsing scenarios
  describe("Successful Parsing", () => {
    it("should successfully parse valid GPX with 2 waypoints", async () => {
      const validGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="41.0" lon="-7.0"></trkpt>
      <trkpt lat="41.1" lon="-7.1"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(validGpx, "utf8");
      const req = {
        file: {
          originalname: "valid.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          route: expect.objectContaining({
            waypoints: expect.arrayContaining([
              expect.objectContaining({ lat: 41.0, lon: -7.0 }),
              expect.objectContaining({ lat: 41.1, lon: -7.1 }),
            ]),
            simulatorRoute: expect.objectContaining({
              start: { latitude: 41.0, longitude: -7.0 },
              end: { latitude: 41.1, longitude: -7.1 },
              loop: false,
            }),
          }),
        })
      );
    });

    it("should parse GPX with elevation data", async () => {
      const gpxWithElevation = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="41.0" lon="-7.0"><ele>100</ele></trkpt>
      <trkpt lat="41.1" lon="-7.1"><ele>150</ele></trkpt>
      <trkpt lat="41.2" lon="-7.2"><ele>200</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(gpxWithElevation, "utf8");
      const req = {
        file: {
          originalname: "elevation.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          route: expect.objectContaining({
            waypoints: expect.arrayContaining([
              expect.objectContaining({ lat: 41.0, lon: -7.0, ele: 100 }),
              expect.objectContaining({ lat: 41.1, lon: -7.1, ele: 150 }),
              expect.objectContaining({ lat: 41.2, lon: -7.2, ele: 200 }),
            ]),
          }),
        })
      );
    });

    it("should parse GPX with timestamps", async () => {
      const gpxWithTime = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="41.0" lon="-7.0"><time>2024-01-01T10:00:00Z</time></trkpt>
      <trkpt lat="41.1" lon="-7.1"><time>2024-01-01T10:01:00Z</time></trkpt>
      <trkpt lat="41.2" lon="-7.2"><time>2024-01-01T10:02:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(gpxWithTime, "utf8");
      const req = {
        file: {
          originalname: "timestamps.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.success).toBe(true);
      expect(jsonCall.route.startedAt).toBeDefined();
      expect(jsonCall.route.endedAt).toBeDefined();
      expect(jsonCall.route.totalTimeSec).toBeDefined();
      expect(typeof jsonCall.route.totalTimeSec).toBe("number");
    });

    it("should calculate distance for multi-waypoint route", async () => {
      const multiWaypointGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="41.0" lon="-7.0"></trkpt>
      <trkpt lat="41.1" lon="-7.1"></trkpt>
      <trkpt lat="41.2" lon="-7.2"></trkpt>
      <trkpt lat="41.3" lon="-7.3"></trkpt>
      <trkpt lat="41.4" lon="-7.4"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(multiWaypointGpx, "utf8");
      const req = {
        file: {
          originalname: "multi.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          route: expect.objectContaining({
            distanceKm: expect.any(Number),
            waypoints: expect.arrayContaining([
              expect.objectContaining({ lat: 41.0, lon: -7.0 }),
              expect.objectContaining({ lat: 41.4, lon: -7.4 }),
            ]),
          }),
        })
      );

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.route.distanceKm).toBeGreaterThan(0);
    });

    it("should set loop to false for all GPX imports", async () => {
      const validGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="41.0" lon="-7.0"></trkpt>
      <trkpt lat="41.1" lon="-7.1"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(validGpx, "utf8");
      const req = {
        file: {
          originalname: "loop-test.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          route: expect.objectContaining({
            simulatorRoute: expect.objectContaining({
              loop: false,
            }),
          }),
        })
      );
    });

    it("should calculate bounds correctly", async () => {
      const validGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="40.0" lon="-8.0"></trkpt>
      <trkpt lat="42.0" lon="-6.0"></trkpt>
      <trkpt lat="41.0" lon="-7.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(validGpx, "utf8");
      const req = {
        file: {
          originalname: "bounds.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          route: expect.objectContaining({
            bounds: expect.objectContaining({
              minLat: 40.0,
              maxLat: 42.0,
              minLon: -8.0,
              maxLon: -6.0,
            }),
          }),
        })
      );
    });

    it("should use first waypoint as start and last as end", async () => {
      const validGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="40.0" lon="-8.0"></trkpt>
      <trkpt lat="41.0" lon="-7.0"></trkpt>
      <trkpt lat="42.0" lon="-6.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
      const buffer = Buffer.from(validGpx, "utf8");
      const req = {
        file: {
          originalname: "start-end.gpx",
          buffer,
          size: buffer.length,
        },
      } as any;
      const res = mockResponse();

      await parseGpxFile(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.route.simulatorRoute.start).toEqual({
        latitude: 40.0,
        longitude: -8.0,
      });
      expect(jsonCall.route.simulatorRoute.end).toEqual({
        latitude: 42.0,
        longitude: -6.0,
      });
    });
  });
});
