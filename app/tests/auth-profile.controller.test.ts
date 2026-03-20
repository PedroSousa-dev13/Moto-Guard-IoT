// =============================================================================
// Testes: updateProfile e changePassword controllers (4.6)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Todos os mocks hoisted para evitar ReferenceError no vi.mock factory
const { mockPrismaFindUnique, mockPrismaUpdate, mockBcryptCompare, mockBcryptHash } = vi.hoisted(() => {
  const mockPrismaFindUnique = vi.fn();
  const mockPrismaUpdate = vi.fn();
  const mockBcryptCompare = vi.fn();
  const mockBcryptHash = vi.fn().mockResolvedValue("hashed_new_password");
  return { mockPrismaFindUnique, mockPrismaUpdate, mockBcryptCompare, mockBcryptHash };
});

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    user: {
      findUnique: mockPrismaFindUnique,
      update: mockPrismaUpdate,
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

vi.mock("bcryptjs", () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
  },
  compare: mockBcryptCompare,
  hash: mockBcryptHash,
}));

import { updateProfile, changePassword } from "../backend/src/controllers/auth.controller";

// Helpers

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    passwordHash: "hashed_password",
    emergencyContact: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBcryptHash.mockResolvedValue("hashed_new_password");
});

// =============================================================================
// updateProfile
// =============================================================================

