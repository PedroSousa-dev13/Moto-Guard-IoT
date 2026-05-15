// =============================================================================
// MotoGuard IoT — Middleware: Autenticação JWT
// =============================================================================
// Verifica o token JWT no header Authorization.
// Adiciona req.userId com o ID do utilizador autenticado.
// =============================================================================

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../services/prisma.service";

export interface AuthRequest extends Request {
  userId?: string;
}

interface JwtPayload {
  sub: string;
}

function ensureStringSub(sub: unknown): string {
  if (typeof sub === "string") return sub;
  if (typeof sub === "number") return String(sub);
  throw new Error("JWT sub inválido");
}

function extractToken(req: AuthRequest): string | null {
  // 1. Check Authorization header
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  // 2. Check httpOnly cookie
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }

  (async () => {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const userId = ensureStringSub(decoded.sub);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        res.status(401).json({ error: "Token inválido ou expirado" });
        return;
      }

      req.userId = userId;
      next();
    } catch (err) {
      if (res.headersSent) {
        next(err);
        return;
      }
      res.status(401).json({ error: "Token inválido ou expirado" });
    }
  })();
}
