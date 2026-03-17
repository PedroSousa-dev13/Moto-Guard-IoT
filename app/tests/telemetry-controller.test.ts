import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../backend/src/services/telemetry.store", () => ({
  telemetryStore: {
    latest: null as any,
    count: 0,
  },
}));

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    trip: {
      findFirst: vi.fn(),
    },
    motorcycle: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../backend/src/services/influx.service", () => ({
  influxService: {
    queryTripTelemetry: vi.fn(),
  },
}));

import { telemetryStore } from "../backend/src/services/telemetry.store";
import { prisma } from "../backend/src/services/prisma.service";
import { influxService } from "../backend/src/services/influx.service";
import {
  getLatestTelemetry,
  getTripTelemetry,
} from "../backend/src/controllers/telemetry.controller";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("getLatestTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (telemetryStore as any).latest = null;
    (telemetryStore as any).count = 0;
  });

  it("returns 204 when there is no telemetry data", () => {
    const req = {} as any;
    const res = mockResponse();

    getLatestTelemetry(req, res as any);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.json).toHaveBeenCalledWith({ message: "Sem dados de telemetria ainda" });
  });

  it("returns current telemetry payload when data exists", () => {
    const payload = { system: { device_id: "dev-1" } };
    (telemetryStore as any).latest = payload;
    (telemetryStore as any).count = 9;
    const req = {} as any;
    const res = mockResponse();

    getLatestTelemetry(req, res as any);

    expect(res.json).toHaveBeenCalledWith({
      received_at: expect.any(String),
      total_messages: 9,
      data: payload,
    });
  });
});

describe("getTripTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when trip does not belong to user", async () => {
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(null);
    const req = { userId: "u1", params: { tripId: "t1" } } as any;
    const res = mockResponse();

    await getTripTelemetry(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Viagem não encontrada" });
  });

  it("returns trip telemetry data from influx", async () => {
    const trip = {
      id: "t1",
      startedAt: new Date("2026-03-15T08:00:00.000Z"),
      endedAt: new Date("2026-03-15T09:00:00.000Z"),
      status: "COMPLETED",
      source: "SIMULATOR",
    };
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(trip as any);
    vi.mocked(prisma.motorcycle.findFirst).mockResolvedValue({ deviceId: "dev-42" } as any);
    vi.mocked(influxService.queryTripTelemetry).mockResolvedValue([
      { speed_kmh: 50 },
      { speed_kmh: 60 },
    ] as any);
    const req = { userId: "u1", params: { tripId: "t1" } } as any;
    const res = mockResponse();

    await getTripTelemetry(req, res as any);

    expect(influxService.queryTripTelemetry).toHaveBeenCalledWith(
      trip.startedAt,
      trip.endedAt,
      "dev-42",
    );
    expect(res.json).toHaveBeenCalledWith({
      trip,
      total_points: 2,
      data: [{ speed_kmh: 50 }, { speed_kmh: 60 }],
    });
  });

  it("returns 503 when influx query fails", async () => {
    const trip = {
      id: "t2",
      startedAt: new Date("2026-03-15T10:00:00.000Z"),
      endedAt: null,
      status: "ACTIVE",
      source: "SIMULATOR",
    };
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(trip as any);
    vi.mocked(prisma.motorcycle.findFirst).mockResolvedValue({ deviceId: "dev-99" } as any);
    vi.mocked(influxService.queryTripTelemetry).mockRejectedValue(new Error("influx unavailable"));
    const req = { userId: "u1", params: { tripId: "t2" } } as any;
    const res = mockResponse();

    await getTripTelemetry(req, res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Não foi possível consultar o InfluxDB",
    });
  });

  it("returns empty data for GPX_IMPORTED trips", async () => {
    const trip = {
      id: "t3",
      startedAt: new Date("2026-03-15T10:00:00.000Z"),
      endedAt: new Date("2026-03-15T10:10:00.000Z"),
      status: "COMPLETED",
      source: "GPX_IMPORTED",
    };
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(trip as any);
    const req = { userId: "u1", params: { tripId: "t3" } } as any;
    const res = mockResponse();

    await getTripTelemetry(req, res as any);

    expect(influxService.queryTripTelemetry).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      trip,
      total_points: 0,
      data: [],
    });
  });

  it("returns empty data when trip has no deviceId", async () => {
    const trip = {
      id: "t4",
      startedAt: new Date("2026-03-15T10:00:00.000Z"),
      endedAt: new Date("2026-03-15T10:10:00.000Z"),
      status: "COMPLETED",
      source: "SIMULATOR",
    };
    vi.mocked(prisma.trip.findFirst).mockResolvedValue(trip as any);
    vi.mocked(prisma.motorcycle.findFirst).mockResolvedValue({ deviceId: null } as any);
    const req = { userId: "u1", params: { tripId: "t4" } } as any;
    const res = mockResponse();

    await getTripTelemetry(req, res as any);

    expect(influxService.queryTripTelemetry).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      trip,
      total_points: 0,
      data: [],
    });
  });
});
