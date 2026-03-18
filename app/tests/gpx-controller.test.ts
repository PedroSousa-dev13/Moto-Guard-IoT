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
import { exportTripGpx } from "../backend/src/controllers/gpx.controller";

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

