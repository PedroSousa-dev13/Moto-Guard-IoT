// =============================================================================
// MotoGuard IoT — Testes Unitários: setupStaticServing
// =============================================================================
// Testa o utilitário que decide se o Express serve o build estático do React.
//   · Opção A (dev)  — dist NÃO existe → no-op, retorna false
//   · Opção B (prod) — dist EXISTE     → static + SPA fallback, retorna true
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("fs", () => ({
  default: { existsSync: vi.fn() },
  existsSync: vi.fn(),
}));

vi.mock("express", async () => {
  const actual = await vi.importActual<typeof import("express")>("express");
  const actualDefault = (actual as any).default ?? actual;
  return {
    ...actual,
    default: Object.assign(actualDefault, {
      static: vi.fn().mockReturnValue(vi.fn()),
    }),
  };
});

// ─── Importações (após os mocks) ──────────────────────────────────────────────

import fs from "fs";
import express from "express";
import { setupStaticServing } from "../backend/src/utils/setup-static-serving";

// ─── Helper ───────────────────────────────────────────────────────────────────

function mockApp() {
  return {
    use: vi.fn(),
    get: vi.fn(),
  };
}

// =============================================================================
// Opção A — dist NÃO existe (modo dev, Vite separado)
// =============================================================================

describe("setupStaticServing — dist NÃO existe (Opção A / dev)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna false quando o directório dist não existe", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const app = mockApp();

    const result = setupStaticServing(app as any, "/fake/dist");

    expect(result).toBe(false);
  });

  it("verifica a existência no caminho exacto recebido", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const app = mockApp();

    setupStaticServing(app as any, "/my/specific/dist");

    expect(fs.existsSync).toHaveBeenCalledWith("/my/specific/dist");
    expect(fs.existsSync).toHaveBeenCalledTimes(1);
  });

  it("não chama app.use() — nenhum middleware estático é registado", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const app = mockApp();

    setupStaticServing(app as any, "/fake/dist");

    expect(app.use).not.toHaveBeenCalled();
  });

  it("não chama app.get() — nenhuma rota catch-all é registada", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const app = mockApp();

    setupStaticServing(app as any, "/fake/dist");

    expect(app.get).not.toHaveBeenCalled();
  });

  it("não chama express.static()", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const app = mockApp();

    setupStaticServing(app as any, "/fake/dist");

    expect(express.static).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Opção B — dist EXISTE (modo produção)
// =============================================================================

describe("setupStaticServing — dist EXISTE (Opção B / produção)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna true quando o directório dist existe", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const app = mockApp();

    const result = setupStaticServing(app as any, "/fake/dist");

    expect(result).toBe(true);
  });

  it("chama express.static() com o caminho correcto", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const app = mockApp();

    setupStaticServing(app as any, "/fake/dist");

    expect(express.static).toHaveBeenCalledWith("/fake/dist");
  });

  it("regista o middleware estático via app.use()", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const app = mockApp();

    setupStaticServing(app as any, "/fake/dist");

    expect(app.use).toHaveBeenCalledTimes(1);
  });

  it("regista rota catch-all '*' via app.get()", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const app = mockApp();

    setupStaticServing(app as any, "/fake/dist");

    expect(app.get).toHaveBeenCalledWith("*", expect.any(Function));
  });

  it("o handler catch-all serve o index.html correcto", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const app = mockApp();

    setupStaticServing(app as any, "/fake/dist");

    // Extrair e invocar directamente o handler registado
    const [, handler] = vi.mocked(app.get).mock.calls[0] as [string, Function];
    const req = {};
    const res = { sendFile: vi.fn() };
    handler(req, res);

    expect(res.sendFile).toHaveBeenCalledWith(
      path.join("/fake/dist", "index.html"),
    );
  });

  it("o handler catch-all serve sempre o index.html independentemente do path pedido", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const app = mockApp();

    setupStaticServing(app as any, "/prod/dist");

    const [, handler] = vi.mocked(app.get).mock.calls[0] as [string, Function];

    const paths = ["/dashboard", "/trips/123", "/settings", "/qualquer/coisa"];
    for (const fakePath of paths) {
      const req = { path: fakePath };
      const res = { sendFile: vi.fn() };
      handler(req, res);
      expect(res.sendFile).toHaveBeenCalledWith(
        path.join("/prod/dist", "index.html"),
      );
    }
  });

  it("express.static e app.get() são chamados exactamente uma vez", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const app = mockApp();

    setupStaticServing(app as any, "/fake/dist");

    expect(express.static).toHaveBeenCalledTimes(1);
    expect(app.get).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Comportamento consistente independentemente do caminho
// =============================================================================

describe("setupStaticServing — caminhos variados", () => {
  beforeEach(() => vi.clearAllMocks());

  it("funciona correctamente com caminho Windows-style", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const app = mockApp();
    const winPath = "C:\\Users\\pedri\\app\\frontend\\dist";

    const result = setupStaticServing(app as any, winPath);

    expect(result).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith(winPath);
    expect(express.static).toHaveBeenCalledWith(winPath);
  });

  it("funciona correctamente com caminho Unix-style profundo", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const app = mockApp();
    const unixPath = "/opt/app/frontend/dist";

    const result = setupStaticServing(app as any, unixPath);

    expect(result).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith(unixPath);
  });

  it("retorna false para caminho inexistente independentemente do valor", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const app = mockApp();

    expect(setupStaticServing(app as any, "/qualquer/caminho")).toBe(false);
    expect(setupStaticServing(app as any, "C:\\outro\\caminho")).toBe(false);
    expect(setupStaticServing(app as any, "./relativo/dist")).toBe(false);
  });
});
