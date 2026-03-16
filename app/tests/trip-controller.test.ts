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
import { listTrips, getTrip } from "../backend/src/controllers/trip.controller";

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
