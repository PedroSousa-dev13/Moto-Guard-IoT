import { beforeEach, describe, expect, it } from "vitest";
import { loadAlerts, pushAlert } from "./alerts";
import type { AlertItem } from "./alerts";

describe("alerts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads empty by default", () => {
    expect(loadAlerts()).toEqual([]);
  });

  it("pushes an alert and avoids duplicates", () => {
    const a: AlertItem = {
      id: "x",
      title: "TEST",
      message: "m",
      severity: "INFO",
      status: "unread",
      timestamp: "2026-03-10T10:00:00.000Z",
    };
    pushAlert(a);
    pushAlert(a);
    expect(loadAlerts()).toHaveLength(1);
    expect(loadAlerts()[0].id).toBe("x");
  });
});

