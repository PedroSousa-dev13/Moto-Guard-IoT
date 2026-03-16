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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_service_1 = require("../services/prisma.service");
const env_1 = require("../config/env");
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
//# sourceMappingURL=auth.controller.js.map