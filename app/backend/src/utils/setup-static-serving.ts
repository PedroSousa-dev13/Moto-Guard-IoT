// =============================================================================
// MotoGuard IoT — Utilitário: Setup Static Serving
// =============================================================================
// Configura o Express para servir o build estático do React (Opção B / prod).
// Em dev (Opção A) o dist não existe e esta função é um no-op.
// Extraído do index.ts para ser testável de forma isolada.
// =============================================================================

import type { Application } from "express";
import express from "express";
import fs from "fs";
import path from "path";

/**
 * Configura middleware de ficheiros estáticos e SPA fallback no Express.
 * @param app      - Instância do Express
 * @param distPath - Caminho absoluto para o directório dist do React
 * @returns true se o dist existe e foi configurado; false em modo dev
 */
export function setupStaticServing(app: Application, distPath: string): boolean {
  if (!fs.existsSync(distPath)) {
    console.log("Frontend estático não encontrado — modo dev (Vite separado).");
    return false;
  }

  app.use(express.static(distPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  console.log(`Frontend estático: ${distPath}`);
  return true;
}
