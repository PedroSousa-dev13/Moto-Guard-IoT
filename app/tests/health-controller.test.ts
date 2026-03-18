import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../backend/src/config/env", () => ({
  env: {
    MQTT_BROKER_URL: "mqtt://broker:1883",
    MQTT_TOPIC_TELEMETRIA: "motoguard/telemetria",
    INFLUXDB_URL: "http://influxdb:8086",
    DATABASE_URL: "postgres://configured",
  },
}));

vi.mock("../backend/src/services/mqtt.service", () => ({
  mqttService: {
    connected: true,
  },
}));

vi.mock("../backend/src/services/telemetry.store", () => ({
  telemetryStore: {
    count: 12,
    hasData: true,
  },
}));

vi.mock("../backend/src/services/socket.service", () => ({
  socketService: {
    connectedClients: 3,
  },
}));

import { getHealth } from "../backend/src/controllers/health.controller";

function mockResponse() {
  return {
    json: vi.fn().mockReturnThis(),
  };
}

describe("getHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns expected health payload structure", () => {
    const req = {} as any;
    const res = mockResponse();

    getHealth(req, res as any);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(res.json).mock.calls[0][0];
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("motoguard-backend");
    expect(payload.timestamp).toEqual(expect.any(String));
    expect(payload.mqtt).toEqual({
      connected: true,
      broker: "mqtt://broker:1883",
      topic: "motoguard/telemetria",
    });
    expect(payload.stats).toEqual({
      telemetryCount: 12,
      connectedClients: 3,
      hasData: true,
    });
    expect(payload.infrastructure).toEqual({
      influxdb: "http://influxdb:8086",
      postgres: "configured",
    });
  });
});
