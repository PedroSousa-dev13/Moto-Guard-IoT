import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../backend/src/services/mqtt.service", () => ({
  mqttService: {
    connected: true,
    publishCommand: vi.fn(),
  },
}));

import { mqttService } from "../backend/src/services/mqtt.service";
import { sendCommand } from "../backend/src/controllers/command.controller";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("sendCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mqttService as any).connected = true;
  });

  it("returns 400 when action is missing", () => {
    const req = { body: { modelo: "Naked" } } as any;
    const res = mockResponse();

    sendCommand(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Campo 'acao' é obrigatório" });
    expect(mqttService.publishCommand).not.toHaveBeenCalled();
  });

  it("returns 503 when mqtt is disconnected", () => {
    (mqttService as any).connected = false;
    const req = { body: { acao: "arrancar" } } as any;
    const res = mockResponse();

    sendCommand(req, res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "MQTT não está conectado" });
    expect(mqttService.publishCommand).not.toHaveBeenCalled();
  });

  it("publishes command and returns success when input is valid", () => {
    const req = { body: { acao: "definir_modelo", modelo: "Trail" } } as any;
    const res = mockResponse();

    sendCommand(req, res as any);

    expect(mqttService.publishCommand).toHaveBeenCalledWith(req.body);
    expect(res.json).toHaveBeenCalledWith({
      status: "sent",
      command: req.body,
    });
  });
});
