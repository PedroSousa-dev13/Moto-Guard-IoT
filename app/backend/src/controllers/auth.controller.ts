// =============================================================================
// MotoGuard IoT — Controller: Auth (Registo e Login)
// =============================================================================
// POST /api/auth/register — Criar conta
// POST /api/auth/login    — Autenticar e obter JWT
// =============================================================================

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../services/prisma.service";
import { env } from "../config/env";
import { encrypt } from "../utils/crypto";
import type { AuthRequest } from "../middleware/auth.middleware";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, COOKIE_OPTIONS);
}

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

  try {
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

    setAuthCookie(res, token);
    res.status(201).json({ user, token });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: "Email já registado" });
      return;
    }
    console.error("[register] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

// ─── Login ──────────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Campos 'email' e 'password' são obrigatórios" });
    return;
  }

  try {
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

    setAuthCookie(res, token);
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (err) {
    console.error("[login] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true, emergencyContact: true },
    });

    if (!user) {
      res.status(404).json({ error: "Utilizador não encontrado" });
      return;
    }

    res.json(user);
  } catch (err) {
    console.error("[me] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { name, emergencyContact } = req.body as { name?: string; emergencyContact?: string | null };

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    res.status(400).json({ error: "Nome inválido" });
    return;
  }

  if (emergencyContact !== undefined && emergencyContact !== null) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(emergencyContact)) {
      res.status(400).json({ error: "Email de emergência inválido" });
      return;
    }
  }

  try {
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (emergencyContact !== undefined) data.emergencyContact = emergencyContact || null;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true, emergencyContact: true },
    });

    res.json(user);
  } catch (err) {
    console.error("[updateProfile] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Campos 'currentPassword' e 'newPassword' são obrigatórios" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Nova password deve ter pelo menos 6 caracteres" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ error: "Utilizador não encontrado" }); return; }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Password atual incorreta" }); return; }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    res.json({ message: "Password alterada com sucesso" });
  } catch (err) {
    console.error("[changePassword] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}

// ─── Guardar Resend API Key ──────────────────────────────────────────────────
export async function saveResendApiKey(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { apiKey } = req.body as { apiKey?: string | null };

  try {
    const encrypted = apiKey ? encrypt(apiKey.trim(), env.ENCRYPTION_KEY) : null;
    await prisma.user.update({
      where: { id: userId },
      data: { resendApiKey: encrypted },
    });
    res.json({ message: "API key guardada com sucesso", configured: !!apiKey });
  } catch (err) {
    console.error("[saveResendApiKey] Erro:", err);
    res.status(500).json({ error: "Erro ao guardar API key." });
  }
}

// ─── Estado da Resend API Key (sem revelar o valor) ─────────────────────────
export async function getResendApiKeyStatus(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { resendApiKey: true },
    });
    res.json({ configured: !!user?.resendApiKey });
  } catch (err) {
    console.error("[getResendApiKeyStatus] Erro:", err);
    res.status(500).json({ error: "Erro interno." });
  }
}
