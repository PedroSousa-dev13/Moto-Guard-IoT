import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
  hash: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
  sign: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../backend/src/services/prisma.service";
import {
  forgotPassword,
  verifyResetToken,
  resetPassword,
} from "../backend/src/controllers/auth-reset.controller";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("forgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when email is missing", async () => {
    const req = { body: {} } as any;
    const res = mockResponse();

    await forgotPassword(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email é obrigatório" });
  });

  it("returns generic success when user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const req = { body: { email: "none@example.com" } } as any;
    const res = mockResponse();

    await forgotPassword(req, res as any);

    expect(res.json).toHaveBeenCalledWith({
      message: "Se o email existir, receberá instruções de recuperação",
    });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it("generates token and returns generic success when user exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as any);
    vi.mocked(jwt.sign).mockReturnValue("reset-token" as never);
    const req = { body: { email: "a@b.com" } } as any;
    const res = mockResponse();

    await forgotPassword(req, res as any);

    expect(jwt.sign).toHaveBeenCalledWith(
      { email: "a@b.com", type: "reset" },
      expect.any(String),
      { expiresIn: "24h" },
    );
    expect(res.json).toHaveBeenCalledWith({
      message: "Se o email existir, receberá instruções de recuperação",
    });
  });

  it("returns 500 when forgot password flow throws", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("db issue"));
    const req = { body: { email: "a@b.com" } } as any;
    const res = mockResponse();

    await forgotPassword(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});

describe("verifyResetToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when token param is missing", async () => {
    const req = { params: {} } as any;
    const res = mockResponse();

    await verifyResetToken(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Token é obrigatório" });
  });

  it("returns valid false when token type is invalid", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ type: "auth", email: "a@b.com" } as never);
    const req = { params: { token: "x" } } as any;
    const res = mockResponse();

    await verifyResetToken(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false });
  });

  it("returns valid false when user does not exist", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ type: "reset", email: "a@b.com" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const req = { params: { token: "x" } } as any;
    const res = mockResponse();

    await verifyResetToken(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false });
  });

  it("returns valid true for valid reset token and user", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ type: "reset", email: "a@b.com" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as any);
    const req = { params: { token: "x" } } as any;
    const res = mockResponse();

    await verifyResetToken(req, res as any);

    expect(res.json).toHaveBeenCalledWith({ valid: true });
  });

  it("returns valid false when verification throws", async () => {
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error("expired");
    });
    const req = { params: { token: "x" } } as any;
    const res = mockResponse();

    await verifyResetToken(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false });
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when token or password is missing", async () => {
    const req = { body: { token: "x" } } as any;
    const res = mockResponse();

    await resetPassword(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Token e nova senha são obrigatórios",
    });
  });

  it("returns 400 for short password", async () => {
    const req = { body: { token: "x", newPassword: "123" } } as any;
    const res = mockResponse();

    await resetPassword(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Senha deve ter pelo menos 6 caracteres",
    });
  });

  it("returns 400 when token type is invalid", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ type: "auth", email: "a@b.com" } as never);
    const req = { body: { token: "x", newPassword: "123456" } } as any;
    const res = mockResponse();

    await resetPassword(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Token inválido" });
  });

  it("returns 400 when token email user does not exist", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ type: "reset", email: "a@b.com" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const req = { body: { token: "x", newPassword: "123456" } } as any;
    const res = mockResponse();

    await resetPassword(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Token inválido" });
  });

  it("updates password hash and returns success for valid token", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ type: "reset", email: "a@b.com" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as any);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-new" as never);
    const req = { body: { token: "x", newPassword: "123456" } } as any;
    const res = mockResponse();

    await resetPassword(req, res as any);

    expect(bcrypt.hash).toHaveBeenCalledWith("123456", 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "hashed-new" },
    });
    expect(res.json).toHaveBeenCalledWith({ message: "Senha redefinida com sucesso" });
  });

  it("returns 400 when reset flow throws", async () => {
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error("expired");
    });
    const req = { body: { token: "x", newPassword: "123456" } } as any;
    const res = mockResponse();

    await resetPassword(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Token inválido ou expirado" });
  });
});