describe("updateProfile - validacao de nome", () => {
  it("retorna 400 quando name e string vazia", async () => {
    const req = { userId: "user-1", body: { name: "" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Nome inv\u00e1lido" });
  });

  it("retorna 400 quando name e so espacos", async () => {
    const req = { userId: "user-1", body: { name: "   " } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("aceita name valido sem erro de validacao", async () => {
    mockPrismaUpdate.mockResolvedValue(makeUser({ name: "Novo Nome" }));
    const req = { userId: "user-1", body: { name: "Novo Nome" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it("faz trim ao nome antes de guardar", async () => {
    mockPrismaUpdate.mockResolvedValue(makeUser({ name: "Joao" }));
    const req = { userId: "user-1", body: { name: "  Joao  " } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Joao" }) }),
    );
  });
});

describe("updateProfile - validacao de emergencyContact", () => {
  it("retorna 400 quando emergencyContact nao e email valido", async () => {
    const req = { userId: "user-1", body: { emergencyContact: "nao-e-email" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email de emerg\u00eancia inv\u00e1lido" });
  });

  it("retorna 400 para email sem @", async () => {
    const req = { userId: "user-1", body: { emergencyContact: "invalido.com" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retorna 400 para string vazia (nao e email valido)", async () => {
    const req = { userId: "user-1", body: { emergencyContact: "" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("aceita email valido sem erro", async () => {
    mockPrismaUpdate.mockResolvedValue(makeUser({ emergencyContact: "em@test.com" }));
    const req = { userId: "user-1", body: { emergencyContact: "em@test.com" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it("aceita null para limpar o contacto de emergencia", async () => {
    mockPrismaUpdate.mockResolvedValue(makeUser({ emergencyContact: null }));
    const req = { userId: "user-1", body: { emergencyContact: null } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emergencyContact: null }) }),
    );
  });

  it("nao inclui emergencyContact no update quando nao fornecido no body", async () => {
    mockPrismaUpdate.mockResolvedValue(makeUser({ name: "Novo" }));
    const req = { userId: "user-1", body: { name: "Novo" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    const data = mockPrismaUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect("emergencyContact" in data).toBe(false);
  });
});

describe("updateProfile - persistencia", () => {
  it("chama prisma.user.update com userId correto", async () => {
    mockPrismaUpdate.mockResolvedValue(makeUser());
    const req = { userId: "user-42", body: { name: "Teste" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-42" } }),
    );
  });

  it("retorna o utilizador atualizado", async () => {
    const updated = makeUser({ name: "Atualizado", emergencyContact: "em@test.com" });
    mockPrismaUpdate.mockResolvedValue(updated);
    const req = { userId: "user-1", body: { name: "Atualizado", emergencyContact: "em@test.com" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it("retorna 500 quando prisma falha", async () => {
    mockPrismaUpdate.mockRejectedValue(new Error("db error"));
    const req = { userId: "user-1", body: { name: "Teste" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("seleciona emergencyContact na resposta", async () => {
    mockPrismaUpdate.mockResolvedValue(makeUser());
    const req = { userId: "user-1", body: { name: "X" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ emergencyContact: true }),
      }),
    );
  });

  it("atualiza nome e emergencyContact em simultaneo", async () => {
    const updated = makeUser({ name: "Joao", emergencyContact: "sos@test.com" });
    mockPrismaUpdate.mockResolvedValue(updated);
    const req = { userId: "user-1", body: { name: "Joao", emergencyContact: "sos@test.com" } } as any;
    const res = mockRes();
    await updateProfile(req, res as any);
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "Joao", emergencyContact: "sos@test.com" },
      }),
    );
  });
});

// =============================================================================
// changePassword
// =============================================================================

describe("changePassword - validacao", () => {
  it("retorna 400 quando currentPassword esta em falta", async () => {
    const req = { userId: "user-1", body: { newPassword: "nova123" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retorna 400 quando newPassword esta em falta", async () => {
    const req = { userId: "user-1", body: { currentPassword: "atual123" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retorna 400 quando newPassword tem menos de 6 caracteres", async () => {
    const req = { userId: "user-1", body: { currentPassword: "atual123", newPassword: "abc" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Nova password deve ter pelo menos 6 caracteres" });
  });

  it("retorna 400 para newPassword com exatamente 5 caracteres", async () => {
    const req = { userId: "user-1", body: { currentPassword: "atual123", newPassword: "12345" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("aceita newPassword com exatamente 6 caracteres", async () => {
    mockPrismaFindUnique.mockResolvedValue(makeUser());
    mockBcryptCompare.mockResolvedValue(true);
    mockPrismaUpdate.mockResolvedValue(makeUser());
    const req = { userId: "user-1", body: { currentPassword: "atual123", newPassword: "123456" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});

describe("changePassword - autenticacao", () => {
  it("retorna 404 quando utilizador nao existe", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);
    const req = { userId: "user-nao-existe", body: { currentPassword: "abc123", newPassword: "nova123" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retorna 401 quando password atual esta incorreta", async () => {
    mockPrismaFindUnique.mockResolvedValue(makeUser());
    mockBcryptCompare.mockResolvedValue(false);
    const req = { userId: "user-1", body: { currentPassword: "errada", newPassword: "nova123" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Password atual incorreta" });
  });

  it("chama bcrypt.compare com a password atual e o hash", async () => {
    mockPrismaFindUnique.mockResolvedValue(makeUser({ passwordHash: "hash_stored" }));
    mockBcryptCompare.mockResolvedValue(true);
    mockPrismaUpdate.mockResolvedValue(makeUser());
    const req = { userId: "user-1", body: { currentPassword: "atual123", newPassword: "nova123" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(mockBcryptCompare).toHaveBeenCalledWith("atual123", "hash_stored");
  });
});

describe("changePassword - persistencia", () => {
  beforeEach(() => {
    mockPrismaFindUnique.mockResolvedValue(makeUser());
    mockBcryptCompare.mockResolvedValue(true);
    mockPrismaUpdate.mockResolvedValue(makeUser());
  });

  it("chama bcrypt.hash com a nova password", async () => {
    const req = { userId: "user-1", body: { currentPassword: "atual123", newPassword: "nova123" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(mockBcryptHash).toHaveBeenCalledWith("nova123", 12);
  });

  it("atualiza o passwordHash na BD", async () => {
    const req = { userId: "user-1", body: { currentPassword: "atual123", newPassword: "nova123" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { passwordHash: "hashed_new_password" },
      }),
    );
  });

  it("retorna mensagem de sucesso", async () => {
    const req = { userId: "user-1", body: { currentPassword: "atual123", newPassword: "nova123" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(res.json).toHaveBeenCalledWith({ message: "Password alterada com sucesso" });
  });

  it("retorna 500 quando prisma falha", async () => {
    mockPrismaUpdate.mockRejectedValue(new Error("db error"));
    const req = { userId: "user-1", body: { currentPassword: "atual123", newPassword: "nova123" } } as any;
    const res = mockRes();
    await changePassword(req, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
