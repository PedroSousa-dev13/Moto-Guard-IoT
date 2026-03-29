"use strict";
// =============================================================================
// MotoGuard IoT — Middleware: Autenticação JWT
// =============================================================================
// Verifica o token JWT no header Authorization.
// Adiciona req.userId com o ID do utilizador autenticado.
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const prisma_service_1 = require("../services/prisma.service");
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ error: "Token não fornecido" });
        return Promise.resolve();
    }
    const token = header.slice(7);
    return (async () => {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
            const userId = decoded.sub;
            const user = await prisma_service_1.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });
            if (!user) {
                res.status(401).json({ error: "Token inválido ou expirado" });
                return;
            }
            req.userId = userId;
            next();
        }
        catch {
            res.status(401).json({ error: "Token inválido ou expirado" });
        }
    })();
}
//# sourceMappingURL=auth.middleware.js.map