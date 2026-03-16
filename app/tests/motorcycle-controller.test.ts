import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    motorcycleProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    motorcycle: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../backend/src/services/prisma.service";
import {
  createMotorcycle,
  listMotorcycles,
  listProfiles,
} from "../backend/src/controllers/motorcycle.controller";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("createMotorcycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when name is missing", async () => {
    const req = { userId: "u1", body: { brand: "Yamaha" } } as any;
    const res = mockResponse();

    await createMotorcycle(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Campo 'name' é obrigatório" });
  });

  it("returns 400 when provided profile does not exist", async () => {
    vi.mocked(prisma.motorcycleProfile.findUnique).mockResolvedValue(null);
    const req = {
      userId: "u1",
      body: { name: "MT-07", profileId: "missing-profile" },
    } as any;
    const res = mockResponse();

    await createMotorcycle(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Perfil de mota não encontrado" });
    expect(prisma.motorcycle.create).not.toHaveBeenCalled();
  });

  it("creates motorcycle with parsed year and nullable fields", async () => {
    vi.mocked(prisma.motorcycleProfile.findUnique).mockResolvedValue({ id: "p1" } as any);
    vi.mocked(prisma.motorcycle.create).mockResolvedValue({ id: "m1" } as any);
    const req = {
      userId: "u1",
      body: {
        name: "MT-07",
        brand: "Yamaha",
        year: "2024",
        profileId: "p1",
        deviceId: "dev-77",
      },
    } as any;
    const res = mockResponse();

    await createMotorcycle(req, res as any);

    expect(prisma.motorcycle.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        name: "MT-07",
        brand: "Yamaha",
        year: 2024,
        profileId: "p1",
        deviceId: "dev-77",
      },
      include: { profile: true },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: "m1" });
  });

  it("returns 500 when create throws", async () => {
    vi.mocked(prisma.motorcycle.create).mockRejectedValue(new Error("db issue"));
    const req = { userId: "u1", body: { name: "MT-07" } } as any;
    const res = mockResponse();

    await createMotorcycle(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});

describe("listMotorcycles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user motorcycles ordered by newest", async () => {
    vi.mocked(prisma.motorcycle.findMany).mockResolvedValue([{ id: "m1" }] as any);
    const req = { userId: "u1" } as any;
    const res = mockResponse();

    await listMotorcycles(req, res as any);

    expect(prisma.motorcycle.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      include: { profile: true },
      orderBy: { createdAt: "desc" },
    });
    expect(res.json).toHaveBeenCalledWith([{ id: "m1" }]);
  });

  it("returns 500 when listing motorcycles fails", async () => {
    vi.mocked(prisma.motorcycle.findMany).mockRejectedValue(new Error("db issue"));
    const req = { userId: "u1" } as any;
    const res = mockResponse();

    await listMotorcycles(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});

describe("listProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profiles ordered by name", async () => {
    vi.mocked(prisma.motorcycleProfile.findMany).mockResolvedValue([{ id: "p1" }] as any);
    const req = {} as any;
    const res = mockResponse();

    await listProfiles(req, res as any);

    expect(prisma.motorcycleProfile.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
    });
    expect(res.json).toHaveBeenCalledWith([{ id: "p1" }]);
  });

  it("returns 500 when listing profiles fails", async () => {
    vi.mocked(prisma.motorcycleProfile.findMany).mockRejectedValue(new Error("db issue"));
    const req = {} as any;
    const res = mockResponse();

    await listProfiles(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});
