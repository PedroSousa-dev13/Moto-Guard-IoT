// =============================================================================
// MotoGuard IoT — Controller: Auth (Recuperação de Senha)
// =============================================================================
// POST /api/auth/forgot-password - Enviar email de reset
// POST /api/auth/reset-password - Confirmar reset com token
// GET /api/auth/verify-reset-token/:token - Verificar token válido
// =============================================================================

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { Resend } from "resend";
import { prisma } from "../services/prisma.service";
import { env } from "../config/env";

// Gerar token de reset (24h de validade)
function generateResetToken(email: string): string {
  return jwt.sign({ email, type: 'reset' }, env.JWT_SECRET, { expiresIn: '24h' });
}

function buildResetEmailHtml(resetLink: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:2px solid #3b82f6;border-radius:12px">
      <h2 style="color:#1e40af;margin:0 0 16px">MotoGuard — Recuperação de Senha</h2>
      <p style="margin:0 0 12px;font-size:15px">
        Recebemos um pedido de redefinição de senha para a sua conta MotoGuard.
      </p>
      <p style="margin:0 0 20px;font-size:15px">
        Clique no botão abaixo para definir uma nova senha. Este link é válido por <strong>24 horas</strong>.
      </p>
      <p style="margin:0 0 8px;text-align:center">
        <a href="${resetLink}" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Redefinir Senha</a>
      </p>
      <p style="margin:20px 0 0;font-size:12px;color:#999">
        Se não pediu a redefinição, ignore este email.
      </p>
    </div>
  `;
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
    const resetLink = `${env.APP_URL}/reset-password?token=${resetToken}`;

    // Enviar email com o link de reset
    if (env.RESEND_API_KEY) {
      const resend = new Resend(env.RESEND_API_KEY);
      await resend.emails.send({
        from: env.RESEND_FROM,
        to: email,
        subject: "MotoGuard — Recuperação de Senha",
        html: buildResetEmailHtml(resetLink),
      });
    } else {
      console.warn("[auth-reset] RESEND_API_KEY não configurada. Email de reset não enviado.");
      console.warn(`[auth-reset] Link de reset (dev): ${resetLink}`);
    }

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
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (decoded.type !== 'reset') {
      res.status(400).json({ valid: false });
      return;
    }

    // Verificar se user ainda existe
    const user = await prisma.user.findUnique({ where: { email: decoded.email as string } });
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
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (decoded.type !== 'reset') {
      res.status(400).json({ error: "Token inválido" });
      return;
    }

    // Encontrar user pelo email no token
    const user = await prisma.user.findUnique({ where: { email: decoded.email as string } });
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
