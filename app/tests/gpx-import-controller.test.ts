import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../backend/src/services/gpx-import.service", () => ({
  parseGpx: vi.fn(),
}));

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { parseGpx } from "../backend/src/services/gpx-import.service";
import { prisma } from "../backend/src/services/prisma.service";
import { importGpx } from "../backend/src/controllers/gpx.controller";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("importGpx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when user has no motorcycles", async () => {
    vi.mocked(parseGpx).mockReturnValue({
      waypoints: [{ lat: 41.0, lon: -7.0, time: "2026-03-15T08:00:00.000Z" }],
      bounds: { minLat: 41, maxLat: 41, minLon: -7, maxLon: -7 },
      distanceKm: 1.23,
      totalTimeSec: 60,
      avgSpeedKmh: 73,
      maxSpeedKmh: 90,
      startedAt: new Date("2026-03-15T08:00:00.000Z"),
      endedAt: new Date("2026-03-15T08:01:00.000Z"),
    } as any);

    const tx = {
      motorcycle: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      trip: { create: vi.fn() },
      gpxData: { create: vi.fn() },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const req = {
      userId: "u1",
      body: {},
      file: {
        buffer: Buffer.from("<gpx></gpx>"),
        originalname: "file.gpx",
        size: 123,
      },
    } as any;
    const res = mockResponse();

    await importGpx(req, res as any);

    expect(tx.motorcycle.create).not.toHaveBeenCalled();
    expect(tx.trip.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("motas registadas"),
      }),
    );
  });

  it("returns 400 when requested motorcycle does not exist", async () => {
    vi.mocked(parseGpx).mockReturnValue({
      waypoints: [{ lat: 41.0, lon: -7.0 }],
      bounds: { minLat: 41, maxLat: 41, minLon: -7, maxLon: -7 },
      distanceKm: 1,
      totalTimeSec: 10,
      avgSpeedKmh: 10,
      maxSpeedKmh: 20,
      startedAt: new Date(),
      endedAt: new Date(),
    } as any);

    const tx = {
      motorcycle: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      trip: { create: vi.fn() },
      gpxData: { create: vi.fn() },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const req = {
      userId: "u1",
      body: { motorcycleId: "m-missing" },
      file: {
        buffer: Buffer.from("<gpx></gpx>"),
        originalname: "file.gpx",
        size: 123,
      },
    } as any;
    const res = mockResponse();

    await importGpx(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Mota selecionada não encontrada" });
  });
});

