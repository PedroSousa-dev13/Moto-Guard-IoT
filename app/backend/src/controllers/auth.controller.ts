// =============================================================================
// MotoGuard IoT — Controller: Auth (Registo e Login)
// =============================================================================
// POST /api/auth/register — Criar conta
// POST /api/auth/login    — Autenticar e obter JWT
// =============================================================================

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../services/prisma.service";
import { env } from "../config/env";

// ─── Registo ────────────────────────────────────────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: "Campos 'email', 'password' e 'name' são obrigatórios" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password deve ter pelo menos 6 caracteres" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email já registado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: "7d" });

  res.status(201).json({ user, token });
}

// ─── Login ──────────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Campos 'email' e 'password' são obrigatórios" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: "7d" });

  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    token,
  });
}
