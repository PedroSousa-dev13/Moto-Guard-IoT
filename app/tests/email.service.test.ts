// =============================================================================
// Testes: email.service - sendCrashAlert (Resend)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks - Resend e uma classe, o mock tem de ser uma funcao normal
const { mockResendSend, mockEnv } = vi.hoisted(() => {
  const mockResendSend = vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });
  const mockEnv = {
    RESEND_API_KEY: "",
    RESEND_FROM: "onboarding@resend.dev",
    APP_URL: "http://localhost:3000",
    JWT_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test",
    PORT: 3001,
  };
  return { mockResendSend, mockEnv };
});

vi.mock("resend", () => {
  // Tem de ser uma funcao normal (nao arrow) para poder ser usada com "new"
  function ResendMock(_apiKey: string) {
    return { emails: { send: mockResendSend } };
  }
  return { Resend: ResendMock };
});

vi.mock("../backend/src/config/env", () => ({ env: mockEnv }));

import { sendCrashAlert } from "../backend/src/services/email.service";

// Helpers

function makePayload(overrides: Partial<Parameters<typeof sendCrashAlert>[0]> = {}) {
  return {
    toEmail: "emergency@test.com",
    riderName: "Joao Silva",
    timestamp: "2026-03-20T10:00:00.000Z",
    latitude: 38.7169 as number | null,
    longitude: -9.1399 as number | null,
    tripId: "trip-abc-123" as string | null,
    deviceId: "MOTOGUARD-SIM-01",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResendSend.mockResolvedValue({ data: { id: "test-id" }, error: null });
  mockEnv.RESEND_API_KEY = "";
  mockEnv.RESEND_FROM = "onboarding@resend.dev";
  mockEnv.APP_URL = "http://localhost:3000";
});

// =============================================================================
// Modo dev (sem API key)
// =============================================================================

describe("sendCrashAlert - modo dev (sem RESEND_API_KEY)", () => {
  it("resolve sem erro quando RESEND_API_KEY nao esta configurado", async () => {
    await expect(sendCrashAlert(makePayload())).resolves.toBeUndefined();
  });

  it("NAO chama emails.send quando RESEND_API_KEY esta vazio", async () => {
    await sendCrashAlert(makePayload());
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("faz console.warn quando API key nao esta configurada", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendCrashAlert(makePayload());
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("o warn menciona o email de destino", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendCrashAlert(makePayload({ toEmail: "sos@example.com" }));
    const allWarns = warnSpy.mock.calls.flat().join(" ");
    expect(allWarns).toContain("sos@example.com");
    warnSpy.mockRestore();
  });
});

// =============================================================================
// Modo Resend configurado
// =============================================================================

describe("sendCrashAlert - modo Resend", () => {
  beforeEach(() => {
    mockEnv.RESEND_API_KEY = "re_test_key_123";
  });

  it("chama emails.send uma vez", async () => {
    await sendCrashAlert(makePayload());
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });

  it("envia para o email correto", async () => {
    await sendCrashAlert(makePayload({ toEmail: "familia@test.com" }));
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "familia@test.com" }),
    );
  });

  it("usa RESEND_FROM configurado", async () => {
    await sendCrashAlert(makePayload());
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: "onboarding@resend.dev" }),
    );
  });

  it("subject contem o nome do motociclista", async () => {
    await sendCrashAlert(makePayload({ riderName: "Maria Costa" }));
    const call = mockResendSend.mock.calls[0][0];
    expect(call.subject).toContain("Maria Costa");
  });

  it("subject contem emoji de emergencia", async () => {
    await sendCrashAlert(makePayload());
    const call = mockResendSend.mock.calls[0][0];
    expect(call.subject).toContain("\uD83D\uDEA8");
  });

  it("propaga erro quando emails.send falha", async () => {
    mockResendSend.mockRejectedValueOnce(new Error("API rate limit"));
    await expect(sendCrashAlert(makePayload())).rejects.toThrow("API rate limit");
  });

  it("faz console.log apos envio bem-sucedido", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendCrashAlert(makePayload({ toEmail: "sos@test.com" }));
    const allLogs = logSpy.mock.calls.flat().join(" ");
    expect(allLogs).toContain("sos@test.com");
    logSpy.mockRestore();
  });
});

// =============================================================================
// Conteudo HTML
// =============================================================================

describe("sendCrashAlert - conteudo HTML", () => {
  beforeEach(() => {
    mockEnv.RESEND_API_KEY = "re_test_key_123";
  });

  it("HTML contem o nome do motociclista", async () => {
    await sendCrashAlert(makePayload({ riderName: "Pedro Alves" }));
    const html = mockResendSend.mock.calls[0][0].html as string;
    expect(html).toContain("Pedro Alves");
  });

  it("HTML contem o deviceId", async () => {
    await sendCrashAlert(makePayload({ deviceId: "MOTOGUARD-SIM-01" }));
    const html = mockResendSend.mock.calls[0][0].html as string;
    expect(html).toContain("MOTOGUARD-SIM-01");
  });

  it("HTML contem as coordenadas quando fornecidas", async () => {
    await sendCrashAlert(makePayload({ latitude: 38.7169, longitude: -9.1399 }));
    const html = mockResendSend.mock.calls[0][0].html as string;
    expect(html).toContain("38.716900");
  });

  it("HTML contem link do Google Maps quando ha coordenadas", async () => {
    await sendCrashAlert(makePayload({ latitude: 38.7169, longitude: -9.1399 }));
    const html = mockResendSend.mock.calls[0][0].html as string;
    expect(html).toContain("maps.google.com");
  });

  it("HTML NAO contem link do Maps quando coordenadas sao null", async () => {
    await sendCrashAlert(makePayload({ latitude: null, longitude: null }));
    const html = mockResendSend.mock.calls[0][0].html as string;
    expect(html).not.toContain("maps.google.com");
  });

  it("HTML contem link da viagem quando tripId fornecido", async () => {
    await sendCrashAlert(makePayload({ tripId: "trip-xyz-999" }));
    const html = mockResendSend.mock.calls[0][0].html as string;
    expect(html).toContain("trip-xyz-999");
    expect(html).toContain("http://localhost:3000/trips/trip-xyz-999");
  });

  it("HTML NAO contem link da viagem quando tripId e null", async () => {
    await sendCrashAlert(makePayload({ tripId: null }));
    const html = mockResendSend.mock.calls[0][0].html as string;
    expect(html).not.toContain("/trips/");
  });

  it("HTML contem emoji de emergencia", async () => {
    await sendCrashAlert(makePayload());
    const html = mockResendSend.mock.calls[0][0].html as string;
    expect(html).toContain("\uD83D\uDEA8");
  });

  it("HTML contem a data/hora formatada", async () => {
    await sendCrashAlert(makePayload({ timestamp: "2026-03-20T10:00:00.000Z" }));
    const html = mockResendSend.mock.calls[0][0].html as string;
    expect(html).toMatch(/2026|20\/03/);
  });
});