import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
  },
  verify: vi.fn(),
}));

import jwt from "jsonwebtoken";
import { authMiddleware } from "../backend/src/middleware/auth.middleware";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when authorization header is missing", () => {
    const req = { headers: {} } as any;
    const res = mockResponse();
    const next = vi.fn();

    authMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token não fornecido" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is not bearer", () => {
    const req = { headers: { authorization: "Basic abc" } } as any;
    const res = mockResponse();
    const next = vi.fn();

    authMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token não fornecido" });
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.userId and calls next for valid token", () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: "user-123" } as any);
    const req = { headers: { authorization: "Bearer valid-token" } } as any;
    const res = mockResponse();
    const next = vi.fn();

    authMiddleware(req, res as any, next);

    expect(jwt.verify).toHaveBeenCalledWith(
      "valid-token",
      expect.any(String),
    );
    expect(req.userId).toBe("user-123");
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when token verification throws", () => {
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error("invalid token");
    });
    const req = { headers: { authorization: "Bearer bad-token" } } as any;
    const res = mockResponse();
    const next = vi.fn();

    authMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token inválido ou expirado" });
    expect(next).not.toHaveBeenCalled();
  });
});
