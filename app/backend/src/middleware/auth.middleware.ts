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

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token não fornecido" });
    return Promise.resolve();
  }

  const token = header.slice(7);

  return (async () => {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const userId = decoded.sub;

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
    } catch {
      res.status(401).json({ error: "Token inválido ou expirado" });
    }
  })();
}
