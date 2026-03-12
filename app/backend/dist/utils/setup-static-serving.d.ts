import type { Application } from "express";
/**
 * Configura middleware de ficheiros estáticos e SPA fallback no Express.
 * @param app      - Instância do Express
 * @param distPath - Caminho absoluto para o directório dist do React
 * @returns true se o dist existe e foi configurado; false em modo dev
 */
export declare function setupStaticServing(app: Application, distPath: string): boolean;
//# sourceMappingURL=setup-static-serving.d.ts.map