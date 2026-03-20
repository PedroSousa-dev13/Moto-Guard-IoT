// =============================================================================
// Testes: listAlerts controller (GET /api/alerts)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    trip: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    tripEvent: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../backend/src/services/trip-evaluation.service", () => ({
  evaluateTripHeuristic: vi.fn(),
}));

vi.mock("../backend/src/services/trip-ml-pipeline.service", () => ({
  runTripMlPipeline: vi.fn(),
  getMlStatus: vi.fn(),
}));

import { prisma } from "../backend/src/services/prisma.service";
import { listAlerts } from "../backend/src/controllers/trip.controller";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function makeTripEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "ev1",
    tripId: "t1",
    type: "HARD_BRAKING",
    severity: "WARNING",
    message: "Travagem brusca",
    occurredAt: new Date("2026-01-01T10:00:00Z"),
    latitude: 41.1,
    longitude: -8.6,
    speedKmh: 80,
    rollDeg: 15,
    gForce: 1.2,
    engineTempC: 90,
    voltage: 12.5,
    trip: {
      id: "t1",
      source: "SIMULATOR",
      motorcycle: { name: "Bandit", brand: "Suzuki", deviceId: "MOTOGUARD-SIM-01" },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Listagem básica ──────────────────────────────────────────────────────────

describe("listAlerts — listagem básica", () => {
  it("retorna lista de eventos do utilizador", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([makeTripEvent()] as any);
    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trip: { userId: "u1" } },
      }),
    );
    expect(res.json).toHaveBeenCalledWith([makeTripEvent()]);
  });

  it("retorna lista vazia quando não há eventos", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("ordena por occurredAt desc", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { occurredAt: "desc" },
      }),
    );
  });

  it("inclui dados da mota (trip.motorcycle)", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([makeTripEvent()] as any);
    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          trip: expect.objectContaining({
            select: expect.objectContaining({
              motorcycle: expect.anything(),
            }),
          }),
        }),
      }),
    );
  });
});

// ─── Filtro por severity ──────────────────────────────────────────────────────

describe("listAlerts — filtro severity", () => {
  it("filtra por severity=CRITICAL", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { severity: "CRITICAL" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: "CRITICAL" }),
      }),
    );
  });

  it("filtra por severity=WARNING", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { severity: "WARNING" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: "WARNING" }),
      }),
    );
  });

  it("filtra por severity=INFO", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { severity: "INFO" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: "INFO" }),
      }),
    );
  });

  it("retorna 400 para severity inválido", async () => {
    const req = { userId: "u1", query: { severity: "EXTREME" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "severity inválido" });
    expect(prisma.tripEvent.findMany).not.toHaveBeenCalled();
  });
});

// ─── Filtro por type ──────────────────────────────────────────────────────────

describe("listAlerts — filtro type", () => {
  it("filtra por type=CRASH_DETECTED", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { type: "CRASH_DETECTED" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "CRASH_DETECTED" }),
      }),
    );
  });

  it("filtra por type=OVERHEAT", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { type: "OVERHEAT" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "OVERHEAT" }),
      }),
    );
  });

  it("retorna 400 para type inválido", async () => {
    const req = { userId: "u1", query: { type: "EXPLOSION" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "type inválido" });
    expect(prisma.tripEvent.findMany).not.toHaveBeenCalled();
  });

  it("aceita todos os tipos válidos sem erro", async () => {
    const validTypes = [
      "HARD_BRAKING", "EXCESSIVE_LEAN", "HIGH_VIBRATION", "OVERHEAT",
      "LOW_VOLTAGE", "CRASH_DETECTED", "RAPID_ACCELERATION",
      "TIRE_PRESSURE_LOW", "OIL_PRESSURE_LOW", "SPEEDING",
    ];
    for (const type of validTypes) {
      vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
      const req = { userId: "u1", query: { type } } as any;
      const res = mockResponse();
      await listAlerts(req, res as any);
      expect(res.status).not.toHaveBeenCalledWith(400);
    }
  });
});

// ─── Filtro por tripId ────────────────────────────────────────────────────────

describe("listAlerts — filtro tripId", () => {
  it("filtra por tripId", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { tripId: "trip-abc" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tripId: "trip-abc" }),
      }),
    );
  });
});

// ─── Filtro por limit ─────────────────────────────────────────────────────────

describe("listAlerts — filtro limit", () => {
  it("usa limit=100 por defeito", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("usa limit fornecido pelo cliente", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { limit: "50" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("clamp limit ao máximo de 500", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { limit: "9999" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });

  it("clamp limit ao mínimo de 1", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { limit: "0" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });

  it("usa 100 quando limit não é número", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = { userId: "u1", query: { limit: "abc" } } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});

// ─── Filtros combinados ───────────────────────────────────────────────────────

describe("listAlerts — filtros combinados", () => {
  it("combina severity + type + tripId", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockResolvedValue([]);
    const req = {
      userId: "u1",
      query: { severity: "CRITICAL", type: "CRASH_DETECTED", tripId: "t99" },
    } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(prisma.tripEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          trip: { userId: "u1" },
          severity: "CRITICAL",
          type: "CRASH_DETECTED",
          tripId: "t99",
        },
      }),
    );
  });
});

// ─── Erro interno ─────────────────────────────────────────────────────────────

describe("listAlerts — erro interno", () => {
  it("retorna 500 quando a query falha", async () => {
    vi.mocked(prisma.tripEvent.findMany).mockRejectedValue(new Error("db crash"));
    const req = { userId: "u1", query: {} } as any;
    const res = mockResponse();

    await listAlerts(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Erro interno do servidor." });
  });
});
