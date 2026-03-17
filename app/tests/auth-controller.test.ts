import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
  },
  sign: vi.fn(),
}));

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../backend/src/services/prisma.service";
import { register, login, me } from "../backend/src/controllers/auth.controller";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when required fields are missing", async () => {
    const req = { body: { email: "a@b.com", password: "123456" } } as any;
    const res = mockResponse();

    await register(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Campos 'email', 'password' e 'name' são obrigatórios",
    });
  });

  it("returns 400 when password is too short", async () => {
    const req = { body: { email: "a@b.com", password: "123", name: "Ana" } } as any;
    const res = mockResponse();

    await register(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Password deve ter pelo menos 6 caracteres",
    });
  });

  it("returns 409 when email is already registered", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as any);
    const req = { body: { email: "a@b.com", password: "123456", name: "Ana" } } as any;
    const res = mockResponse();

    await register(req, res as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Email já registado" });
  });

  it("creates user and returns token for valid input", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-pass" as never);
    const created = {
      id: "u1",
      email: "a@b.com",
      name: "Ana",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
    };
    vi.mocked(prisma.user.create).mockResolvedValue(created as any);
    vi.mocked(jwt.sign).mockReturnValue("jwt-token" as never);
    const req = { body: { email: "a@b.com", password: "123456", name: "Ana" } } as any;
    const res = mockResponse();

    await register(req, res as any);

    expect(bcrypt.hash).toHaveBeenCalledWith("123456", 12);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: "a@b.com", passwordHash: "hashed-pass", name: "Ana" },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: "u1" },
      expect.any(String),
      { expiresIn: "7d" },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ user: created, token: "jwt-token" });
  });

  it("returns 500 when prisma throws during registration", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("db down"));
    const req = { body: { email: "a@b.com", password: "123456", name: "Ana" } } as any;
    const res = mockResponse();

    await register(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when email or password is missing", async () => {
    const req = { body: { email: "a@b.com" } } as any;
    const res = mockResponse();

    await login(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Campos 'email' e 'password' são obrigatórios",
    });
  });

  it("returns 401 when user is not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const req = { body: { email: "x@y.com", password: "123456" } } as any;
    const res = mockResponse();

    await login(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Credenciais inválidas" });
  });

  it("returns 401 when password comparison fails", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u2",
      email: "x@y.com",
      name: "X",
      passwordHash: "stored",
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const req = { body: { email: "x@y.com", password: "wrong" } } as any;
    const res = mockResponse();

    await login(req, res as any);

    expect(bcrypt.compare).toHaveBeenCalledWith("wrong", "stored");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Credenciais inválidas" });
  });

  it("returns user and token for valid credentials", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u2",
      email: "x@y.com",
      name: "X",
      passwordHash: "stored",
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(jwt.sign).mockReturnValue("jwt-login" as never);
    const req = { body: { email: "x@y.com", password: "correct" } } as any;
    const res = mockResponse();

    await login(req, res as any);

    expect(res.json).toHaveBeenCalledWith({
      user: { id: "u2", email: "x@y.com", name: "X" },
      token: "jwt-login",
    });
  });

  it("returns 500 when login flow throws", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("db issue"));
    const req = { body: { email: "x@y.com", password: "correct" } } as any;
    const res = mockResponse();

    await login(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});

describe("me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when user is not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const req = { userId: "u1" } as any;
    const res = mockResponse();

    await me(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Utilizador não encontrado" });
  });

  it("returns current user details", async () => {
    const user = {
      id: "u1",
      email: "a@b.com",
      name: "Ana",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:00:00.000Z"),
    };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    const req = { userId: "u1" } as any;
    const res = mockResponse();

    await me(req, res as any);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
    expect(res.json).toHaveBeenCalledWith(user);
  });
});
