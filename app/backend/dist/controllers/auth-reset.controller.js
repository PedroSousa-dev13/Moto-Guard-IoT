"use strict";
// =============================================================================
// MotoGuard IoT — Controller: Auth (Recuperação de Senha)
// =============================================================================
// POST /api/auth/forgot-password - Enviar email de reset
// POST /api/auth/reset-password - Confirmar reset com token
// GET /api/auth/verify-reset-token/:token - Verificar token válido
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forgotPassword = forgotPassword;
exports.verifyResetToken = verifyResetToken;
exports.resetPassword = resetPassword;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_service_1 = require("../services/prisma.service");
const env_1 = require("../config/env");
// Gerar token de reset (24h de validade)
function generateResetToken(email) {
    return jsonwebtoken_1.default.sign({ email, type: 'reset' }, env_1.env.JWT_SECRET, { expiresIn: '24h' });
}
// ─── Esqueci a Senha ───────────────────────────────────────────────────────
async function forgotPassword(req, res) {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ error: "Email é obrigatório" });
        return;
    }
    try {
        const user = await prisma_service_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Não revelar se email existe ou não por segurança
            res.json({ message: "Se o email existir, receberá instruções de recuperação" });
            return;
        }
        // Gerar token de reset
        const resetToken = generateResetToken(email);
        // Email de reset não implementado — token gerado mas não enviado
        void resetToken;
        res.json({ message: "Se o email existir, receberá instruções de recuperação" });
    }
    catch (err) {
        console.error("[forgotPassword] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
// ─── Verificar Token de Reset ───────────────────────────────────────────────────
async function verifyResetToken(req, res) {
    const tokenParam = req.params.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
    if (!token) {
        res.status(400).json({ error: "Token é obrigatório" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        if (decoded.type !== 'reset') {
            res.status(400).json({ valid: false });
            return;
        }
        // Verificar se user ainda existe
        const user = await prisma_service_1.prisma.user.findUnique({ where: { email: decoded.email } });
        if (!user) {
            res.status(400).json({ valid: false });
            return;
        }
        res.json({ valid: true });
    }
    catch (err) {
        // Token inválido, expirado, ou erro de base de dados
        console.error("[verifyResetToken] Erro:", err);
        res.status(400).json({ valid: false });
    }
}
// ─── Resetar Senha ───────────────────────────────────────────────────────────────
async function resetPassword(req, res) {
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
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        if (decoded.type !== 'reset') {
            res.status(400).json({ error: "Token inválido" });
            return;
        }
        // Encontrar user pelo email no token
        const user = await prisma_service_1.prisma.user.findUnique({ where: { email: decoded.email } });
        if (!user) {
            res.status(400).json({ error: "Token inválido" });
            return;
        }
        // Fazer hash da nova senha
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        // Atualizar senha
        await prisma_service_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });
        res.json({ message: "Senha redefinida com sucesso" });
    }
    catch (err) {
        console.error("[resetPassword] Erro interno:", err);
        res.status(400).json({ error: "Token inválido ou expirado" });
    }
}
//# sourceMappingURL=auth-reset.controller.js.map