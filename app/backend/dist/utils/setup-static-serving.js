"use strict";
// =============================================================================
// MotoGuard IoT — Utilitário: Setup Static Serving
// =============================================================================
// Configura o Express para servir o build estático do React (Opção B / prod).
// Em dev (Opção A) o dist não existe e esta função é um no-op.
// Extraído do index.ts para ser testável de forma isolada.
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupStaticServing = setupStaticServing;
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Configura middleware de ficheiros estáticos e SPA fallback no Express.
 * @param app      - Instância do Express
 * @param distPath - Caminho absoluto para o directório dist do React
 * @returns true se o dist existe e foi configurado; false em modo dev
 */
function setupStaticServing(app, distPath) {
    if (!fs_1.default.existsSync(distPath)) {
        console.log("Frontend estático não encontrado — modo dev (Vite separado).");
        return false;
    }
    app.use(express_1.default.static(distPath));
    app.get("*", (_req, res) => {
        res.sendFile(path_1.default.join(distPath, "index.html"));
    });
    console.log(`Frontend estático: ${distPath}`);
    return true;
}
//# sourceMappingURL=setup-static-serving.js.map