"use strict";
// =============================================================================
// MotoGuard IoT — Controller: Auth (Registo e Login)
// =============================================================================
// POST /api/auth/register — Criar conta
// POST /api/auth/login    — Autenticar e obter JWT
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.me = me;
exports.updateProfile = updateProfile;
exports.changePassword = changePassword;
exports.saveResendApiKey = saveResendApiKey;
exports.getResendApiKeyStatus = getResendApiKeyStatus;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_service_1 = require("../services/prisma.service");
const env_1 = require("../config/env");
const crypto_1 = require("../utils/crypto");
// ─── Registo ────────────────────────────────────────────────────────────────
async function register(req, res) {
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
        const existing = await prisma_service_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(409).json({ error: "Email já registado" });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_service_1.prisma.user.create({
            data: { email, passwordHash, name },
            select: { id: true, email: true, name: true, createdAt: true },
        });
        const token = jsonwebtoken_1.default.sign({ sub: user.id }, env_1.env.JWT_SECRET, { expiresIn: "7d" });
        res.status(201).json({ user, token });
    }
    catch (err) {
        console.error("[register] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
// ─── Login ──────────────────────────────────────────────────────────────────
async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: "Campos 'email' e 'password' são obrigatórios" });
        return;
    }
    try {
        const user = await prisma_service_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: "Credenciais inválidas" });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: "Credenciais inválidas" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ sub: user.id }, env_1.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({
            user: { id: user.id, email: user.email, name: user.name },
            token,
        });
    }
    catch (err) {
        console.error("[login] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
async function me(req, res) {
    const userId = req.userId;
    try {
        const user = await prisma_service_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, createdAt: true, updatedAt: true, emergencyContact: true },
        });
        if (!user) {
            res.status(404).json({ error: "Utilizador não encontrado" });
            return;
        }
        res.json(user);
    }
    catch (err) {
        console.error("[me] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
async function updateProfile(req, res) {
    const userId = req.userId;
    const { name, emergencyContact } = req.body;
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
        const data = {};
        if (name !== undefined)
            data.name = name.trim();
        if (emergencyContact !== undefined)
            data.emergencyContact = emergencyContact || null;
        const user = await prisma_service_1.prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, email: true, name: true, createdAt: true, updatedAt: true, emergencyContact: true },
        });
        res.json(user);
    }
    catch (err) {
        console.error("[updateProfile] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
}
async function changePassword(req, res) {
    const userId = req.userId;
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
        const user = await prisma_service_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ error: "Utilizador não encontrado" });
            return;
        }
        const valid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: "Password atual incorreta" });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        await prisma_service_1.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
        res.json({ message: "Password alterada com sucesso" });
    }
    catch (err) {
        console.error("[changePassword] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
}
// ─── Guardar Resend API Key ──────────────────────────────────────────────────
async function saveResendApiKey(req, res) {
    const userId = req.userId;
    const { apiKey } = req.body;
    try {
        const encrypted = apiKey ? (0, crypto_1.encrypt)(apiKey.trim(), env_1.env.JWT_SECRET) : null;
        await prisma_service_1.prisma.user.update({
            where: { id: userId },
            data: { resendApiKey: encrypted },
        });
        res.json({ message: "API key guardada com sucesso", configured: !!apiKey });
    }
    catch (err) {
        console.error("[saveResendApiKey] Erro:", err);
        res.status(500).json({ error: "Erro ao guardar API key." });
    }
}
// ─── Estado da Resend API Key (sem revelar o valor) ─────────────────────────
async function getResendApiKeyStatus(req, res) {
    const userId = req.userId;
    try {
        const user = await prisma_service_1.prisma.user.findUnique({
            where: { id: userId },
            select: { resendApiKey: true },
        });
        res.json({ configured: !!user?.resendApiKey });
    }
    catch (err) {
        console.error("[getResendApiKeyStatus] Erro:", err);
        res.status(500).json({ error: "Erro interno." });
    }
}
//# sourceMappingURL=auth.controller.js.map