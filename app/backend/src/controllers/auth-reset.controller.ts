// =============================================================================
// MotoGuard IoT — Controller: Auth (Recuperação de Senha)
// =============================================================================
// POST /api/auth/forgot-password - Enviar email de reset
// POST /api/auth/reset-password - Confirmar reset com token
// GET /api/auth/verify-reset-token/:token - Verificar token válido
// =============================================================================

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../services/prisma.service";
import { env } from "../config/env";

// Gerar token de reset (24h de validade)
function generateResetToken(email: string): string {
  return jwt.sign({ email, type: 'reset' }, env.JWT_SECRET, { expiresIn: '24h' });
}

// ─── Esqueci a Senha ───────────────────────────────────────────────────────
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "Email é obrigatório" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Não revelar se email existe ou não por segurança
      res.json({ message: "Se o email existir, receberá instruções de recuperação" });
      return;
    }

    // Gerar token de reset
    const resetToken = generateResetToken(email);

    // TODO: Enviar email com token (implementar serviço de email)
    // Por agora, apenas log do token para debug
    console.log(`Reset token para ${email}: ${resetToken}`);

    res.json({ message: "Se o email existir, receberá instruções de recuperação" });
  } catch (err) {
    console.error("[forgotPassword] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

// ─── Verificar Token de Reset ───────────────────────────────────────────────────
export async function verifyResetToken(req: Request, res: Response): Promise<void> {
  const tokenParam = req.params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  if (!token) {
    res.status(400).json({ error: "Token é obrigatório" });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;

    if (decoded.type !== 'reset') {
      res.status(400).json({ valid: false });
      return;
    }

    // Verificar se user ainda existe
    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) {
      res.status(400).json({ valid: false });
      return;
    }

    res.json({ valid: true });
  } catch (err) {
    // Token inválido, expirado, ou erro de base de dados
    console.error("[verifyResetToken] Erro:", err);
    res.status(400).json({ valid: false });
  }
}

// ─── Resetar Senha ───────────────────────────────────────────────────────────────
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    res.status(400).json({ error: "Token e nova senha são obrigatórios" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;

    if (decoded.type !== 'reset') {
      res.status(400).json({ error: "Token inválido" });
      return;
    }

    // Encontrar user pelo email no token
    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) {
      res.status(400).json({ error: "Token inválido" });
      return;
    }

    // Fazer hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Atualizar senha
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ message: "Senha redefinida com sucesso" });
  } catch (err) {
    console.error("[resetPassword] Erro interno:", err);
    res.status(400).json({ error: "Token inválido ou expirado" });
  }
}
