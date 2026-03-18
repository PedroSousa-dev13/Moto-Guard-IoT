import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    trip: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "../backend/src/services/prisma.service";
import { listTrips, listTripFeed, getTrip } from "../backend/src/controllers/trip.controller";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("listTrips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid source filter", async () => {
    const req = { userId: "u1", query: { source: "INVALID" } } as any;
    const res = mockResponse();

    await listTrips(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Parâmetro source inválido. Use: SIMULATOR | GPX_IMPORTED | DEVICE_REAL",
    });
    expect(prisma.trip.findMany).not.toHaveBeenCalled();
  });

  it("lists user trips without source filter", async () => {
    vi.mocked(prisma.trip.findMany).mockResolvedValue([{ id: "t1" }] as any);
    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listTrips(req, res as any);

    expect(prisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
      }),
    );
    expect(res.json).toHaveBeenCalledWith([{ id: "t1" }]);
  });

  it("lists user trips with valid source filter", async () => {
    vi.mocked(prisma.trip.findMany).mockResolvedValue([{ id: "t2" }] as any);
    const req = { userId: "u1", query: { source: "SIMULATOR" } } as any;
    const res = mockResponse();

    await listTrips(req, res as any);

    expect(prisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", source: "SIMULATOR" },
      }),
    );
    expect(res.json).toHaveBeenCalledWith([{ id: "t2" }]);
  });

  it("returns 500 when list query throws", async () => {
    vi.mocked(prisma.trip.findMany).mockRejectedValue(new Error("db issue"));
    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listTrips(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});

describe("listTripFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid source filter", async () => {
    const req = { userId: "u1", query: { source: "INVALID" } } as any;
    const res = mockResponse();

    await listTripFeed(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Parâmetro source inválido. Use: SIMULATOR | GPX_IMPORTED | DEVICE_REAL",
    });
    expect(prisma.trip.findMany).not.toHaveBeenCalled();
  });

  it("returns computed scores and labels", async () => {
    vi.mocked(prisma.trip.findMany).mockResolvedValue([
      {
        id: "t1",
        startedAt: new Date("2026-03-14T10:00:00.000Z"),
        endedAt: new Date("2026-03-14T11:00:00.000Z"),
        status: "COMPLETED",
        source: "DEVICE_REAL",
        distanceKm: 85,
        avgSpeedKmh: 72,
        maxSpeedKmh: 120,
        maxRollDeg: 18,
        maxGForce: 0.9,
        motorcycle: {
          id: "m1",
          name: "MT-07",
          brand: "Yamaha",
          profile: {
            maxSpeedKmh: 200,
            typicalMaxRollDeg: 35,
            crashRollThreshold: 65,
            crashGForce: 3.2,
          },
        },
        events: [{ type: "HARD_BRAKING", severity: "WARNING" }],
      },
    ] as any);

    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listTripFeed(req, res as any);

    expect(prisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", status: "COMPLETED" },
      }),
    );

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as any[];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toEqual(
      expect.objectContaining({
        id: "t1",
        safetyScore: 88,
        performanceScore: expect.any(Number),
        labels: expect.arrayContaining(["Weekend Tour"]),
        eventCounts: expect.objectContaining({ total: 1 }),
      }),
    );
  });

  it("returns 500 when list query throws", async () => {
    vi.mocked(prisma.trip.findMany).mockRejectedValue(new Error("db issue"));
    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listTripFeed(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});

describe("getTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when trip is not found", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(null);
    const req = { userId: "u1", params: { id: "t1" } } as any;
    const res = mockResponse();

    await getTrip(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Viagem não encontrada" });
  });

  it("returns trip details when found", async () => {
    const trip = { id: "t1", events: [{ id: "e1" }] };
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(trip as any);
    const req = { userId: "u1", params: { id: "t1" } } as any;
    const res = mockResponse();

    await getTrip(req, res as any);

    expect(prisma.trip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1", userId: "u1" },
      }),
    );
    expect(res.json).toHaveBeenCalledWith(trip);
  });

  it("returns 500 when detail query throws", async () => {
    vi.mocked(prisma.trip.findFirst).mockRejectedValue(new Error("db issue"));
    const req = { userId: "u1", params: { id: "t1" } } as any;
    const res = mockResponse();

    await getTrip(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});
